-- ==========================================================
-- create_budget_request(...): Governor / Vice Governor can draft too
--
-- The app inserted budget requests with a plain INSERT, which RLS only
-- allows for the Treasurer, so the Governor and Vice Governor could not
-- create a budget proposal. This SECURITY DEFINER function creates the
-- request, its line items and the first note in one transaction.
--
-- Who may create: Treasurer / Assistant Treasurer (officer_treasurer),
-- Governor / Vice Governor (officer_governor) and council members,
-- but NOT the Auditor (view and audit only).
-- The request is filed under the creator's own department.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.create_budget_request(
  p_title TEXT,
  p_description TEXT,
  p_department_code TEXT,
  p_requested_by_name TEXT,
  p_treasurer_notes TEXT,
  p_fiscal_year TEXT,
  p_semester_id INTEGER,
  p_items JSONB
)
RETURNS public.budget_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     TEXT;
  v_dept     TEXT;
  v_position TEXT;
  v_row      public.budget_requests;
  v_total    NUMERIC(12,2);
BEGIN
  SELECT role, department, officer_position INTO v_role, v_dept, v_position
  FROM public.profiles WHERE id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('officer_treasurer', 'officer_governor', 'council_member') THEN
    RAISE EXCEPTION 'Only council officers (Treasurer, Governor, Vice Governor) can create a budget request.'
      USING ERRCODE = '42501';
  END IF;
  IF lower(trim(coalesce(v_position, ''))) = 'auditor' THEN
    RAISE EXCEPTION 'The Auditor can only audit and view budget requests, not create them.'
      USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_title), '') = '' THEN
    RAISE EXCEPTION 'A title is required.' USING ERRCODE = '22023';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.budget_requests (
    title, budget_description, department_code, requested_by, requested_by_name,
    treasurer_notes, fiscal_year, semester_id, status, total_amount
  ) VALUES (
    trim(p_title), p_description, coalesce(v_dept, p_department_code), auth.uid(), p_requested_by_name,
    p_treasurer_notes, coalesce(nullif(trim(p_fiscal_year), ''), '2024-25'), p_semester_id, 'DRAFT', 0
  )
  RETURNING * INTO v_row;

  INSERT INTO public.budget_request_items (request_id, description, category, quantity, unit_cost, amount, remarks)
  SELECT v_row.id,
         coalesce(nullif(trim(x.description), ''), 'Item'),
         coalesce(nullif(trim(x.category), ''), 'General'),
         greatest(coalesce(x.quantity, 0), 0),
         greatest(coalesce(x.unit_cost, 0), 0),
         round(greatest(coalesce(x.quantity, 0), 0) * greatest(coalesce(x.unit_cost, 0), 0), 2),
         nullif(trim(x.remarks), '')
  FROM jsonb_to_recordset(p_items) AS x(description TEXT, category TEXT, quantity NUMERIC, unit_cost NUMERIC, remarks TEXT);

  SELECT coalesce(sum(amount), 0) INTO v_total FROM public.budget_request_items WHERE request_id = v_row.id;

  UPDATE public.budget_requests SET total_amount = v_total WHERE id = v_row.id
  RETURNING * INTO v_row;

  INSERT INTO public.proposal_notes (proposal_id, author_id, note_content, is_official)
  VALUES (v_row.id, auth.uid(), coalesce(nullif(trim(p_treasurer_notes), ''), 'Draft budget proposal created.'), true);

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_budget_request(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_budget_request(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
