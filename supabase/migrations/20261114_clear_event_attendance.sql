-- ==========================================================
-- clear_event_attendance(...): "Clear" button in the Attendance Roster
--
-- Lets council officers undo attendance marks (Present / Absent / Excused)
-- of an event, e.g. a whole year level marked by mistake, so those
-- students go back to "not yet marked".
--
-- Rules:
--   * council officers (officer_treasurer, officer_governor,
--     council_member), admin and super_admin only;
--   * officers only for students of their own department;
--   * an Absent mark whose penalty is already PAID is never removed,
--     so no payment record is lost.
-- Returns the ids of the attendance rows that were cleared.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.clear_event_attendance(
  p_event_id UUID,
  p_attendance_ids UUID[]
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_dept TEXT;
  v_ids  UUID[];
BEGIN
  SELECT role, department INTO v_role, v_dept
  FROM public.profiles WHERE id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('officer_treasurer', 'officer_governor', 'council_member', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only council officers can clear attendance.' USING ERRCODE = '42501';
  END IF;

  WITH removed AS (
    DELETE FROM public.event_attendance ea
    USING public.students s
    WHERE ea.id = ANY(p_attendance_ids)
      AND ea.event_id = p_event_id
      AND s.id = ea.student_id
      AND NOT (ea.status = 'Absent' AND coalesce(ea.penalty_paid, false))
      AND (
        v_role IN ('admin', 'super_admin')
        OR v_dept IS NULL
        OR s.department_code = v_dept
      )
    RETURNING ea.id
  )
  SELECT coalesce(array_agg(id), ARRAY[]::UUID[]) INTO v_ids FROM removed;

  RETURN v_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_event_attendance(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_event_attendance(UUID, UUID[]) TO authenticated;
