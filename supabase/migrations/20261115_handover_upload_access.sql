-- ==========================================================
-- Adviser Handover: let the CSC Adviser upload the PDF
--
-- "Send My Activity Log & Records" uploads a PDF to the private
-- `handover-files` bucket under handover/<department>/<adviserId>/<time>.pdf
-- and then calls send_adviser_handover_file. The upload was refused with
-- "new row violates row-level security policy".
--
-- These policies let a CSC Adviser upload (and read back) files only in
-- their own department's folder and their own user folder.
-- Existing policies are not removed; these only add access.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

-- Make sure the private bucket exists.
INSERT INTO storage.buckets (id, name, public)
VALUES ('handover-files', 'handover-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "ncf handover upload by adviser" ON storage.objects;
CREATE POLICY "ncf handover upload by adviser"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'handover-files'
    AND (storage.foldername(name))[1] = 'handover'
    AND (storage.foldername(name))[3] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'csc_adviser'
        AND (pr.department IS NULL OR pr.department = (storage.foldername(name))[2])
    )
  );

DROP POLICY IF EXISTS "ncf handover read own uploads" ON storage.objects;
CREATE POLICY "ncf handover read own uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'handover-files'
    AND (storage.foldername(name))[1] = 'handover'
    AND (storage.foldername(name))[3] = auth.uid()::text
  );
