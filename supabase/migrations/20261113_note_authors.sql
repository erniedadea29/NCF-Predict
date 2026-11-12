-- ==========================================================
-- get_note_authors(proposal_ids)
--
-- Name, role and officer seat of whoever wrote each Council Note on the
-- given budget requests, so the notes show "Matthew Salazar [Treasurer]"
-- instead of "Unknown user".
--
-- Why: RLS doesn't let users read other people's profiles, so the app
-- could only label notes written in the current browser session.
-- SECURITY DEFINER returns ONLY these display fields, and only for notes
-- on requests the caller is allowed to see (same department, or admin).
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.get_note_authors(p_proposal_ids UUID[])
RETURNS TABLE (note_id UUID, author_name TEXT, author_role TEXT, author_position TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT role, department FROM public.profiles WHERE id = auth.uid()
  )
  SELECT n.id, p.full_name, p.role, p.officer_position
  FROM public.proposal_notes n
  JOIN public.budget_requests r ON r.id = n.proposal_id
  LEFT JOIN public.profiles p ON p.id = n.author_id
  CROSS JOIN me
  WHERE n.proposal_id = ANY (p_proposal_ids)
    AND (me.role IN ('admin', 'super_admin') OR me.department = r.department_code);
$$;

REVOKE ALL ON FUNCTION public.get_note_authors(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_note_authors(UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
