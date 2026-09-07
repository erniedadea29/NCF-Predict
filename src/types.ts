export type DepartmentCode = 'CAF' | 'CAS' | 'CBM' | 'CCJE' | 'CCS' | 'COE' | 'CHS' | 'CTED';

export interface DepartmentInfo {
  code: DepartmentCode;
  name: string;
  color: string;
  badgeBg: string;
  textColor: string;
  allocated: number;
  spent: number;
  remaining: number;
  forecast: number;
  usedPercentage: number;
}

export type UserRole =
  | 'officer_treasurer'      // Role 1: Treasurer (Draft, Line Items, SAF Cash-in)
  | 'officer_governor'       // Role 2: Governor/Vice Gov - Executive Committee (Review)
  | 'council_member'         // Role 3: Council Members (Resolution/Voting/Comment notes)
  | 'csc_adviser'            // Role 4: Student Council Advisers (Approval)
  | 'dean'                   // Role 5: Dean (Approval/Fund Release/Overall)
  | 'student'                // Student (View SAF, Attendance, Penalties)
  | 'admin'                  // System Administrator (full access, mirrors Supabase profiles.role)
  | 'cashier';                // SAF Cashier (collect/verify SAF payments, additive alongside treasurer)

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: DepartmentCode;
  officer_position?: string;
  student_number?: string;
  course?: string;
  year_level?: string;
  section?: string;
  avatar?: string;
  contact_number?: string;
  registered_at?: string;
  is_active?: boolean;
}

export interface UserAccountSummary {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  department?: DepartmentCode;
  is_active: boolean;
}

export interface ClearanceRecord {
  id: string;
  student_id: string;
  semester_id?: string;
  clearance_code: string;
  saf_paid: boolean;
  unpaid_penalties_count: number;
  unpaid_penalties_amount: number;
  status: 'CLEARED' | 'HOLD';
  generated_by?: string;
  generated_at: string;
}

export interface SchoolYear {
  id: string;
  start_year: string;
  end_year: string;
  label: string; // e.g. "SY 2024-25"
}

export interface Semester {
  id: string;
  name: string; // e.g. "1st Semester", "2nd Semester", "Summer"
  start_date: string;
  end_date: string;
}

export interface ActiveSemester {
  id: string;
  schoolyear_id: string;
  semester_id: string;
  school_year_label: string;
  semester_name: string;
  is_current: boolean;
}

export interface Student {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  course: string;
  year_level: string;
  section: string;
  email: string;
  department: DepartmentCode;
  activesem_id: string;
  school_year: string;
}

export interface DoubleEntryRecord {
  debit_account: string;  // e.g. "Student Activity Fund (SAF)"
  credit_account: string; // e.g. "Cash / Cash in Bank"
  amount: number;
  reference_no: string;
  transaction_type: 'SAF_CASH_IN' | 'BUDGET_RELEASE' | 'EXPENSE_PAYMENT' | 'BUDGET_RETURN_CASH_IN';
  created_at: string;
}

export interface SAFRecord {
  id: string;
  student_id: string;
  student_number: string;
  student_name: string;
  course: string;
  section: string;
  year_level: string;
  department: DepartmentCode;
  amount: number;
  paid: boolean;
  payment_date?: string;
  receipt_no?: string;
  payment_method?: 'Cash' | 'Online / Bank' | 'G-Cash';
  activesem_id: string;
  school_year: string;
  double_entry: DoubleEntryRecord;
  collected_by: string;
  notes?: string;
}

export type TransactionCategory = 'Revenue' | 'Event' | 'Capital' | 'Operations' | 'Academic' | 'All';

