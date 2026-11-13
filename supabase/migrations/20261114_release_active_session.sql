-- ==========================================================
-- release_active_session(key): free the account on log out
--
-- Builds on 20261114_device_login_approval.sql.
-- When a device logs out, it is no longer "the device using the account".
-- Without this, signing in again within 90 seconds (on the same or another
-- device) was treated as a second device and had to wait for approval
-- from a device that had already logged out.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.release_active_session(p_session_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.active_sessions
  WHERE user_id = auth.uid() AND session_key = p_session_key;
END;
$$;

REVOKE ALL ON FUNCTION public.release_active_session(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_active_session(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
