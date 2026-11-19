-- ==========================================================
-- Liquidation pre-audit by the department Auditor
--
-- New step in the liquidation flow:
--   Treasurer submits  ->  AUDITOR PRE-AUDIT  ->  Adviser  ->  Dean (Audited)
--
-- * When a Treasurer submits (or resubmits) a liquidation report and the
--   department has an active Auditor (council member whose officer position
--   is "Auditor"), the report goes to status PENDING_AUDITOR first.
--   Departments without an Auditor keep the old flow (straight to Adviser).
-- * The Auditor checks the receipts and amounts and either:
--     VERIFIED          -> PENDING_ADVISER (Adviser is notified)
--     NEEDS_CORRECTION  -> FOR_REVISION (Treasurer is notified; remarks required)
-- * The Auditor's decision and remarks are kept on the report
--   (pre_audit_by, pre_audit_decision, pre_audit_remarks, pre_audit_at).
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

ALTER TABLE public.liquidation_reports
  ADD COLUMN IF NOT EXISTS pre_audit_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS pre_audit_decision TEXT,
  ADD COLUMN IF NOT EXISTS pre_audit_remarks TEXT,
  ADD COLUMN IF NOT EXISTS pre_audit_at TIMESTAMPTZ;

-- Allow the new status. Any existing CHECK on status is replaced by one that
-- keeps every status already in use and adds PENDING_AUDITOR.
DO $$
DECLARE
  c RECORD;
  v_list TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.liquidation_reports'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.liquidation_reports DROP CONSTRAINT %I', c.conname);
  END LOOP;

  SELECT string_agg(quote_literal(s), ', ') INTO v_list
  FROM (
    SELECT unnest(ARRAY['Draft', 'draft', 'Submitted', 'PENDING_AUDITOR', 'PENDING_ADVISER', 'PENDING_DEAN',
                        'FOR_REVISION', 'Audited', 'Rejected', 'Closed']) AS s
    UNION
    SELECT DISTINCT status FROM public.liquidation_reports WHERE status IS NOT NULL
  ) x;

  EXECUTE 'ALTER TABLE public.liquidation_reports ADD CONSTRAINT liquidation_reports_status_check CHECK (status IN (' || v_list || '))';
END;
$$;

