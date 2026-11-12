-- ==========================================================
-- Notify the designated users about everything that happens
--
-- Database triggers create a notification for the people an action
-- concerns, no matter which screen (or device) did it:
--
--   Budget requests
--     submitted / resubmitted ......... Advisers of the department
--     approved by Adviser ............. Deans of the department + requester
--     returned for revision / rejected  requester
--     approved & funds released ....... requester + department officers
--   Council notes ...................... requester + Advisers + Deans of the department
--   Liquidation reports
--     submitted ....................... Advisers;  endorsed -> Deans
--     revision / rejected / audited ... requester and submitter
--   Reimbursements
--     filed ........................... Advisers + Deans of the department
--     approved / rejected / paid ...... claimant
--   Transactions
--     recorded as Pending ............. Advisers + Deans (they review them)
--     reviewed (Completed / Rejected) . whoever recorded it
--   Budget returns ..................... requester + Advisers of the department
--   Events
--     new event ....................... students + officers of the department (all if 'ALL')
--   Attendance / penalties
--     penalty recorded / settled ...... the student
--
-- Nobody is notified about their own action. A notification can never
-- make the underlying action fail: every send is wrapped in an exception
-- handler. Notifications are also published to Realtime so the bell
-- updates live.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================


-- ---------- helpers ----------

