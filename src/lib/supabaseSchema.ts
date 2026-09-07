/**
 * NCF PREDICT — LIVE SUPABASE SCHEMA (reference copy)
 *
 * Status as of 2026-09-07: this reflects the schema actually deployed on
 * crldynueekbzdirietkq.supabase.co after two rounds of direct changes:
 *
 * 1. An RLS security fix (budget_requests/budget_request_items were
 *    world-readable/writable via the anon key with real data in them).
 * 2. A full schema migration ("Phase 1" of a localStorage → Supabase
 *    migration) that added 9 tables the app's types.ts needs but the
 *    database didn't have (students, saf_records, school_events,
 *    event_attendance, semesters, council_votes, proposal_notes,
 *    cashouts, budget_returns), extended budget_requests with the full
 *    5-stage ProposalStage workflow, fixed several pre-existing data
 *    integrity issues (department names vs. codes, mismatched enum
 *    vocabularies between the app and several CHECK constraints), and
 *    replaced the DB's coarse role model ('Officer'/'CSC Adviser'/'Admin')
 *    with the app's fine-grained UserRole vocabulary plus 'admin' (a 7th
 *    value — the live DB already had a real Admin account with elevated
 *    privileges that the app's UserRole type never accounted for).
 *
 * The app's UI (AppContext.tsx) still runs on localStorage/mock data as
 * of this writing — this migration is the database half of a larger
 * effort; AppContext is rewired to actually use these tables in later
 * phases (see the migration plan for the phase breakdown).
 */

