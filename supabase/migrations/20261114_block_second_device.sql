-- ==========================================================
-- Block a second device (no approval step)
--
-- Builds on 20261114_device_login_wait_longer.sql.
-- An account can only be logged in on one device at a time. If the account
-- is already in use on another device, a new sign-in is refused right away
-- and that new device is logged out. The owner gets a bell notification
-- ("Blocked sign-in on ...").
-- If the device that was using the account has been closed/offline for
-- 3 minutes (no "still here" signal), a new sign-in is allowed, so nobody
-- gets locked out after closing the browser without logging out.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.request_device_login(p_session_key TEXT, p_device TEXT DEFAULT NULL)
RETURNS TABLE (request_id UUID, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_active public.active_sessions;
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
     OR v_active.last_seen < now() - INTERVAL '3 minutes' THEN
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

  -- Another device is using the account: refuse this one.
  PERFORM public.ncf_notify_self('Blocked sign-in on ' || v_device,
    'Someone tried to sign in to your account on ' || v_device || ' at '
    || to_char(now() AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM')
    || ' while you were logged in, so it was blocked. If this was not you, change your password now.');
  RETURN QUERY SELECT NULL::UUID, 'blocked'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.request_device_login(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_device_login(TEXT, TEXT) TO authenticated;

-- Any request still waiting from the old approval flow is closed.
UPDATE public.device_login_requests SET status = 'expired', decided_at = now() WHERE status = 'pending';

NOTIFY pgrst, 'reload schema';