-- Send one notification (skips empty recipients and the acting user).
CREATE OR REPLACE FUNCTION public.ncf_notify(p_recipient UUID, p_title TEXT, p_body TEXT, p_tab TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_recipient IS NULL OR p_recipient = auth.uid() THEN
    RETURN;
  END IF;
  BEGIN
    -- Preferred path: the app's existing notification function.
    PERFORM public.notify_recipient(p_recipient, p_title, p_body, p_tab);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      -- Fallback: write the row directly.
      INSERT INTO public.notifications (recipient_id, title, body, link_tab)
      VALUES (p_recipient, p_title, p_body, p_tab);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'ncf_notify: could not notify % (%)', p_recipient, SQLERRM;
    END;
  END;
END;
$$;

-- Send to every active user of the given roles in a department (NULL department = everyone with those roles),
-- optionally skipping one person who is notified separately (avoids duplicates).
DROP FUNCTION IF EXISTS public.ncf_notify_roles(TEXT, TEXT[], TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.ncf_notify_roles(p_dept TEXT, p_roles TEXT[], p_title TEXT, p_body TEXT, p_tab TEXT, p_exclude UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.profiles
    WHERE role = ANY (p_roles)
      AND COALESCE(is_active, true)
      AND (p_dept IS NULL OR department = p_dept)
      AND (p_exclude IS NULL OR id <> p_exclude)
  LOOP
    PERFORM public.ncf_notify(r.id, p_title, p_body, p_tab);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.ncf_notify(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ncf_notify_roles(TEXT, TEXT[], TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;


-- ---------- budget requests ----------

CREATE OR REPLACE FUNCTION public.ncf_trg_budget_request_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t TEXT := '"' || NEW.title || '" (' || NEW.department_code || ')';
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'CSC_ADVISER_APPROVAL' THEN
      PERFORM public.ncf_notify_roles(NEW.department_code, ARRAY['csc_adviser'],
        'Budget request needs your approval', t || ' was submitted for Adviser approval.', 'budget_approvals');
    WHEN 'DEAN_APPROVAL' THEN
      PERFORM public.ncf_notify_roles(NEW.department_code, ARRAY['dean'],
        'Budget request needs your final approval', t || ' was approved by the Adviser and forwarded to you.', 'budget_approvals');
      PERFORM public.ncf_notify(NEW.requested_by,
        'Budget request approved by Adviser', t || ' was approved by the Adviser and is now with the Dean.', 'budget');
    WHEN 'FOR_REVISION' THEN
      PERFORM public.ncf_notify(NEW.requested_by,
        'Budget request returned for revision',
        t || ' needs changes.' || COALESCE(' Remarks: ' || NULLIF(COALESCE(NEW.dean_remarks, NEW.adviser_remarks), ''), '')
          || ' Edit it and resubmit.', 'budget');
    WHEN 'REJECTED' THEN
      PERFORM public.ncf_notify(NEW.requested_by,
        'Budget request rejected',
        t || ' was rejected.' || COALESCE(' Remarks: ' || NULLIF(COALESCE(NEW.dean_remarks, NEW.adviser_remarks), ''), '')
          || ' You can edit and resubmit it.', 'budget');
    WHEN 'APPROVED_RELEASED' THEN
      PERFORM public.ncf_notify(NEW.requested_by,
        'Budget approved and funds released', t || ' was approved by the Dean. Funds are released.', 'budget');
      PERFORM public.ncf_notify_roles(NEW.department_code, ARRAY['officer_treasurer', 'officer_governor', 'council_member', 'csc_adviser'],
        'Budget approved and funds released', t || ' was approved by the Dean.', 'budget', NEW.requested_by);
    ELSE
      NULL;
  END CASE;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'budget request notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ncf_budget_request_notify ON public.budget_requests;
CREATE TRIGGER ncf_budget_request_notify
  AFTER INSERT OR UPDATE OF status ON public.budget_requests
  FOR EACH ROW EXECUTE FUNCTION public.ncf_trg_budget_request_notify();


-- ---------- council notes ----------

CREATE OR REPLACE FUNCTION public.ncf_trg_note_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.budget_requests;
  who TEXT;
BEGIN
  SELECT * INTO req FROM public.budget_requests WHERE id = NEW.proposal_id;
  IF req.id IS NULL THEN RETURN NEW; END IF;
  SELECT full_name INTO who FROM public.profiles WHERE id = NEW.author_id;
  PERFORM public.ncf_notify(req.requested_by,
    'New note on your budget request', COALESCE(who, 'Someone') || ' on "' || req.title || '": ' || left(NEW.note_content, 140), 'budget');
  PERFORM public.ncf_notify_roles(req.department_code, ARRAY['csc_adviser', 'dean'],
    'New note on a budget request', COALESCE(who, 'Someone') || ' on "' || req.title || '": ' || left(NEW.note_content, 140), 'budget_approvals', req.requested_by);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'note notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ncf_note_notify ON public.proposal_notes;
CREATE TRIGGER ncf_note_notify
  AFTER INSERT ON public.proposal_notes
  FOR EACH ROW EXECUTE FUNCTION public.ncf_trg_note_notify();


-- ---------- liquidation reports ----------

CREATE OR REPLACE FUNCTION public.ncf_trg_liquidation_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.budget_requests;
  t TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  SELECT * INTO req FROM public.budget_requests WHERE id = NEW.proposal_id;
  t := '"' || COALESCE(req.title, NEW.event_name) || '" (' || NEW.department_code || ')';

  IF NEW.status = 'PENDING_ADVISER' THEN
    PERFORM public.ncf_notify_roles(NEW.department_code, ARRAY['csc_adviser'],
      'Liquidation report needs your review', 'The liquidation report for ' || t || ' was submitted.', 'liquidation_reports');
  ELSIF NEW.status = 'PENDING_DEAN' THEN
    PERFORM public.ncf_notify_roles(NEW.department_code, ARRAY['dean'],
      'Liquidation report needs your final review', 'The liquidation report for ' || t || ' was endorsed by the Adviser.', 'liquidation_reports');
    PERFORM public.ncf_notify(COALESCE(NEW.submitted_by, req.requested_by),
      'Liquidation report endorsed by Adviser', 'The liquidation report for ' || t || ' is now with the Dean.', 'liquidation_reports');
  ELSIF NEW.status IN ('FOR_REVISION', 'Rejected', 'Audited') THEN
    PERFORM public.ncf_notify(COALESCE(NEW.submitted_by, req.requested_by),
      CASE NEW.status
        WHEN 'FOR_REVISION' THEN 'Liquidation report returned for revision'
        WHEN 'Rejected' THEN 'Liquidation report rejected'
        ELSE 'Liquidation report audited'
      END,
      'The liquidation report for ' || t ||
        CASE NEW.status
          WHEN 'FOR_REVISION' THEN ' needs changes. Revise and resubmit it.'
          WHEN 'Rejected' THEN ' was rejected.'
          ELSE ' was approved by the Dean. Process the fund return if there is unspent money.'
        END || COALESCE(' Remarks: ' || NULLIF(NEW.remarks, ''), ''),
      'liquidation_reports');
    IF req.requested_by IS DISTINCT FROM NEW.submitted_by THEN
      PERFORM public.ncf_notify(req.requested_by, 'Liquidation report update',
        'The liquidation report for ' || t || ' is now ' || NEW.status || '.', 'liquidation_reports');
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'liquidation notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ncf_liquidation_notify ON public.liquidation_reports;
CREATE TRIGGER ncf_liquidation_notify
  AFTER INSERT OR UPDATE OF status ON public.liquidation_reports
  FOR EACH ROW EXECUTE FUNCTION public.ncf_trg_liquidation_notify();


-- ---------- reimbursements ----------

CREATE OR REPLACE FUNCTION public.ncf_trg_reimbursement_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt TEXT := to_char(NEW.amount_requested, 'FM999,999,990.00');
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.ncf_notify_roles(NEW.department_code, ARRAY['csc_adviser', 'dean'],
      'Reimbursement request to review',
      NEW.claimant_name || ' requested PHP ' || amt || ' for "' || NEW.event_name || '".', 'reimbursement');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.ncf_notify(NEW.claimant_id,
      'Reimbursement ' || lower(NEW.status),
      'Your PHP ' || amt || ' reimbursement for "' || NEW.event_name || '" is now ' || NEW.status || '.'
        || COALESCE(' Remarks: ' || NULLIF(NEW.remarks, ''), ''), 'reimbursement');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'reimbursement notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ncf_reimbursement_notify ON public.reimbursements;
CREATE TRIGGER ncf_reimbursement_notify
  AFTER INSERT OR UPDATE OF status ON public.reimbursements
  FOR EACH ROW EXECUTE FUNCTION public.ncf_trg_reimbursement_notify();


-- ---------- transactions ----------

CREATE OR REPLACE FUNCTION public.ncf_trg_transaction_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt TEXT := to_char(NEW.amount, 'FM999,999,990.00');
  kind TEXT := CASE WHEN NEW.is_income THEN 'income' ELSE 'expense' END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Pending' THEN
      PERFORM public.ncf_notify_roles(NEW.department_code, ARRAY['csc_adviser', 'dean'],
        'Transaction awaiting review', 'A PHP ' || amt || ' ' || kind || ' "' || NEW.title || '" (' || NEW.department_code || ') needs review.', 'transactions');
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.ncf_notify(NEW.created_by,
      'Transaction ' || lower(NEW.status),
      'Your PHP ' || amt || ' ' || kind || ' "' || NEW.title || '" is now ' || NEW.status || '.', 'transactions');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'transaction notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ncf_transaction_notify ON public.transactions;
CREATE TRIGGER ncf_transaction_notify
  AFTER INSERT OR UPDATE OF status ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.ncf_trg_transaction_notify();


-- ---------- budget returns ----------

CREATE OR REPLACE FUNCTION public.ncf_trg_budget_return_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.budget_requests;
  msg TEXT;
BEGIN
  SELECT * INTO req FROM public.budget_requests WHERE id = NEW.proposal_id;
  IF req.id IS NULL THEN RETURN NEW; END IF;
  msg := 'PHP ' || to_char(NEW.amount_returned, 'FM999,999,990.00') || ' unspent from "' || req.title || '" was returned to the SAF.';
  PERFORM public.ncf_notify(req.requested_by, 'Unspent funds returned', msg, 'liquidation_reports');
  PERFORM public.ncf_notify_roles(req.department_code, ARRAY['csc_adviser'], 'Unspent funds returned', msg, 'liquidation_reports', req.requested_by);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'budget return notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ncf_budget_return_notify ON public.budget_returns;
CREATE TRIGGER ncf_budget_return_notify
  AFTER INSERT ON public.budget_returns
  FOR EACH ROW EXECUTE FUNCTION public.ncf_trg_budget_return_notify();


-- ---------- events ----------

CREATE OR REPLACE FUNCTION public.ncf_trg_event_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ncf_notify_roles(NEW.department_code,
    ARRAY['student', 'officer_treasurer', 'officer_governor', 'council_member'],
    'New event: ' || NEW.event_title,
    to_char(NEW.event_date, 'Mon DD, YYYY') || COALESCE(' at ' || NULLIF(NEW.venue, ''), '')
      || '. Attendance is required; absences carry a PHP ' || to_char(NEW.penalty_fee_amount, 'FM999,990.00') || ' penalty.',
    'events_attendance');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'event notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ncf_event_notify ON public.school_events;
CREATE TRIGGER ncf_event_notify
  AFTER INSERT ON public.school_events
  FOR EACH ROW EXECUTE FUNCTION public.ncf_trg_event_notify();


-- ---------- attendance penalties ----------

CREATE OR REPLACE FUNCTION public.ncf_trg_attendance_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_profile UUID;
  ev TEXT;
BEGIN
  SELECT profile_id INTO student_profile FROM public.students WHERE id = NEW.student_id;
  IF student_profile IS NULL THEN RETURN NEW; END IF;
  SELECT event_title INTO ev FROM public.school_events WHERE id = NEW.event_id;

  IF NEW.penalty_amount > 0 AND NOT NEW.penalty_paid
     AND (TG_OP = 'INSERT' OR OLD.penalty_amount IS DISTINCT FROM NEW.penalty_amount) THEN
    PERFORM public.ncf_notify(student_profile, 'Penalty recorded',
      'You were marked ' || NEW.status || ' for "' || COALESCE(ev, 'an event') || '". Penalty: PHP '
        || to_char(NEW.penalty_amount, 'FM999,990.00') || '. Settle it at the SSC Treasury.', 'events_attendance');
  ELSIF TG_OP = 'UPDATE' AND NEW.penalty_paid AND NOT OLD.penalty_paid THEN
    PERFORM public.ncf_notify(student_profile, 'Penalty paid',
      'Your PHP ' || to_char(NEW.penalty_amount, 'FM999,990.00') || ' penalty for "' || COALESCE(ev, 'an event') || '" is settled.', 'events_attendance');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'attendance notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ncf_attendance_notify ON public.event_attendance;
CREATE TRIGGER ncf_attendance_notify
  AFTER INSERT OR UPDATE OF penalty_amount, penalty_paid ON public.event_attendance
  FOR EACH ROW EXECUTE FUNCTION public.ncf_trg_attendance_notify();


-- ---------- live bell: publish notifications to Realtime ----------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
