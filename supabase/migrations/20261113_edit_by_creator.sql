-- ==========================================================
-- Whoever CREATED a budget request can edit and resubmit it
--
-- Replaces update_budget_request and submit_budget_request so the user
-- who filed the request (any officer role: Treasurer, Governor, Council
-- Member...) can edit it while it is DRAFT, FOR_REVISION or REJECTED and
-- (re)submit it. Requests with no recorded creator fall back to a
-- Treasurer of the same department.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

-- True when the current user may manage (edit / submit) this request.
CREATE OR REPLACE FUNCTION public.ncf_can_manage_request(p_req public.budget_requests)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_req.requested_by = auth.uid()
    OR (
      p_req.requested_by IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'officer_treasurer' AND department = p_req.department_code
      )
    );
$$;

REVOKE ALL ON FUNCTION public.ncf_can_manage_request(public.budget_requests) FROM PUBLIC, anon, authenticated;


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
  v_req   public.budget_requests;
  v_total NUMERIC(12,2);
  v_row   public.budget_requests;
BEGIN
  SELECT * INTO v_req FROM public.budget_requests WHERE id = p_proposal_id FOR UPDATE;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Budget request not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.ncf_can_manage_request(v_req) THEN
    RAISE EXCEPTION 'Only the person who created this request can edit it.' USING ERRCODE = '42501';
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


CREATE OR REPLACE FUNCTION public.submit_budget_request(p_proposal_id UUID)
RETURNS public.budget_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.budget_requests;
  v_row public.budget_requests;
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

  UPDATE public.budget_requests
  SET status = 'CSC_ADVISER_APPROVAL',
      updated_at = now()
  WHERE id = p_proposal_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_budget_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_budget_request(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
