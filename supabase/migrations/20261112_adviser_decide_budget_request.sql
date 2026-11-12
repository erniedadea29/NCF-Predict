-- ==========================================================
-- adviser_decide_budget_request(proposal_id, decision, remarks)
--
-- Lets the CSC Adviser approve (forward to Dean), request revision, or
-- reject a budget request that is at CSC_ADVISER_APPROVAL.
--
-- Why: the app used a plain UPDATE on budget_requests, which RLS blocks for
-- advisers, so clicking Approve / Request Revision / Reject did nothing.
-- Same pattern as approve_dean_decision: SECURITY DEFINER + role check.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.adviser_decide_budget_request(
  p_proposal_id UUID,
  p_decision TEXT,
  p_remarks TEXT DEFAULT NULL
)
RETURNS public.budget_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role   TEXT;
  v_dept   TEXT;
  v_status TEXT;
  v_row    public.budget_requests;
BEGIN
  SELECT role, department INTO v_role, v_dept
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'csc_adviser' THEN
    RAISE EXCEPTION 'Only the CSC Adviser can decide at this stage.'
      USING ERRCODE = '42501';
  END IF;

  v_status := CASE p_decision
    WHEN 'APPROVED' THEN 'DEAN_APPROVAL'
    WHEN 'REVISION' THEN 'FOR_REVISION'
    WHEN 'REJECTED' THEN 'REJECTED'
  END;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Invalid decision: %. Use APPROVED, REVISION or REJECTED.', p_decision
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.budget_requests
  SET status = v_status,
      adviser_id = auth.uid(),
      adviser_decision = p_decision,
      adviser_remarks = p_remarks,
      adviser_decided_at = now(),
      updated_at = now()
  WHERE id = p_proposal_id
    AND status = 'CSC_ADVISER_APPROVAL'
    -- Advisers only decide on their own department's requests.
    AND (v_dept IS NULL OR department_code = v_dept)
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Budget request not found, not in your department, or not awaiting Adviser approval.'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.adviser_decide_budget_request(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adviser_decide_budget_request(UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