export interface DepartmentTransaction {
  id: string;
  title: string;
  department: DepartmentCode;
  category: TransactionCategory;
  date: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  is_archived: boolean;
  status: 'Completed' | 'Pending' | 'Processing' | 'Rejected';
  reference_code: string;
  description?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface SchoolEvent {
  id: string;
  event_title: string;
  event_description?: string;
  description?: string;
  venue: string;
  event_type: 'Academic' | 'Event' | 'Capital' | 'Operations' | 'Revenue' | 'Institutional';
  event_date: string;
  start_time?: string;
  end_time?: string;
  penalty: number; // Penalty amount for absenteeism (e.g., 50.00)
  penalty_fee_amount?: number;
  activesem_id: string;
  department: DepartmentCode | 'ALL';
  school_year?: string;
  created_at: string;
}

export interface EventAttendance {
  id: string;
  event_id: string;
  event_title: string;
  student_id: string;
  student_number: string;
  student_name: string;
  course: string;
  section: string;
  department: DepartmentCode;
  status: 'Present' | 'Absent' | 'Excused';
  time_in?: string;
  penalty_amount: number;
  amount?: number; // helper alias
  reason?: string; // helper alias
  penalty_paid: boolean;
  penalty_paid_date?: string;
  receipt_no?: string;
  notes?: string;
}

export interface BudgetLineItem {
  id: string;
  item_desc: string;
  category: string;
  quantity: number;
  unit_cost: number;
  estimated_amount: number;
  remarks: string;
}

export type ProposalStage = 
  | 'DRAFT'                       // Role 1 (Treasurer)
  | 'EXECUTIVE_REVIEW'            // Role 2 (Governor/Vice Gov)
  | 'COUNCIL_VOTING'              // Role 3 (Council Members Resolution & Notes)
  | 'CSC_ADVISER_APPROVAL'        // Role 4 (Student Council Advisers)
  | 'DEAN_APPROVAL'               // Role 5 (Dean Final Approval & Fund Release)
  | 'APPROVED_RELEASED'           // Fully Approved & Funds Released
  | 'REJECTED'                    // Rejected
  | 'FOR_REVISION';               // Returned with comments for revision

export interface CouncilVote {
  id: string;
  council_member_id: string;
  council_member_name: string;
  position: string;
  vote: 'IN_FAVOR' | 'AGAINST' | 'ABSTAIN';
  comment: string;
  voted_at: string;
}

export interface ProposalNote {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  note_content: string; // "KUNG MAY NOTES KAMO IDAGDAG INI SA NOTES"
  created_at: string;
  is_official: boolean;
}

export interface CashoutRecord {
  id: string;
  budget_id: string;
  amount_released: number;
  date_released: string;
  purpose: string;
  cashout_status: 'Pending' | 'Approved' | 'Released' | 'Declined';
  officer_id: string;
  officer_name: string;
  voucher_no: string;
  proof_docs: { name: string; type: string; url: string; date: string }[];
}

export interface ExpenseRecord {
  id: string;
  budget_id: string;
  expense_desc: string;
  category: string;
  amount_spent: number;
  date_incurred: string;
  proof_attach: { name: string; type: string; url: string; invoice_number: string }[];
  officer_id: string;
  officer_name: string;
  reimbursement_status: 'None' | 'Requested' | 'Approved' | 'Reimbursed';
}

export interface ReimbursementRecord {
  id: string;
  expense_id: string;
  budget_id: string;
  amount_spent: number;
  date_submitted: string;
  reimbursement_status: 'Pending' | 'Approved' | 'Paid' | 'Rejected';
  remarks: string;
  officer_name: string;
  receipt_ref: string;
}

export interface LiquidationRecord {
  id: string;
  budget_id: string;
  total_budget: number;
  total_released: number;
  total_spent: number;
  balance: number; // unspent fund to be returned
  status: 'Draft' | 'Submitted' | 'Audited' | 'Closed';
  accounting_summary: { category: string; spent: number; line_item_count: number }[];
  submitted_by: string;
  submitted_date: string;
  auditor_remarks?: string;
  notes?: string;
}

export type SemesterEvent = SchoolEvent;
export type PenaltyRecord = EventAttendance;

export interface DepartmentBudgetSummary {
  code: DepartmentCode;
  name: string;
  color: string;
  badgeBg: string;
  allocated: number;
  spent: number;
  remaining: number;
  forecast: number;
  confidence: number;
  usedPercentage: number;
}


export interface BudgetReturnRecord {
  id: string;
  budget_id: string;
  amount_returned: number;
  date_returned: string;
  cash_in_reference: string;
  double_entry: {
    debit: string;  // Cash on Hand (SAF Account)
    credit: string; // Budget Return (Event Budget Unspent Fund)
  };
  returned_by: string;
  received_by: string;
  remarks: string;
}

export interface BudgetProposal {
  id: string;
  budget_title: string;
  budget_description: string;
  department: DepartmentCode;
  event_id?: string;
  event_title?: string;
  total_budget_amount: number;
  budget_status: ProposalStage;
  activesem_id: string;
  school_year: string;
  created_at: string;
  updated_at: string;
  created_by_officer: string;
  treasurer_notes?: string;
  
  // Line items (Requirement definition & price evaluation)
  line_items: BudgetLineItem[];

  // Review stage metadata
  executive_review?: {
    reviewed_by: string;
    decision: 'APPROVED_TO_COUNCIL' | 'NEEDS_REVISION' | 'REJECTED';
    remarks: string;
    date: string;
  };

  council_resolution?: {
    resolution_number: string;
    resolution_title: string;
    date_voted: string;
    status: 'PASSED' | 'FAILED' | 'PENDING';
  };

  votes: CouncilVote[];
  notes: ProposalNote[];

  adviser_approval?: {
    adviser_name: string;
    decision: 'APPROVED' | 'REVISION' | 'REJECTED';
    remarks: string;
    date: string;
  };

  dean_approval?: {
    dean_name: string;
    decision: 'APPROVED_FUND_RELEASE' | 'REVISION' | 'REJECTED';
    remarks: string;
    date: string;
    release_authorized: boolean;
  };

  // Associated financials
  cashouts: CashoutRecord[];
  expenses: ExpenseRecord[];
  reimbursements: ReimbursementRecord[];
  liquidation?: LiquidationRecord;
  budget_return?: BudgetReturnRecord;
}

export interface ForecastMetric {
  rmse: number;
  mae: number;
  mape: number;
  r2: number;
  model_name: string;
  training_years: number;
  departments: {
    code: DepartmentCode;
    name: string;
    allocated: number;
    forecast: number;
    diff: number;
    confidence: number;
    status: string;
  }[];
}
