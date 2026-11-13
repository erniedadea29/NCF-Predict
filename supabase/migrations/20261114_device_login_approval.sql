-- ==========================================================
-- Approve a new device: "Was this you?"
--
-- Builds on 20261114_single_active_session.sql (run that first).
-- When an account signs in on a NEW device while another device is
-- actively using it, the new device waits and the active device is asked
-- "Is this you?":
--   * Allow -> the new device becomes the active one, the old one is
--              signed out;
--   * Deny  -> the new device is signed out.
-- If the active device is not open any more (no heartbeat for 90 seconds),
-- the new device is let in automatically, so nobody gets locked out.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

ALTER TABLE public.active_sessions
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.device_login_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_key TEXT NOT NULL,
  device      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS device_login_requests_user_idx ON public.device_login_requests (user_id, created_at DESC);

ALTER TABLE public.device_login_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ncf device requests read own" ON public.device_login_requests;
CREATE POLICY "ncf device requests read own"
  ON public.device_login_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- The active device says "I'm still here" every ~20 seconds.
CREATE OR REPLACE FUNCTION public.heartbeat_active_session(p_session_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.active_sessions SET last_seen = now()
  WHERE user_id = auth.uid() AND session_key = p_session_key;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

-- A device asks to become the active one.
-- Returns: status 'approved' (go ahead) or 'pending' (wait for the other device).
CREATE OR REPLACE FUNCTION public.request_device_login(p_session_key TEXT, p_device TEXT DEFAULT NULL)
RETURNS TABLE (request_id UUID, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_active public.active_sessions;
  v_id     UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in.' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_session_key), '') = '' THEN
    RAISE EXCEPTION 'A session key is required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_active FROM public.active_sessions WHERE user_id = v_uid FOR UPDATE;

  -- No other device, the same device, or the other device is gone: let in.
  IF v_active.user_id IS NULL
     OR v_active.session_key = p_session_key
     OR v_active.last_seen < now() - INTERVAL '90 seconds' THEN
    INSERT INTO public.active_sessions (user_id, session_key, device, updated_at, last_seen)
    VALUES (v_uid, p_session_key, left(p_device, 200), now(), now())
    ON CONFLICT (user_id) DO UPDATE
      SET session_key = EXCLUDED.session_key, device = EXCLUDED.device, updated_at = now(), last_seen = now();
    UPDATE public.device_login_requests SET status = 'expired', decided_at = now()
    WHERE user_id = v_uid AND status = 'pending';
    RETURN QUERY SELECT NULL::UUID, 'approved'::TEXT;
    RETURN;
  END IF;

  -- Another device is in use: ask it.
  INSERT INTO public.device_login_requests (user_id, session_key, device)
  VALUES (v_uid, p_session_key, left(p_device, 200))
  RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, 'pending'::TEXT;
END;
$$;

-- The waiting device checks its request. If the active device went away
-- meanwhile, it is let in.
CREATE OR REPLACE FUNCTION public.check_device_login(p_request_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req    public.device_login_requests;
  v_active public.active_sessions;
BEGIN
  SELECT * INTO v_req FROM public.device_login_requests
  WHERE id = p_request_id AND user_id = auth.uid() FOR UPDATE;
  IF v_req.id IS NULL THEN
    RETURN 'denied';
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN v_req.status;
  END IF;

  SELECT * INTO v_active FROM public.active_sessions WHERE user_id = v_req.user_id FOR UPDATE;
  IF v_active.user_id IS NULL OR v_active.last_seen < now() - INTERVAL '90 seconds' THEN
    UPDATE public.active_sessions
    SET session_key = v_req.session_key, device = v_req.device, updated_at = now(), last_seen = now()
    WHERE user_id = v_req.user_id;
    IF NOT FOUND THEN
      INSERT INTO public.active_sessions (user_id, session_key, device, updated_at, last_seen)
      VALUES (v_req.user_id, v_req.session_key, v_req.device, now(), now());
    END IF;
    UPDATE public.device_login_requests SET status = 'approved', decided_at = now() WHERE id = v_req.id;
    RETURN 'approved';
  END IF;
  RETURN 'pending';
END;
$$;

-- The active device answers "Is this you?". Only the device holding the
-- active session key can answer.
CREATE OR REPLACE FUNCTION public.decide_device_login(p_request_id UUID, p_my_session_key TEXT, p_allow BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req    public.device_login_requests;
  v_active public.active_sessions;
BEGIN
  SELECT * INTO v_req FROM public.device_login_requests
  WHERE id = p_request_id AND user_id = auth.uid() FOR UPDATE;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Request not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN v_req.status;
  END IF;

  SELECT * INTO v_active FROM public.active_sessions WHERE user_id = v_req.user_id FOR UPDATE;
  IF v_active.user_id IS NULL OR v_active.session_key <> p_my_session_key THEN
    RAISE EXCEPTION 'Only the device currently using the account can answer.' USING ERRCODE = '42501';
  END IF;

  IF p_allow THEN
    UPDATE public.active_sessions
    SET session_key = v_req.session_key, device = v_req.device, updated_at = now(), last_seen = now()
    WHERE user_id = v_req.user_id;
    UPDATE public.device_login_requests SET status = 'approved', decided_at = now() WHERE id = v_req.id;
    RETURN 'approved';
  END IF;

  UPDATE public.device_login_requests SET status = 'denied', decided_at = now() WHERE id = v_req.id;
  RETURN 'denied';
END;
$$;

REVOKE ALL ON FUNCTION public.heartbeat_active_session(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_device_login(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_device_login(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_device_login(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.heartbeat_active_session(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_device_login(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_device_login(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_device_login(UUID, TEXT, BOOLEAN) TO authenticated;

-- The old "claim" no longer bypasses the approval: it now only works when
-- no other device is actively using the account.
CREATE OR REPLACE FUNCTION public.claim_active_session(p_session_key TEXT, p_device TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT r.status INTO v_status FROM public.request_device_login(p_session_key, p_device) r;
  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'Another device is using this account. Approve this device from it first.' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Live updates for the "Is this you?" prompt.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'device_login_requests'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.device_login_requests;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
