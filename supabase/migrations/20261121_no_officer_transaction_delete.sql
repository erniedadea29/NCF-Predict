-- ==========================================================
-- Officers can no longer delete transactions
--
-- Transactions are the department's financial record (collections,
-- releases, expenses, budget returns). Deleting one silently changes the
-- department's funds and leaves no audit trail, so only the Admin and the
-- Super Admin may delete a transaction. Officers can still Archive one
-- (it stays in the record and can be restored).
--
-- A BEFORE DELETE trigger enforces this for every signed-in user,
-- whatever the table's RLS policies allow. Scripts run in the Supabase
-- SQL Editor (no signed-in user) are not affected.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.ncf_block_transaction_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- SQL Editor / service scripts run without a signed-in user.
  IF auth.uid() IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IN ('admin', 'super_admin') THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Transactions cannot be deleted. Archive it instead, or ask the Admin.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS ncf_block_transaction_delete ON public.transactions;
CREATE TRIGGER ncf_block_transaction_delete
  BEFORE DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.ncf_block_transaction_delete();