export const SUPABASE_SQL_SCHEMA = `-- ==========================================================
-- NCF PREDICT: Live Supabase schema (as deployed, post-migration)
-- Project: crldynueekbzdirietkq.supabase.co
-- ==========================================================

CREATE TABLE IF NOT EXISTS school_years (
    id SERIAL PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL CHECK (end_date > start_date),
    is_current BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS semesters (
    id SERIAL PRIMARY KEY,
    school_year_id INTEGER NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                    -- '1st Semester' | '2nd Semester' | 'Summer'
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (school_year_id, name)
);
-- at most one semester globally marked current:
-- CREATE UNIQUE INDEX one_current_semester ON semesters (is_current) WHERE is_current;

CREATE TABLE IF NOT EXISTS departments (
    code TEXT PRIMARY KEY,                 -- 'CAF','CAS','CBM','CCJE','CCS','COE','CHS','CTED'
    name TEXT NOT NULL,
    color_hex TEXT DEFAULT '1B8A3C' NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Mirrors auth.users 1:1 via the fn_handle_new_user() trigger (already live).
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN
      ('officer_treasurer','officer_governor','council_member','csc_adviser','dean','student','admin')),
    department TEXT REFERENCES departments(code),   -- NULL for admin (not tied to one department)
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_number TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    course TEXT NOT NULL,
    year_level TEXT NOT NULL,
    section TEXT NOT NULL,
    email TEXT NOT NULL,
    department_code TEXT NOT NULL REFERENCES departments(code),
    semester_id INTEGER REFERENCES semesters(id),
    profile_id UUID REFERENCES profiles(id),   -- linked auth account, nullable
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS saf_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    department_code TEXT NOT NULL REFERENCES departments(code),
    amount NUMERIC(12,2) DEFAULT 250.00 NOT NULL,
    paid BOOLEAN DEFAULT false NOT NULL,
    payment_date TIMESTAMPTZ,
    receipt_no TEXT,
    payment_method TEXT CHECK (payment_method IN ('Cash','Online / Bank','G-Cash')),
    semester_id INTEGER REFERENCES semesters(id),
    debit_account TEXT DEFAULT 'Student Activity Fund (SAF) Receivable' NOT NULL,
    credit_account TEXT DEFAULT 'Uncollected Student Dues' NOT NULL,
    reference_no TEXT,
    collected_by UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS budgets (
    id SERIAL PRIMARY KEY,
    school_year_id INTEGER NOT NULL REFERENCES school_years(id),
    department_code TEXT NOT NULL REFERENCES departments(code),
    allocated_amount NUMERIC(12,2) DEFAULT 0 NOT NULL CHECK (allocated_amount >= 0),
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS school_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_title TEXT NOT NULL,
    event_description TEXT,
    venue TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('Academic','Event','Capital','Operations','Revenue','Institutional')),
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    penalty_fee_amount NUMERIC(12,2) DEFAULT 50.00 NOT NULL,
    semester_id INTEGER REFERENCES semesters(id),
    department_code TEXT REFERENCES departments(code),   -- NULL = 'ALL' departments
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS event_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES school_events(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'Absent' NOT NULL CHECK (status IN ('Present','Absent','Excused')),
    time_in TIME,
    penalty_amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    penalty_paid BOOLEAN DEFAULT false NOT NULL,
    penalty_paid_date DATE,
    receipt_no TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (event_id, student_id)
);

-- Budget proposals: full 5-stage ProposalStage workflow.
CREATE TABLE IF NOT EXISTS budget_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    budget_description TEXT,
    department_code TEXT NOT NULL REFERENCES departments(code),
    event_id UUID REFERENCES school_events(id),
    requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    requested_by_name TEXT DEFAULT '' NOT NULL,
    treasurer_notes TEXT,
    fiscal_year TEXT DEFAULT '2024-25' NOT NULL,
    semester_id INTEGER REFERENCES semesters(id),
    status TEXT DEFAULT 'DRAFT' NOT NULL CHECK (status IN
      ('DRAFT','EXECUTIVE_REVIEW','COUNCIL_VOTING','CSC_ADVISER_APPROVAL','DEAN_APPROVAL','APPROVED_RELEASED','REJECTED','FOR_REVISION')),
    total_amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    -- executive review stage
    executive_reviewed_by UUID REFERENCES profiles(id),
    executive_decision TEXT CHECK (executive_decision IN ('APPROVED_TO_COUNCIL','NEEDS_REVISION','REJECTED')),
    executive_remarks TEXT,
    executive_reviewed_at TIMESTAMPTZ,
    -- council voting stage (see council_votes table for individual votes)
    council_resolution_number TEXT,
    council_resolution_status TEXT CHECK (council_resolution_status IN ('PASSED','FAILED','PENDING')),
    -- adviser stage
    adviser_id UUID REFERENCES profiles(id),
    adviser_decision TEXT CHECK (adviser_decision IN ('APPROVED','REVISION','REJECTED')),
    adviser_remarks TEXT,
    adviser_decided_at TIMESTAMPTZ,
    -- dean stage (fund release)
    dean_id UUID REFERENCES profiles(id),
    dean_decision TEXT CHECK (dean_decision IN ('APPROVED_FUND_RELEASE','REVISION','REJECTED')),
    dean_remarks TEXT,
    dean_decided_at TIMESTAMPTZ,
    release_authorized BOOLEAN DEFAULT false NOT NULL,
    -- legacy columns kept for compatibility with existing rows/policies
    adviser_note TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budget_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES budget_requests(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'General' NOT NULL,
    quantity NUMERIC(12,2) DEFAULT 1 NOT NULL,
    unit_cost NUMERIC(12,2) DEFAULT 0 NOT NULL,
    amount NUMERIC(12,2) DEFAULT 0 NOT NULL,
    remarks TEXT,
    receipt_no TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS council_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES budget_requests(id) ON DELETE CASCADE,
    council_member_id UUID NOT NULL REFERENCES profiles(id),
    vote TEXT NOT NULL CHECK (vote IN ('IN_FAVOR','AGAINST','ABSTAIN')),
    comment TEXT,
    voted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (proposal_id, council_member_id)   -- re-voting replaces the prior vote
);

CREATE TABLE IF NOT EXISTS proposal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES budget_requests(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id),
    note_content TEXT NOT NULL,
    is_official BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS cashouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES budget_requests(id) ON DELETE CASCADE,
    amount_released NUMERIC(12,2) NOT NULL,
    date_released DATE DEFAULT current_date NOT NULL,
    purpose TEXT NOT NULL,
    cashout_status TEXT DEFAULT 'Pending' NOT NULL CHECK (cashout_status IN ('Pending','Approved','Released','Declined')),
    officer_id UUID REFERENCES profiles(id),
    voucher_no TEXT,
    proof_docs JSONB DEFAULT '[]' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Expenses are transactions rows (type/is_income=false) linked via proposal_id,
-- not a separate table — matches what addExpense() already did by calling
-- addTransaction() internally.
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_code TEXT NOT NULL REFERENCES departments(code),
    proposal_id UUID REFERENCES budget_requests(id),
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Revenue','Event','Capital','Operations','Academic')),
    reference_code TEXT,
    transaction_date DATE NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    is_income BOOLEAN DEFAULT false NOT NULL,
    status TEXT DEFAULT 'Completed' NOT NULL CHECK (status IN ('Completed','Pending','Processing')),
    is_archived BOOLEAN DEFAULT false NOT NULL,
    fiscal_year TEXT DEFAULT '2024-25' NOT NULL,
    notes TEXT,
    receipt_url TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS reimbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_code TEXT NOT NULL,
    proposal_id UUID REFERENCES budget_requests(id),
    expense_transaction_id UUID REFERENCES transactions(id),
    claimant_name TEXT NOT NULL,
    claimant_id UUID REFERENCES profiles(id),
    department_code TEXT NOT NULL REFERENCES departments(code),
    event_name TEXT NOT NULL,
    purpose TEXT DEFAULT '' NOT NULL,
    amount_requested NUMERIC(12,2) NOT NULL CHECK (amount_requested >= 0),
    date_submitted DATE NOT NULL,
    receipt_no TEXT DEFAULT 'N/A' NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Revenue','Event','Capital','Operations','Academic')),
    fiscal_year TEXT DEFAULT '2024-25' NOT NULL,
    -- 'Rejected' added beyond ReimbursementRecord's current 3-value status in
    -- types.ts because real rows already used it; the type should gain it too.
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('Pending','Approved','Paid','Rejected')),
    reviewed_by UUID REFERENCES profiles(id),
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS liquidation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_code TEXT NOT NULL,
    proposal_id UUID REFERENCES budget_requests(id),
    event_name TEXT NOT NULL,
    department_code TEXT NOT NULL REFERENCES departments(code),
    event_date DATE NOT NULL,
    budget_allocated NUMERIC(12,2) DEFAULT 0 NOT NULL,
    fiscal_year TEXT DEFAULT '2024-25' NOT NULL,
    status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('Draft','Submitted','Audited','Closed')),
    total_released NUMERIC(12,2) DEFAULT 0 NOT NULL,
    total_spent NUMERIC(12,2) DEFAULT 0 NOT NULL,
    balance NUMERIC(12,2) DEFAULT 0 NOT NULL,
    accounting_summary JSONB DEFAULT '[]' NOT NULL,
    submitted_by UUID REFERENCES profiles(id),
    reviewed_by UUID REFERENCES profiles(id),
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS liquidation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES liquidation_reports(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    receipt_no TEXT DEFAULT 'N/A' NOT NULL,
    item_date DATE NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    category TEXT DEFAULT 'General' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS budget_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL UNIQUE REFERENCES budget_requests(id) ON DELETE CASCADE,
    amount_returned NUMERIC(12,2) NOT NULL,
    date_returned DATE DEFAULT current_date NOT NULL,
    cash_in_reference TEXT,
    returned_by UUID REFERENCES profiles(id),
    received_by TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS forecasts (
    id SERIAL PRIMARY KEY,
    school_year_id INTEGER NOT NULL REFERENCES school_years(id),
    department_code TEXT REFERENCES departments(code),
    forecast_amount NUMERIC(12,2) NOT NULL,
    accuracy_pct NUMERIC(12,2),
    generated_by UUID REFERENCES profiles(id),
    generated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id UUID,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id TEXT,
    payload JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS budget_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_code TEXT NOT NULL REFERENCES departments(code),
    description TEXT NOT NULL,
    allocated_amount NUMERIC(12,2) NOT NULL CHECK (allocated_amount >= 0),
    category TEXT NOT NULL CHECK (category IN ('Revenue','Event','Capital','Operations','Academic')),
    fiscal_year TEXT DEFAULT '2024-25' NOT NULL,
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active','archived')),
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- department_summary: departments joined with budgets (pre-existing view).
-- department_financials: allocated/spent/remaining/used_percentage computed
-- live from budgets + transactions, backing DepartmentInfo's financial fields
-- without denormalized/trigger-maintained columns.
CREATE VIEW department_financials AS
SELECT d.code, d.name,
       COALESCE(b.allocated, 0) AS allocated,
       COALESCE(t.spent, 0) AS spent,
       COALESCE(b.allocated, 0) - COALESCE(t.spent, 0) AS remaining,
       CASE WHEN COALESCE(b.allocated, 0) = 0 THEN 0
            ELSE LEAST(100, ROUND(COALESCE(t.spent, 0) / b.allocated * 100)) END AS used_percentage
FROM departments d
LEFT JOIN (SELECT department_code, SUM(allocated_amount) allocated FROM budgets GROUP BY department_code) b
  ON b.department_code = d.code
LEFT JOIN (SELECT department_code, SUM(amount) spent FROM transactions WHERE NOT is_income GROUP BY department_code) t
  ON t.department_code = d.code;

-- ==========================================================
-- RPC functions (SECURITY DEFINER) — used where a multi-step write needs
-- to be atomic / race-free rather than done as sequential client calls:
--
-- cast_council_vote(proposal_id, vote, comment) — upserts a council
--   member's vote and auto-advances the proposal to CSC_ADVISER_APPROVAL
--   once 2+ IN_FAVOR votes exist, race-free (verified: two concurrent-ish
--   votes correctly trigger the advance exactly once).
--
-- approve_dean_decision(proposal_id, decision, remarks) — records the
--   dean's decision and, only on APPROVED_FUND_RELEASE, atomically creates
--   the corresponding cashouts row in the same transaction.
--
-- submit_liquidation(proposal_id, accounting_summary, notes) — computes
--   total_released (from cashouts) and total_spent (from transactions)
--   server-side and inserts the liquidation_reports row in one round trip.
--
-- create_student_with_saf(...) — inserts a students row plus its
--   auto-created saf_records row in one transaction (no orphan state).
--
-- All four re-check the caller's role via fn_my_role() internally (RLS is
-- bypassed by SECURITY DEFINER, so this check is the real authorization
-- gate) and are GRANTed to 'authenticated' only, REVOKEd from PUBLIC.
-- Full bodies were applied directly against the database; see git history
-- of this file / the project's migration record for exact source if needed.
-- ==========================================================
`;

export const SUPABASE_SCHEMA_SQL = SUPABASE_SQL_SCHEMA;

export const generateJsonExport = (data: any) => {
  return JSON.stringify(data, null, 2);
};

export const downloadSqlSchemaFile = () => {
  const blob = new Blob([SUPABASE_SQL_SCHEMA], { type: 'text/plain;charset=utf-8' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ncf_predict_supabase_schema.sql';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadFullProjectJson = (data: any) => {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ncf_predict_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default {
  SUPABASE_SQL_SCHEMA,
  SUPABASE_SCHEMA_SQL,
  generateJsonExport,
  downloadSqlSchemaFile,
  downloadFullProjectJson,
};
