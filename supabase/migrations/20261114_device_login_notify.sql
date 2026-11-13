-- ==========================================================
-- Bell notification for sign-ins from another device
--
-- Builds on 20261114_device_login_approval.sql (run that first).
-- The account owner now also gets a notification (bell) when:
--   * another device is waiting for approval ("Is this you?"), and
--   * another device got in because the first device was closed/offline.
-- So even if the first device was not open at that moment, the owner
-- sees it the next time they open the system.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

-- Notify the signed-in user themself (ncf_notify skips the caller).
CREATE OR REPLACE FUNCTION public.ncf_notify_self(p_title TEXT, p_body TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  BEGIN
    INSERT INTO public.notifications (recipient_id, title, body, link_tab)
    VALUES (auth.uid(), p_title, p_body, 'home');
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      PERFORM public.notify_recipient(auth.uid(), p_title, p_body, 'home');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'ncf_notify_self failed: %', SQLERRM;
    END;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.ncf_notify_self(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

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
  v_device TEXT := coalesce(nullif(left(p_device, 200), ''), 'another device');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in.' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_session_key), '') = '' THEN
    RAISE EXCEPTION 'A session key is required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_active FROM public.active_sessions WHERE user_id = v_uid FOR UPDATE;

  IF v_active.user_id IS NULL
     OR v_active.session_key = p_session_key
     OR v_active.last_seen < now() - INTERVAL '90 seconds' THEN
    -- Replacing a different (inactive) device: tell the owner.
    IF v_active.user_id IS NOT NULL AND v_active.session_key <> p_session_key THEN
      PERFORM public.ncf_notify_self('New sign-in on ' || v_device,
        'Your account was signed in on ' || v_device || ' at ' || to_char(now() AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM')
        || '. Your other device was logged out. If this was not you, change your password now.');
    END IF;
    INSERT INTO public.active_sessions (user_id, session_key, device, updated_at, last_seen)
    VALUES (v_uid, p_session_key, v_device, now(), now())
    ON CONFLICT (user_id) DO UPDATE
      SET session_key = EXCLUDED.session_key, device = EXCLUDED.device, updated_at = now(), last_seen = now();
    UPDATE public.device_login_requests SET status = 'expired', decided_at = now()
    WHERE user_id = v_uid AND status = 'pending';
    RETURN QUERY SELECT NULL::UUID, 'approved'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.device_login_requests (user_id, session_key, device)
  VALUES (v_uid, p_session_key, v_device)
  RETURNING id INTO v_id;
  PERFORM public.ncf_notify_self('Sign-in attempt on ' || v_device,
    'Someone is trying to sign in to your account on ' || v_device
    || '. Open the system on your current device to allow or block it. If this was not you, block it and change your password.');
  RETURN QUERY SELECT v_id, 'pending'::TEXT;
END;
$$;

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
    PERFORM public.ncf_notify_self('New sign-in on ' || coalesce(v_req.device, 'another device'),
      'Your account was signed in on ' || coalesce(v_req.device, 'another device')
      || ' because your other device did not answer. If this was not you, change your password now.');
    RETURN 'approved';
  END IF;
  RETURN 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.request_device_login(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_device_login(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_device_login(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_device_login(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
