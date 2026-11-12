-- ==========================================================
-- get_budget_request_signatories(proposal_id)
--
-- Names printed on a budget request's signature blocks:
--   governor : the ACTIVE Governor of the request's department: role
--              officer_governor (the "Governor" badge in Manage Users) or
--              officer_position 'Governor', never the Vice Governor;
--              prefers the one in the requester's course
--   adviser  : the Adviser who decided it, else the department's Adviser
--   dean     : the Dean who decided it, else the department's Dean
--
-- Why: RLS doesn't let users read other people's profiles, so the
-- printable form couldn't show approvers' names (it showed placeholder
-- names, then blanks). SECURITY DEFINER returns ONLY these three names,
-- and only to someone allowed to see that department's request.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.get_budget_request_signatories(p_proposal_id UUID)
RETURNS TABLE (governor TEXT, adviser TEXT, dean TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req       public.budget_requests;
  v_my_role   TEXT;
  v_my_dept   TEXT;
  v_course    public.profiles.course_id%TYPE;
BEGIN
  SELECT role, department INTO v_my_role, v_my_dept
  FROM public.profiles WHERE id = auth.uid();

  IF v_my_role IS NULL THEN
    RAISE EXCEPTION 'Not signed in.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req FROM public.budget_requests WHERE id = p_proposal_id;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Budget request not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Course of the Treasurer who filed the request (officers are course-scoped).
  SELECT p.course_id INTO v_course FROM public.profiles p WHERE p.id = v_req.requested_by;

  -- Same department, or a system-wide admin.
  IF v_my_role NOT IN ('admin', 'super_admin') AND v_my_dept IS DISTINCT FROM v_req.department_code THEN
    RAISE EXCEPTION 'Not allowed to view this request.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT p.full_name FROM public.profiles p
      -- Governor by role (what Manage Users shows) or by seat; never the Vice Governor.
      WHERE (p.role = 'officer_governor' OR p.officer_position = 'Governor')
        AND p.officer_position IS DISTINCT FROM 'Vice Governor'
        AND p.department = v_req.department_code
        AND COALESCE(p.is_active, true)
      -- Prefer the seated Governor, then the one in the requester's own course.
      ORDER BY (p.officer_position = 'Governor') DESC,
               (v_course IS NOT NULL AND p.course_id = v_course) DESC,
               p.updated_at DESC
      LIMIT 1),
    COALESCE(
      (SELECT p.full_name FROM public.profiles p WHERE p.id = v_req.adviser_id),
      (SELECT p.full_name FROM public.profiles p
        WHERE p.department = v_req.department_code
          AND p.role = 'csc_adviser'
          AND COALESCE(p.is_active, true)
        ORDER BY p.created_at
        LIMIT 1)),
    COALESCE(
      (SELECT p.full_name FROM public.profiles p WHERE p.id = v_req.dean_id),
      (SELECT p.full_name FROM public.profiles p
        WHERE p.department = v_req.department_code
          AND p.role = 'dean'
          AND COALESCE(p.is_active, true)
        ORDER BY p.created_at
        LIMIT 1));
END;
$$;

REVOKE ALL ON FUNCTION public.get_budget_request_signatories(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_budget_request_signatories(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
