-- ==========================================================
-- submit_budget_request(proposal_id)
--
-- Moves a Treasurer's budget request from DRAFT / FOR_REVISION to
-- CSC_ADVISER_APPROVAL so the Adviser receives it immediately.
--
-- Why: a plain UPDATE from the app could be silently filtered by RLS
-- (0 rows updated, no error), so the request looked submitted in the UI
-- but reverted to DRAFT after a page refresh.
--
-- Same pattern as approve_dean_decision / cast_council_vote:
-- SECURITY DEFINER bypasses RLS, so the role/ownership check below is
-- the real authorization gate.
--
-- Run once in Supabase Dashboard > SQL Editor.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.submit_budget_request(p_proposal_id UUID)
RETURNS public.budget_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_dept TEXT;
  v_row  public.budget_requests;
BEGIN
  SELECT role, department INTO v_role, v_dept
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'officer_treasurer' THEN
    RAISE EXCEPTION 'Only the Treasurer can submit budget requests.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.budget_requests
  SET status = 'CSC_ADVISER_APPROVAL',
      updated_at = now()
  WHERE id = p_proposal_id
    AND status IN ('DRAFT', 'FOR_REVISION')
    AND (requested_by = auth.uid() OR department_code = v_dept)
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Budget request not found, not in your department, or already submitted.'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_budget_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_budget_request(UUID) TO authenticated;

-- Make PostgREST pick up the new function right away.
NOTIFY pgrst, 'reload schema';
