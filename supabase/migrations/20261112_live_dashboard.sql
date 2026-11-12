-- ==========================================================
-- Live budget dashboard
--
-- 1. Enable Supabase Realtime on the tables the dashboard listens to, so a
--    transaction recorded by any user shows up on everyone's dashboard
--    immediately. (Realtime still respects RLS: users only receive changes
--    to rows they are allowed to SELECT.)
--
-- 2. Align the department_financials view with the dashboard's formula:
--      spent     = Completed expense transactions
--      income    = Completed income transactions (SAF, penalties, returns)
--      remaining = allocated + income - spent
--    Pending / Rejected transactions no longer count until approved.
--    (Columns keep their original order; `income` is appended at the end.)
--
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ==========================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['transactions', 'budgets', 'saf_records', 'budget_requests'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE VIEW department_financials AS
SELECT d.code, d.name,
       COALESCE(b.allocated, 0) AS allocated,
       COALESCE(t.spent, 0) AS spent,
       COALESCE(b.allocated, 0) + COALESCE(t.income, 0) - COALESCE(t.spent, 0) AS remaining,
       CASE WHEN COALESCE(b.allocated, 0) + COALESCE(t.income, 0) = 0 THEN 0
            ELSE LEAST(100, ROUND(COALESCE(t.spent, 0) / (COALESCE(b.allocated, 0) + COALESCE(t.income, 0)) * 100))
       END AS used_percentage,
       COALESCE(t.income, 0) AS income
FROM departments d
LEFT JOIN (
  SELECT department_code, SUM(allocated_amount) AS allocated
  FROM budgets
  GROUP BY department_code
) b ON b.department_code = d.code
LEFT JOIN (
  SELECT department_code,
         SUM(amount) FILTER (WHERE NOT is_income) AS spent,
         SUM(amount) FILTER (WHERE is_income)     AS income
  FROM transactions
  WHERE status = 'Completed'
  GROUP BY department_code
) t ON t.department_code = d.code;
