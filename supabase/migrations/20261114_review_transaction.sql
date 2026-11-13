-- ==========================================================
-- review_transaction(...): Dean / CSC Adviser approve or reject
-- Pending transactions of their own department
--
-- Transactions added by officers start as 'Pending' and only count in the
-- department's funds once approved. Only the Admin could approve them, but
-- the Admin is system-management only and has no Transactions tab, so
-- nobody could approve. This function lets the Dean and the CSC Adviser
-- (own department) and Admin / Super Admin (any department) approve or
-- reject a Pending transaction.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.review_transaction(
  p_transaction_id UUID,
  p_decision TEXT,
  p_remarks TEXT DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_dept TEXT;
  v_tx   public.transactions;
BEGIN
  IF p_decision NOT IN ('Completed', 'Rejected') THEN
    RAISE EXCEPTION 'Decision must be Completed or Rejected.' USING ERRCODE = '22023';
  END IF;

  SELECT role, department INTO v_role, v_dept
  FROM public.profiles WHERE id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('dean', 'csc_adviser', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only the Dean or the CSC Adviser can approve transactions.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_role IN ('dean', 'csc_adviser') AND v_dept IS DISTINCT FROM v_tx.department_code THEN
    RAISE EXCEPTION 'You can only review transactions of your own department.' USING ERRCODE = '42501';
  END IF;
  IF v_tx.status NOT IN ('Pending', 'Processing') THEN
    RAISE EXCEPTION 'This transaction was already reviewed (%).', v_tx.status USING ERRCODE = '22023';
  END IF;

  UPDATE public.transactions
  SET status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      notes = COALESCE(NULLIF(trim(p_remarks), ''), notes)
  WHERE id = p_transaction_id
  RETURNING * INTO v_tx;

  RETURN v_tx;
END;
$$;

REVOKE ALL ON FUNCTION public.review_transaction(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_transaction(UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
