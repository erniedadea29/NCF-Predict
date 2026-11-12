-- ==========================================================
-- Editable budget requests (Draft / For Revision / Rejected)
--
-- 1. update_budget_request(...): the Treasurer who filed a request can
--    change its title, description, notes and line items while it is
--    DRAFT, FOR_REVISION or REJECTED. Editing a REJECTED request moves it
--    to FOR_REVISION so it can be resubmitted. Line items are replaced as
--    a whole and total_amount is recomputed from them.
--
-- 2. submit_budget_request(...): now also accepts REJECTED requests, so a
--    rejected request can be resubmitted to the Adviser.
--
-- Same pattern as the other workflow RPCs: SECURITY DEFINER + role and
-- ownership checks (RLS blocks these writes when done directly).
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.update_budget_request(
  p_proposal_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_treasurer_notes TEXT,
  p_items JSONB
)
RETURNS public.budget_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role  TEXT;
  v_dept  TEXT;
  v_req   public.budget_requests;
  v_total NUMERIC(12,2);
  v_row   public.budget_requests;
BEGIN
  SELECT role, department INTO v_role, v_dept FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'officer_treasurer' THEN
    RAISE EXCEPTION 'Only the Treasurer can edit budget requests.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req FROM public.budget_requests WHERE id = p_proposal_id FOR UPDATE;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Budget request not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_req.requested_by = auth.uid() OR (v_req.requested_by IS NULL AND v_req.department_code = v_dept)) THEN
    RAISE EXCEPTION 'Only the Treasurer who filed this request can edit it.' USING ERRCODE = '42501';
  END IF;
  IF v_req.status NOT IN ('DRAFT', 'FOR_REVISION', 'REJECTED') THEN
    RAISE EXCEPTION 'Only Draft, For Revision or Rejected requests can be edited (this one is %).', v_req.status
      USING ERRCODE = '22023';
  END IF;
  IF coalesce(trim(p_title), '') = '' THEN
    RAISE EXCEPTION 'A title is required.' USING ERRCODE = '22023';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required.' USING ERRCODE = '22023';
  END IF;

  -- Replace the line items.
  DELETE FROM public.budget_request_items WHERE request_id = p_proposal_id;
  INSERT INTO public.budget_request_items (request_id, description, category, quantity, unit_cost, amount, remarks)
  SELECT p_proposal_id,
         coalesce(nullif(trim(x.description), ''), 'Item'),
         coalesce(nullif(trim(x.category), ''), 'General'),
         greatest(coalesce(x.quantity, 0), 0),
         greatest(coalesce(x.unit_cost, 0), 0),
         round(greatest(coalesce(x.quantity, 0), 0) * greatest(coalesce(x.unit_cost, 0), 0), 2),
         nullif(trim(x.remarks), '')
  FROM jsonb_to_recordset(p_items) AS x(description TEXT, category TEXT, quantity NUMERIC, unit_cost NUMERIC, remarks TEXT);

  SELECT coalesce(sum(amount), 0) INTO v_total FROM public.budget_request_items WHERE request_id = p_proposal_id;

  UPDATE public.budget_requests
  SET title = trim(p_title),
      budget_description = p_description,
      treasurer_notes = p_treasurer_notes,
      total_amount = v_total,
      status = CASE WHEN status = 'REJECTED' THEN 'FOR_REVISION' ELSE status END,
      updated_at = now()
  WHERE id = p_proposal_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_budget_request(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_budget_request(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;


-- Resubmission now also allowed from REJECTED.
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
    AND status IN ('DRAFT', 'FOR_REVISION', 'REJECTED')
    AND (requested_by = auth.uid() OR department_code = v_dept)
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Budget request not found, not in your department, or already submitted.'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_budget_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_budget_request(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
