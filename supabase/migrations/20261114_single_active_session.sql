-- ==========================================================
-- One device at a time per account
--
-- Each account may be signed in on only ONE device at a time. When the
-- account signs in on a new device, that device becomes the active one
-- and every other device is signed out within seconds (the app watches
-- this table) and can no longer refresh its login (the app also revokes
-- the other sessions through Supabase Auth).
-- Tabs of the same browser share one device key, so several tabs are fine.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.active_sessions (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_key TEXT NOT NULL,
  device      TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- A user can only read their own row; writes go through claim_active_session().
DROP POLICY IF EXISTS "ncf active session read own" ON public.active_sessions;
CREATE POLICY "ncf active session read own"
  ON public.active_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Make this device the account's active device.
CREATE OR REPLACE FUNCTION public.claim_active_session(p_session_key TEXT, p_device TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in.' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_session_key), '') = '' THEN
    RAISE EXCEPTION 'A session key is required.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.active_sessions (user_id, session_key, device, updated_at)
  VALUES (auth.uid(), p_session_key, left(p_device, 200), now())
  ON CONFLICT (user_id) DO UPDATE
    SET session_key = EXCLUDED.session_key, device = EXCLUDED.device, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.claim_active_session(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_active_session(TEXT, TEXT) TO authenticated;

-- Live updates so the old device is signed out right away.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'active_sessions'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.active_sessions;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
