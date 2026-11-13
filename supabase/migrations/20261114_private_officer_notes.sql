-- ==========================================================
-- Budget proposal notes: Group chat + Officers-only (private)
--
-- Notes on a budget request are now in two threads:
--   * visibility = 'all'      -> group chat: Adviser, Dean and officers
--   * visibility = 'officers' -> private: council officers only
--     (officer_treasurer, officer_governor, council_member).
--     The Adviser, Dean, students and admins can NOT read these.
--
-- Privacy is enforced in the database with RESTRICTIVE policies, so it
-- holds even if someone calls the API directly. Existing policies are
-- kept; these only narrow them. Old notes stay in the group chat.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

ALTER TABLE public.proposal_notes
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'all';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposal_notes_visibility_check'
  ) THEN
    ALTER TABLE public.proposal_notes
      ADD CONSTRAINT proposal_notes_visibility_check CHECK (visibility IN ('all', 'officers'));
  END IF;
END $$;

-- Is the signed-in user a council officer?
CREATE OR REPLACE FUNCTION public.ncf_is_council_officer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('officer_treasurer', 'officer_governor', 'council_member')
  );
$$;

REVOKE ALL ON FUNCTION public.ncf_is_council_officer() FROM PUBLIC;
-- anon needs EXECUTE too because the read policy below is evaluated for
-- every caller; for a signed-out caller it simply returns false.
GRANT EXECUTE ON FUNCTION public.ncf_is_council_officer() TO anon, authenticated;

-- Only officers can read officers-only notes.
DROP POLICY IF EXISTS "ncf notes private to officers (read)" ON public.proposal_notes;
CREATE POLICY "ncf notes private to officers (read)"
  ON public.proposal_notes AS RESTRICTIVE FOR SELECT TO public
  USING (visibility = 'all' OR public.ncf_is_council_officer());

-- Only officers can write officers-only notes.
DROP POLICY IF EXISTS "ncf notes private to officers (write)" ON public.proposal_notes;
CREATE POLICY "ncf notes private to officers (write)"
  ON public.proposal_notes AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (visibility = 'all' OR public.ncf_is_council_officer());

-- Note authors: never reveal anything about private notes to non-officers.
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
    AND (me.role IN ('admin', 'super_admin') OR me.department = r.department_code)
    AND (n.visibility = 'all' OR me.role IN ('officer_treasurer', 'officer_governor', 'council_member'));
$$;

REVOKE ALL ON FUNCTION public.get_note_authors(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_note_authors(UUID[]) TO authenticated;

-- Notifications: a private note must not notify the Adviser / Dean.
CREATE OR REPLACE FUNCTION public.ncf_trg_note_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.budget_requests;
  who TEXT;
BEGIN
  SELECT * INTO req FROM public.budget_requests WHERE id = NEW.proposal_id;
  IF req.id IS NULL THEN RETURN NEW; END IF;
  SELECT full_name INTO who FROM public.profiles WHERE id = NEW.author_id;
  IF NEW.visibility = 'officers' THEN
    PERFORM public.ncf_notify(req.requested_by,
      'New officers-only note on your budget request', COALESCE(who, 'Someone') || ' on "' || req.title || '": ' || left(NEW.note_content, 140), 'budget');
    RETURN NEW;
  END IF;
  PERFORM public.ncf_notify(req.requested_by,
    'New note on your budget request', COALESCE(who, 'Someone') || ' on "' || req.title || '": ' || left(NEW.note_content, 140), 'budget');
  PERFORM public.ncf_notify_roles(req.department_code, ARRAY['csc_adviser', 'dean'],
    'New note on a budget request', COALESCE(who, 'Someone') || ' on "' || req.title || '": ' || left(NEW.note_content, 140), 'budget_approvals', req.requested_by);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'note notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Warn if row level security is off (then the privacy rule above has no effect).
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.proposal_notes'::regclass) THEN
    RAISE WARNING 'Row level security is OFF on proposal_notes: officers-only notes are NOT private until it is enabled.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
