-- ==========================================================
-- TEMPORARY: let the Super Admin delete accounts that have history
--
-- delete_user_account(...) refuses accounts with activity on record. This
-- adds force_delete_user_account(...), which the app uses while the
-- ALLOW_DELETE_WITH_HISTORY switch (src/context/AppContext.tsx) is on.
-- The original delete_user_account is NOT changed, so going back is just
-- turning the switch off (optionally: DROP FUNCTION force_delete_user_account).
--
-- What happens to the deleted user's records:
--   * Records that can exist without an owner (transactions, budget
--     requests, liquidation reports, reimbursements, SAF records,
--     events, ...) are KEPT; their link to the deleted user is cleared.
--   * Records that must have an owner (e.g. council notes / votes the
--     user authored, their own notifications) are DELETED with the user.
--   * A linked student record is kept and simply unlinked from the login.
--
-- Safety: Super Admin only; can't delete yourself or another Super Admin.
-- Everything runs in one transaction: any failure changes nothing.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.force_delete_user_account(p_profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_target_role TEXT;
  fk RECORD;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only the Super Admin can permanently delete an account.' USING ERRCODE = '42501';
  END IF;
  IF p_profile_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account.' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_profile_id;
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'Account not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_target_role = 'super_admin' THEN
    RAISE EXCEPTION 'A Super Admin account cannot be deleted.' USING ERRCODE = '42501';
  END IF;

  -- Every single-column foreign key in the public schema that points at this
  -- user (via profiles.id or auth.users.id): clear it if the column allows
  -- NULL, otherwise delete the rows that must have an owner.
  FOR fk IN
    SELECT
      c.conrelid::regclass AS tbl,
      a.attname            AS col,
      a.attnotnull         AS not_null
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE c.contype = 'f'
      AND array_length(c.conkey, 1) = 1
      AND c.confrelid IN ('public.profiles'::regclass, 'auth.users'::regclass)
      AND ns.nspname = 'public'
      AND c.conrelid <> 'public.profiles'::regclass
  LOOP
    IF fk.not_null THEN
      EXECUTE format('DELETE FROM %s WHERE %I = $1', fk.tbl, fk.col) USING p_profile_id;
    ELSE
      EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = $1', fk.tbl, fk.col, fk.col) USING p_profile_id;
    END IF;
  END LOOP;

  -- Remove the login; the profile row goes with it (ON DELETE CASCADE).
  DELETE FROM auth.users WHERE id = p_profile_id;
  -- In case the profile wasn't linked to an auth user.
  DELETE FROM public.profiles WHERE id = p_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.force_delete_user_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.force_delete_user_account(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
