-- ==========================================================
-- A resubmitted budget request goes back to whoever sent it back
--
-- Before: every (re)submission restarted at the Adviser, even when the
-- Adviser had already approved and it was the Dean who asked for revision
-- or rejected it.
-- Now: if the Adviser already APPROVED and the Dean returned it
-- (REVISION / REJECTED), resubmitting sends it straight back to the Dean
-- (DEAN_APPROVAL). Otherwise it goes to the Adviser as before.
-- The notification text for the Dean says it was resubmitted.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.submit_budget_request(p_proposal_id UUID)
RETURNS public.budget_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req    public.budget_requests;
  v_row    public.budget_requests;
  v_target TEXT;
BEGIN
  SELECT * INTO v_req FROM public.budget_requests WHERE id = p_proposal_id FOR UPDATE;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Budget request not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.ncf_can_manage_request(v_req) THEN
    RAISE EXCEPTION 'Only the person who created this request can submit it.' USING ERRCODE = '42501';
  END IF;
  IF v_req.status NOT IN ('DRAFT', 'FOR_REVISION', 'REJECTED') THEN
    RAISE EXCEPTION 'This request was already submitted (status: %).', v_req.status USING ERRCODE = '22023';
  END IF;

  -- The Dean sent it back after the Adviser approved: return it to the Dean.
  v_target := CASE
    WHEN v_req.status IN ('FOR_REVISION', 'REJECTED')
     AND v_req.adviser_decision = 'APPROVED'
     AND v_req.dean_decision IN ('REVISION', 'REJECTED')
    THEN 'DEAN_APPROVAL'
    ELSE 'CSC_ADVISER_APPROVAL'
  END;

  UPDATE public.budget_requests
  SET status = v_target,
      updated_at = now()
  WHERE id = p_proposal_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_budget_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_budget_request(UUID) TO authenticated;


-- Same notifications as before; only the Dean message differs when the
-- request comes back from revision instead of from the Adviser.
CREATE OR REPLACE FUNCTION public.ncf_trg_budget_request_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t TEXT := '"' || NEW.title || '" (' || NEW.department_code || ')';
  v_resubmitted BOOLEAN := TG_OP = 'UPDATE' AND OLD.status IN ('FOR_REVISION', 'REJECTED');
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'CSC_ADVISER_APPROVAL' THEN
      PERFORM public.ncf_notify_roles(NEW.department_code, ARRAY['csc_adviser'],
        'Budget request needs your approval', t || ' was submitted for Adviser approval.', 'budget_approvals');
    WHEN 'DEAN_APPROVAL' THEN
      IF v_resubmitted THEN
        PERFORM public.ncf_notify_roles(NEW.department_code, ARRAY['dean'],
          'Revised budget request needs your approval', t || ' was revised and resubmitted to you.', 'budget_approvals');
      ELSE
        PERFORM public.ncf_notify_roles(NEW.department_code, ARRAY['dean'],
          'Budget request needs your final approval', t || ' was approved by the Adviser and forwarded to you.', 'budget_approvals');
        PERFORM public.ncf_notify(NEW.requested_by,
          'Budget request approved by Adviser', t || ' was approved by the Adviser and is now with the Dean.', 'budget');
      END IF;
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

NOTIFY pgrst, 'reload schema';
