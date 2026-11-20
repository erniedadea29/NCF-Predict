-- ==========================================================
-- Employee ID for Employee accounts
--
-- * profiles.employee_id: format 00-00000 (two digits, a dash, five
--   digits), unique across all accounts.
-- * check_employee_id_available(id): used by the Register page before
--   sign-up (callable while signed out), like the Student ID check.
-- * set_my_employee_id(id): saves the ID on the signed-in user's own
--   profile right after the email code is verified. When no ID is passed
--   it uses the one stored in the sign-up data (auth user metadata).
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_employee_id_unique
  ON public.profiles (employee_id) WHERE employee_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_employee_id_available(p_employee_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE employee_id = trim(p_employee_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.set_my_employee_id(p_employee_id TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id  TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in.' USING ERRCODE = '42501';
  END IF;

  v_id := nullif(trim(coalesce(
    p_employee_id,
    (SELECT raw_user_meta_data ->> 'employee_id' FROM auth.users WHERE id = v_uid)
  )), '');
  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_id !~ '^[0-9]{2}-[0-9]{5}$' THEN
    RAISE EXCEPTION 'Employee ID must be in the format 00-00000.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE employee_id = v_id AND id <> v_uid) THEN
    RAISE EXCEPTION 'Employee ID "%" is already taken.', v_id USING ERRCODE = '23505';
  END IF;

  UPDATE public.profiles SET employee_id = v_id WHERE id = v_uid;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.check_employee_id_available(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_employee_id_available(TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.set_my_employee_id(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_employee_id(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
