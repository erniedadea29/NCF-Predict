-- ==========================================================
-- Receipt photos: Adviser / Dean can view, officers can add
--
-- Reimbursement receipt photos are stored in the private `receipts`
-- bucket under <department>/<proposalId>/x_<expenseId>/...
-- These policies make sure:
--   * the CSC Adviser and Dean can VIEW the photos of their department
--     (so they can check them before approving a reimbursement);
--   * council officers can view and ADD photos for their department.
-- Super Admin / Admin can view everything.
-- Existing policies are not removed; these only add access.
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

DROP POLICY IF EXISTS "ncf receipts read by department staff" ON storage.objects;
CREATE POLICY "ncf receipts read by department staff"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND (
          pr.role IN ('super_admin', 'admin')
          OR (
            pr.role IN ('csc_adviser', 'dean', 'officer_treasurer', 'officer_governor', 'council_member')
            AND (pr.department IS NULL OR pr.department = (storage.foldername(name))[1])
          )
        )
    )
  );

DROP POLICY IF EXISTS "ncf receipts upload by department officers" ON storage.objects;
CREATE POLICY "ncf receipts upload by department officers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN ('officer_treasurer', 'officer_governor', 'council_member', 'super_admin')
        AND (pr.department IS NULL OR pr.department = (storage.foldername(name))[1])
    )
  );