-- The active Auditor of a department (NULL when the seat is empty).
CREATE OR REPLACE FUNCTION public.ncf_department_auditor(p_department TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id FROM public.profiles p
  WHERE p.role = 'council_member'
    AND lower(trim(coalesce(p.officer_position, ''))) = 'auditor'
    AND p.department = p_department
    AND coalesce((to_jsonb(p) ->> 'is_active')::boolean, true)
  ORDER BY p.created_at
  LIMIT 1;
$$;

-- Best-effort notification (never blocks the main action).
CREATE OR REPLACE FUNCTION public.ncf_pre_audit_notify(p_recipient UUID, p_title TEXT, p_body TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_recipient IS NULL THEN RETURN; END IF;
  BEGIN
    INSERT INTO public.notifications (recipient_id, title, body, link_tab)
    VALUES (p_recipient, p_title, p_body, 'liquidation_reports');
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      PERFORM public.notify_recipient(p_recipient, p_title, p_body, 'liquidation_reports');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'pre-audit notification failed: %', SQLERRM;
    END;
  END;
END;
$$;

-- Route a newly submitted (or resubmitted) report to the Auditor first.
CREATE OR REPLACE FUNCTION public.ncf_trg_liquidation_pre_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auditor UUID;
BEGIN
  IF NEW.status = 'PENDING_ADVISER'
     AND (TG_OP = 'INSERT' OR OLD.status IN ('FOR_REVISION', 'Draft', 'draft', 'Submitted', 'Rejected')) THEN
    v_auditor := public.ncf_department_auditor(NEW.department_code);
    IF v_auditor IS NOT NULL THEN
      NEW.status := 'PENDING_AUDITOR';
      NEW.pre_audit_by := NULL;
      NEW.pre_audit_decision := NULL;
      NEW.pre_audit_remarks := NULL;
      NEW.pre_audit_at := NULL;
      PERFORM public.ncf_pre_audit_notify(v_auditor,
        'Liquidation report for pre-audit',
        'A liquidation report for "' || coalesce(NEW.event_name, 'a budget') || '" was submitted. Check the receipts and amounts, then verify it or send it back for correction.');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ncf_liquidation_pre_audit ON public.liquidation_reports;
CREATE TRIGGER ncf_liquidation_pre_audit
  BEFORE INSERT OR UPDATE OF status ON public.liquidation_reports
  FOR EACH ROW EXECUTE FUNCTION public.ncf_trg_liquidation_pre_audit();

-- The Auditor's decision.
CREATE OR REPLACE FUNCTION public.auditor_review_liquidation(
  p_liquidation_id UUID,
  p_decision TEXT,
  p_remarks TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me      public.profiles;
  v_rep     public.liquidation_reports;
  v_status  TEXT;
  v_treas   UUID;
  r         RECORD;
BEGIN
  SELECT * INTO v_me FROM public.profiles WHERE id = auth.uid();
  IF v_me.id IS NULL OR v_me.role <> 'council_member'
     OR lower(trim(coalesce(v_me.officer_position, ''))) <> 'auditor' THEN
    RAISE EXCEPTION 'Only the department Auditor can pre-audit a liquidation report.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_rep FROM public.liquidation_reports WHERE id = p_liquidation_id FOR UPDATE;
  IF v_rep.id IS NULL THEN
    RAISE EXCEPTION 'Liquidation report not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_me.department IS NOT NULL AND v_rep.department_code IS DISTINCT FROM v_me.department THEN
    RAISE EXCEPTION 'You can only pre-audit liquidation reports of your own department.' USING ERRCODE = '42501';
  END IF;
  IF v_rep.status <> 'PENDING_AUDITOR' THEN
    RAISE EXCEPTION 'This liquidation report is not waiting for pre-audit (status: %).', v_rep.status USING ERRCODE = '22023';
  END IF;
  IF p_decision NOT IN ('VERIFIED', 'NEEDS_CORRECTION') THEN
    RAISE EXCEPTION 'Decision must be VERIFIED or NEEDS_CORRECTION.' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'NEEDS_CORRECTION' AND coalesce(trim(p_remarks), '') = '' THEN
    RAISE EXCEPTION 'Explain what the Treasurer needs to correct.' USING ERRCODE = '22023';
  END IF;

  v_status := CASE WHEN p_decision = 'VERIFIED' THEN 'PENDING_ADVISER' ELSE 'FOR_REVISION' END;

  UPDATE public.liquidation_reports
  SET status = v_status,
      pre_audit_by = v_me.id,
      pre_audit_decision = p_decision,
      pre_audit_remarks = nullif(trim(p_remarks), ''),
      pre_audit_at = now(),
      updated_at = now()
  WHERE id = v_rep.id;

  SELECT requested_by INTO v_treas FROM public.budget_requests WHERE id = v_rep.proposal_id;

  IF p_decision = 'VERIFIED' THEN
    PERFORM public.ncf_pre_audit_notify(v_treas, 'Liquidation verified by the Auditor',
      'Your liquidation report for "' || coalesce(v_rep.event_name, 'your budget') || '" passed pre-audit and is now with the Adviser.');
    FOR r IN
      SELECT id FROM public.profiles
      WHERE role = 'csc_adviser' AND (department = v_rep.department_code OR department IS NULL)
        AND coalesce((to_jsonb(profiles) ->> 'is_active')::boolean, true)
    LOOP
      PERFORM public.ncf_pre_audit_notify(r.id, 'Liquidation report ready for review',
        'The Auditor verified the liquidation report for "' || coalesce(v_rep.event_name, 'a budget') || '". It is waiting for your review.');
    END LOOP;
  ELSE
    PERFORM public.ncf_pre_audit_notify(v_treas, 'Liquidation needs correction',
      'The Auditor sent back your liquidation report for "' || coalesce(v_rep.event_name, 'your budget') || '": ' || trim(p_remarks));
  END IF;

  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.auditor_review_liquidation(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditor_review_liquidation(UUID, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.ncf_department_auditor(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncf_department_auditor(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.ncf_pre_audit_notify(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
