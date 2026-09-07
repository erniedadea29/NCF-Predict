/**
 * NCF PREDICT DATABASE SCHEMA FOR SUPABASE / POSTGRESQL
 * Generated directly matching the ERD schema diagram in the project specifications
 */

export const SUPABASE_SQL_SCHEMA = `-- ==========================================================
-- NCF PREDICT: Student Activity Fund (SAF) & Budget Management
-- PostgreSQL & Supabase Database Schema DDL
-- Naga College Foundation (NCF)
-- ==========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. School Year Table
CREATE TABLE IF NOT EXISTS schoolyear (
    schoolyear_id SERIAL PRIMARY KEY,
    start_year VARCHAR(255) NOT NULL,
    end_year VARCHAR(255) NOT NULL,
    label VARCHAR(50) NOT NULL, -- e.g. 'SY 2024-25'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Semester Table
CREATE TABLE IF NOT EXISTS semester (
    semester_id SERIAL PRIMARY KEY,
    semester_name VARCHAR(255) NOT NULL, -- '1st Semester', '2nd Semester', 'Summer'
    start_date VARCHAR(255),
    end_date VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Active Semester Table
CREATE TABLE IF NOT EXISTS active_semester (
    activesem_id SERIAL PRIMARY KEY,
    schoolyear_id INT REFERENCES schoolyear(schoolyear_id) ON DELETE CASCADE,
    semester_id INT REFERENCES semester(semester_id) ON DELETE CASCADE,
    is_current BOOLEAN DEFAULT FALSE
);

-- 4. Students Table
CREATE TABLE IF NOT EXISTS students (
    student_id SERIAL PRIMARY KEY,
    student_number VARCHAR(50) UNIQUE NOT NULL,
    student_first_name VARCHAR(255) NOT NULL,
    student_last_name VARCHAR(255) NOT NULL,
    student_course VARCHAR(255) NOT NULL, -- e.g., 'BSIT', 'BSCS', 'BSA', 'BSBA'
    student_yr_lvl VARCHAR(50) NOT NULL,   -- e.g., '1st Year', '2nd Year', '3rd Year', '4th Year'
    student_section VARCHAR(50) NOT NULL,  -- e.g., 'BSIT-3A'
    email VARCHAR(255) NOT NULL,
    department VARCHAR(50) NOT NULL        -- 'CAF', 'CAS', 'CBM', 'CCJE', 'CCS', 'COE', 'CHS', 'CTED'
);

-- 5. Active Students Table
CREATE TABLE IF NOT EXISTS active_students (
    activestud_id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(student_id) ON DELETE CASCADE,
    activesem_id INT REFERENCES active_semester(activesem_id) ON DELETE CASCADE
);

-- 6. Officers Table
CREATE TABLE IF NOT EXISTS officers (
    officer_id SERIAL PRIMARY KEY,
    activestud_id INT REFERENCES active_students(activestud_id) ON DELETE CASCADE,
    officer_first_name VARCHAR(255) NOT NULL,
    officer_last_name VARCHAR(255) NOT NULL,
    officer_position VARCHAR(255) NOT NULL, -- 'Treasurer', 'Governor', 'Vice Governor', 'Council Member', 'Auditor'
    role_type VARCHAR(255) NOT NULL          -- 'TREASURER', 'EXECUTIVE_COMMITTEE', 'COUNCIL_MEMBER', 'ADVISER', 'DEAN'
);

-- 7. Student Activity Fund (SAF) Collection with Double Entry
CREATE TABLE IF NOT EXISTS studentactivityfund (
    saf_id SERIAL PRIMARY KEY,
    amount DECIMAL(10, 2) NOT NULL DEFAULT 250.00,
    paid BOOLEAN DEFAULT FALSE,
    payment_date TIMESTAMP WITH TIME ZONE,
    receipt_no VARCHAR(100),
    payment_method VARCHAR(50) DEFAULT 'Cash',
    debit_account VARCHAR(100) DEFAULT 'SAF Receivable',
    credit_account VARCHAR(100) DEFAULT 'Cash on Hand',
    collected_by VARCHAR(255),
    notes TEXT,
    activesem_id INT REFERENCES active_semester(activesem_id) ON DELETE CASCADE,
    activestud_id INT REFERENCES active_students(activestud_id) ON DELETE CASCADE
);

-- 8. School Events Table
CREATE TABLE IF NOT EXISTS school_events (
    event_id SERIAL PRIMARY KEY,
    event_title VARCHAR(255) NOT NULL,
    event_description TEXT,
    venue VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL, -- 'Academic', 'Event', 'Capital', 'Operations', 'Revenue'
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    penalty DECIMAL(10, 2) DEFAULT 50.00,
    department VARCHAR(50) DEFAULT 'ALL',
    activesem_id INT REFERENCES active_semester(activesem_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Event Attendance Table (For Recording Penalties)
CREATE TABLE IF NOT EXISTS event_attendance (
    attendance_id SERIAL PRIMARY KEY,
    event_id INT REFERENCES school_events(event_id) ON DELETE CASCADE,
    activestud_id INT REFERENCES active_students(activestud_id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'Absent', -- 'Present', 'Absent', 'Excused'
    penalty_amount DECIMAL(10, 2) DEFAULT 0.00,
    penalty_paid BOOLEAN DEFAULT FALSE,
    penalty_paid_date TIMESTAMP WITH TIME ZONE,
    receipt_no VARCHAR(100),
    remarks TEXT
);

-- 10. Budget Table (Main Proposal Flow)
CREATE TABLE IF NOT EXISTS budget (
    budget_id SERIAL PRIMARY KEY,
    budget_title VARCHAR(255) NOT NULL,
    budget_description TEXT,
    department VARCHAR(50) NOT NULL,
    total_budget_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    budget_status VARCHAR(255) NOT NULL DEFAULT 'Draft', -- 'Draft', 'Executive Review', 'Council Resolution', 'CSC Adviser Approval', 'Dean Approval', 'Approved', 'Rejected'
    remarks TEXT,
    event_id INT REFERENCES school_events(event_id) ON DELETE SET NULL,
    activesem_id INT REFERENCES active_semester(activesem_id) ON DELETE CASCADE,
    created_by_officer VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Budget Line Items (Requirements & Price Evaluation)
CREATE TABLE IF NOT EXISTS budget_line_items (
    line_item_id SERIAL PRIMARY KEY,
    item_desc VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    estimated_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    remarks VARCHAR(255),
    budget_id INT REFERENCES budget(budget_id) ON DELETE CASCADE
);

-- 12. Budget Review Workflow & Notes ("KUNG MAY NOTES KAMO IDAGDAG INI SA NOTES")
CREATE TABLE IF NOT EXISTS budget_review (
    budget_review_id SERIAL PRIMARY KEY,
    review_stage VARCHAR(255) NOT NULL,
    review_status VARCHAR(255) NOT NULL,
    remarks TEXT,
    date_reviewed DATE DEFAULT CURRENT_DATE,
    budget_id INT REFERENCES budget(budget_id) ON DELETE CASCADE
);

-- 13. Reviewers & Council Voting Table
CREATE TABLE IF NOT EXISTS reviewers (
    reviewer_id SERIAL PRIMARY KEY,
    reviewer_role VARCHAR(255) NOT NULL,
    reviewer_name VARCHAR(255) NOT NULL,
    decision VARCHAR(255) NOT NULL, -- 'IN_FAVOR', 'AGAINST', 'ABSTAIN', 'APPROVED', 'REJECTED'
    remarks TEXT,
    date_reviewed DATE DEFAULT CURRENT_DATE,
    budget_review_id INT REFERENCES budget_review(budget_review_id) ON DELETE CASCADE
);

-- 14. Cashouts (Budget Requests / Fund Release with proof)
CREATE TABLE IF NOT EXISTS cashouts (
    cashout_id SERIAL PRIMARY KEY,
    amount_released DECIMAL(10, 2) NOT NULL,
    date_released DATE DEFAULT CURRENT_DATE,
    purpose VARCHAR(255) NOT NULL,
    cashout_status VARCHAR(255) DEFAULT 'Released',
    proof_docs JSONB DEFAULT '[]', -- letter / billing / invoices
    budget_id INT REFERENCES budget(budget_id) ON DELETE CASCADE,
    officer_id INT REFERENCES officers(officer_id) ON DELETE SET NULL
);

-- 15. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    expense_id SERIAL PRIMARY KEY,
    expense_desc VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    amount_spent DECIMAL(10, 2) NOT NULL,
    date_incurred DATE DEFAULT CURRENT_DATE,
    proof_attach JSONB DEFAULT '[]',
    budget_id INT REFERENCES budget(budget_id) ON DELETE CASCADE,
    officer_id INT REFERENCES officers(officer_id) ON DELETE SET NULL
);

-- 16. Reimbursements Table
CREATE TABLE IF NOT EXISTS reimbursements (
    reimbursement_id SERIAL PRIMARY KEY,
    amount_spent DECIMAL(10, 2) NOT NULL,
    date_submitted DATE DEFAULT CURRENT_DATE,
    reimbursement_status VARCHAR(255) DEFAULT 'Pending',
    remarks VARCHAR(255),
    expense_id INT REFERENCES expenses(expense_id) ON DELETE CASCADE,
    officer_id INT REFERENCES officers(officer_id) ON DELETE SET NULL
);

-- 17. Liquidation Table (Accounting the Fund Spent)
CREATE TABLE IF NOT EXISTS liquidation (
    liquidation_id SERIAL PRIMARY KEY,
    budget_id INT REFERENCES budget(budget_id) ON DELETE CASCADE,
    total_budget DECIMAL(10, 2) NOT NULL,
    total_released DECIMAL(10, 2) NOT NULL,
    total_spent DECIMAL(10, 2) NOT NULL,
    balance DECIMAL(10, 2) NOT NULL, -- unspent balance
    status VARCHAR(50) DEFAULT 'Audited',
    accounting_breakdown JSONB DEFAULT '[]',
    submitted_by VARCHAR(255),
    submitted_date DATE DEFAULT CURRENT_DATE,
    notes TEXT
);

-- 18. Budget Return Table (Cash-in for Unspent Budget)
CREATE TABLE IF NOT EXISTS budget_return (
    return_id SERIAL PRIMARY KEY,
    budget_id INT REFERENCES budget(budget_id) ON DELETE CASCADE,
    amount_returned DECIMAL(10, 2) NOT NULL,
    date_returned DATE DEFAULT CURRENT_DATE,
    cash_in_reference VARCHAR(100),
    debit_account VARCHAR(100) DEFAULT 'Cash on Hand (SAF Account)',
    credit_account VARCHAR(100) DEFAULT 'Event Budget Return',
    remarks TEXT,
    returned_by VARCHAR(255),
    received_by VARCHAR(255)
);

-- Row Level Security (RLS) Enablement
ALTER TABLE schoolyear ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_semester ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE studentactivityfund ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidation ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_return ENABLE ROW LEVEL SECURITY;

-- Allow public reads and authenticated modifications
CREATE POLICY "Allow read access for all" ON budget FOR SELECT USING (true);
CREATE POLICY "Allow read access for all line items" ON budget_line_items FOR SELECT USING (true);
CREATE POLICY "Allow read access for all events" ON school_events FOR SELECT USING (true);
CREATE POLICY "Allow read access for all saf" ON studentactivityfund FOR SELECT USING (true);
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
