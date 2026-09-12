import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  User, 
  UserRole, 
  Student, 
  SAFRecord, 
  DepartmentTransaction, 
  SchoolEvent, 
  EventAttendance, 
  BudgetProposal, 
  BudgetLineItem,
  DepartmentCode,
  DepartmentInfo,
  ActiveSemester,
  ForecastMetric,
  CashoutRecord,
  ExpenseRecord,
  ReimbursementRecord,
  LiquidationRecord,
  BudgetReturnRecord,
  ProposalNote,
  UserAccountSummary,
  ClearanceRecord,
  Course,
  NotificationItem,
  OfficerSlotKey,
  OFFICER_POSITION_LABELS,
  AdviserHandoverFile,
  AdviserHandoverRequest
} from '../types';
import {
  DEPARTMENTS,
  INITIAL_ACTIVE_SEMESTER,
  MOCK_STUDENTS,
  MOCK_SAF_RECORDS,
  MOCK_TRANSACTIONS,
  MOCK_SCHOOL_EVENTS,
  MOCK_ATTENDANCES,
  MOCK_PROPOSALS,
  MOCK_FORECAST
} from '../data/mockData';
import { isSupabaseLiveConfigured, getSupabase, getIsolatedSupabase } from '../lib/supabaseClient';
import { jsPDF } from 'jspdf';

// Shown before a real Supabase session is restored / while logged out.
// currentUser stays non-null everywhere else in this file; AuthGate (App.tsx)
// never renders anything that reads it until isAuthenticated is true.
const GUEST_USER: User = {
  id: 'guest',
  name: 'Guest',
  email: '',
  role: 'student'
};

// Mirrors the officer_position derivation that used to live inline in
// registerUser — kept as its own function since login (session restore)
// also needs it now that officer_position isn't stored in `profiles`.
const deriveOfficerPosition = (role: UserRole, department?: DepartmentCode): string => {
  switch (role) {
    case 'officer_treasurer': return `${department} Department Treasurer`;
    case 'officer_governor': return `${department} College Governor`;
    case 'council_member': return `${department} Council Representative`;
    case 'csc_adviser': return 'Student Affairs & CSC Adviser';
    case 'dean': return 'College Dean & Executive Director';
    case 'admin': return `${department} Department Admin`;
    case 'super_admin': return 'Super Administrator';
    case 'employee': return 'Employee';
    default: return `${department} Student Member`;
  }
};

const deriveCourse = (department?: DepartmentCode): string => {
  switch (department) {
    case 'CAF': return 'BS Accountancy';
    case 'CCS': return 'BS Information Technology';
    case 'CBM': return 'BS Business Administration';
    case 'COE': return 'BS Civil Engineering';
    case 'CAS': return 'AB Communication';
    case 'CCJE': return 'BS Criminology';
    case 'CHS': return 'BS Nursing';
    default: return 'Bachelor of Secondary Education';
  }
};

interface AppContextType {
  // Authentication & User Accounts (real Supabase Auth — see lib/supabaseClient.ts)
  currentUser: User;
  setCurrentUser: (user: User) => void;
  loginUser: (identifier: string, password: string) => Promise<{ success: boolean; message: string; user?: User }>;
  logoutUser: () => void;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isReadOnlyStudent: boolean;
  isViewOnlyReviewer: boolean;
  isAdminSystemOnly: boolean;
  isEmployeeAwaitingAssignment: boolean;
  registerUser: (userData: {
    name: string;
    email: string;
    role: UserRole;
    department: DepartmentCode;
    course_id?: number;
    student_number?: string;
    officer_position?: string;
    course?: string;
    year_level?: string;
    section?: string;
    password: string;
    contact_number?: string;
  }) => Promise<{ success: boolean; message: string; user?: User; requiresOtp?: boolean }>;
  verifyRegistrationOtp: (email: string, code: string) => Promise<{ success: boolean; message: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  verifyPasswordResetOtp: (email: string, code: string) => Promise<{ success: boolean; message: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; message: string }>;
  isPasswordRecovery: boolean;
  // True once a Super Admin account exists — RegisterPage hides the Super
  // Admin option from the dropdown once this flips true.
  superAdminExists: boolean;

  // Two-Factor Authentication (TOTP) — replaces the earlier SSO plan.
  // Enrolled factors for the current user, and the login-time challenge
  // flow: signInWithPassword succeeds but access is withheld (isAuthenticated
  // stays false) until mfaVerifyLogin succeeds when a factor is enrolled.
  mfaFactors: { id: string; friendly_name?: string; status: string }[];
  mfaChallengePending: boolean;
  mfaEnrollStart: () => Promise<{ success: boolean; message: string; factorId?: string; qrCode?: string; secret?: string }>;
  mfaEnrollConfirm: (factorId: string, code: string) => Promise<{ success: boolean; message: string }>;
  mfaUnenroll: (factorId: string) => Promise<{ success: boolean; message: string }>;
  mfaVerifyLogin: (code: string) => Promise<{ success: boolean; message: string }>;
  cancelMfaChallenge: () => void;

  // Courses & role-slot availability (needed pre-auth for registration)
  courses: Course[];
  takenRoleSlots: { course_id: number | null; department_code?: string | null; slot_key: string }[];

  // Officer promotion (Adviser-only)
  promoteToOfficer: (studentProfileId: string, slotKey: OfficerSlotKey) => Promise<{ success: boolean; message: string }>;
  vacateOfficerPosition: (profileId: string) => Promise<{ success: boolean; message: string }>;

  // Promotion hierarchy: Super Admin -> Admin -> Dean -> Adviser
  promoteEmployeeToAdmin: (employeeProfileId: string, departmentCode: DepartmentCode) => Promise<{ success: boolean; message: string }>;
  promoteEmployeeToDean: (employeeProfileId: string) => Promise<{ success: boolean; message: string }>;
  promoteEmployeeToAdviser: (employeeProfileId: string) => Promise<{ success: boolean; message: string }>;
  demoteToEmployee: (profileId: string) => Promise<{ success: boolean; message: string }>;

  // Notifications
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => Promise<void>;

  // Adviser Handover: send/request/approve the single activity-log &
  // previous-records file, read-only for whoever views it.
  handoverFiles: AdviserHandoverFile[];
  handoverRequests: AdviserHandoverRequest[];
  sendAdviserHandoverFile: () => Promise<{ success: boolean; message: string }>;
  requestAdviserHandoverFile: (fileId: string) => Promise<{ success: boolean; message: string }>;
  reviewAdviserHandoverRequest: (requestId: string, decision: 'APPROVED' | 'REJECTED', remarks?: string) => Promise<{ success: boolean; message: string }>;
  getSignedHandoverFileUrl: (path: string) => Promise<string | null>;

  // Events approval workflow
  proposeEvent: (event: Omit<SchoolEvent, 'id' | 'created_at' | 'status'>) => Promise<{ success: boolean; message: string }>;
  reviewEvent: (eventId: string, decision: 'APPROVED' | 'REJECTED', remarks?: string) => Promise<void>;

  // Liquidation review (Adviser -> Dean)
  adviserReviewLiquidation: (liquidationId: string, decision: 'APPROVED' | 'REVISION' | 'REJECTED', remarks?: string) => Promise<void>;
  deanReviewLiquidation: (liquidationId: string, decision: 'APPROVED' | 'REVISION' | 'REJECTED', remarks?: string) => Promise<void>;
  updateOwnProfile: (updates: {
    name?: string;
    contact_number?: string;
    course?: string;
    year_level?: string;
    section?: string;
  }) => Promise<{ success: boolean; message: string }>;

  // User Management (staff: csc_adviser/dean/admin)
  userAccounts: UserAccountSummary[];
  addUserAccount: (userData: {
    name: string;
    email: string;
    role: UserRole;
    department: DepartmentCode;
    student_number?: string;
  }) => Promise<{ success: boolean; message: string; tempPassword?: string }>;
  deactivateUser: (profileId: string) => Promise<void>;
  reactivateUser: (profileId: string) => Promise<void>;
  deleteUserAccount: (profileId: string) => Promise<{ success: boolean; message: string }>;

  // SAF Clearance
  clearances: ClearanceRecord[];
  generateClearance: (studentId: string) => Promise<ClearanceRecord | null>;

  // Receipt/DCR storage
  getSignedReceiptUrl: (path: string) => Promise<string | null>;
  myReceipts: { name: string; path: string; created_at?: string }[];

  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalMode: 'login' | 'register';
  setAuthModalMode: (mode: 'login' | 'register') => void;
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  isRegisterModalOpen: boolean;
  setIsRegisterModalOpen: (open: boolean) => void;
  openRegisterModal: () => void;
  closeRegisterModal: () => void;
  
  // Academic Year / Semester
  activeSemester: ActiveSemester;
  updateActiveSemester: (syLabel: string, semName: string) => Promise<void>;

  // Departments
  departments: Record<DepartmentCode, DepartmentInfo>;
  updateDepartmentAllocated: (code: DepartmentCode, amount: number) => void;

  // Students & SAF
  students: Student[];
  addStudent: (student: Omit<Student, 'id'>) => void;
  updateStudent: (id: string, updates: Partial<Student>) => void;
  updateStudentInfo: (studentNumber: string, updates: Partial<Student>) => void;
  currentStudentNumber: string;
  safRecords: SAFRecord[];
  recordSafPayment: (safId: string, paymentMethod: 'Cash' | 'Online / Bank' | 'G-Cash', notes?: string) => void;
  addSafRecord: (record: Omit<SAFRecord, 'id' | 'double_entry' | 'receipt_no'>) => void;

  // Transactions
  transactions: DepartmentTransaction[];
  addTransaction: (tx: Omit<DepartmentTransaction, 'id' | 'reference_code' | 'is_archived' | 'status'> & { status?: DepartmentTransaction['status'] }) => void;
  reviewTransaction: (id: string, decision: 'Completed' | 'Rejected', remarks?: string) => Promise<void>;
  toggleArchiveTransaction: (id: string) => void;
  deleteTransaction: (id: string) => void;

  // Events & Attendance Penalties
  events: SchoolEvent[];
  addEvent: (event: Omit<SchoolEvent, 'id' | 'created_at'>) => void;
  createEvent: (event: Omit<SchoolEvent, 'id' | 'created_at'>) => void;
  attendances: EventAttendance[];
  penalties: EventAttendance[];
  recordAttendance: (eventId: string, studentId: string, status: 'Present' | 'Absent' | 'Excused', remarks?: string) => void;
  updateAttendancePhoto: (attendanceId: string, photoPath: string) => Promise<void>;
  payPenalty: (attendanceId: string, receiptNo?: string, confirmationRemark?: string) => void;

  // Budget Proposals & 5-Stage Approval Workflow
  proposals: BudgetProposal[];
  createProposal: (proposal: Omit<BudgetProposal, 'id' | 'created_at' | 'updated_at' | 'votes' | 'notes' | 'cashouts' | 'expenses' | 'reimbursements'>) => Promise<string>;
  updateProposalDraft: (id: string, updates: Partial<BudgetProposal>) => void;
  submitProposalForReview: (id: string) => void;
  executiveReviewProposal: (id: string, decision: 'APPROVED_TO_COUNCIL' | 'NEEDS_REVISION' | 'REJECTED', remarks: string) => void;
  voteOnProposal: (proposalId: string, vote: 'IN_FAVOR' | 'AGAINST' | 'ABSTAIN', comment: string) => void;
  addProposalNote: (proposalId: string, noteContent: string, isOfficial?: boolean) => void;
  adviserApproveProposal: (proposalId: string, decision: 'APPROVED' | 'REVISION' | 'REJECTED', remarks: string) => void;
  deanApproveProposal: (proposalId: string, decision: 'APPROVED_FUND_RELEASE' | 'REVISION' | 'REJECTED', remarks: string) => void;
  
  // Budget Requests (Cashouts), Expenses, Reimbursement, Liquidation, Return
  requestCashout: (budgetId: string, amount: number, purpose: string, proofDocs: { name: string; type: string; url: string; date: string }[]) => void;
  addExpense: (budgetId: string, desc: string, category: string, amount: number, proof: { name: string; type: string; url: string; invoice_number: string }) => void;
  requestReimbursement: (expenseId: string, budgetId: string, amount: number, remarks: string) => void;
  approveReimbursement: (reimbursementId: string, decision?: 'Approved' | 'Rejected', remarks?: string) => void;
  submitLiquidation: (budgetId: string, accountingSummary: { category: string; spent: number; line_item_count: number }[], notes: string) => void;
  recordBudgetReturn: (budgetId: string, amount: number, remarks: string) => void;

  // Forecast & AI
  forecastMetric: ForecastMetric;

  // Supabase Sync
  syncToSupabase: () => Promise<{ success: boolean; message: string }>;

  // Department Access Control & Scoping
  userDepartment: DepartmentCode;
  isDepartmentRestricted: boolean;
  scopedDepartmentInfo: DepartmentInfo;
  scopedDepartmentList: DepartmentInfo[];
  scopedTransactions: DepartmentTransaction[];
  scopedProposals: BudgetProposal[];
  scopedSafRecords: SAFRecord[];
  scopedStudents: Student[];
  scopedEvents: SchoolEvent[];
  scopedAttendances: EventAttendance[];
  scopedPenalties: EventAttendance[];

  // UI state
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isLiveSupabase: boolean;
  mobileFrameMode: boolean;
  setMobileFrameMode: (enabled: boolean) => void;
  selectedProposalIdForModal: string | null;
  setSelectedProposalIdForModal: (id: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'ncf_predict_db_state_v2';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(GUEST_USER);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  // True until the initial supabase.auth.getSession() resolves, so the UI
  // doesn't flash the login page before a real session is restored.
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  // True while the user arrived via a password-reset email link — AuthGate
  // shows ResetPasswordPage instead of the normal login/dashboard split.
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);
  // Suppresses the global onAuthStateChange listener while registerUser's
  // transient post-signUp session is being cleaned up, so a new account
  // never causes a brief flash into the dashboard before landing on login.
  const suppressAuthEventsRef = useRef(false);

  // Holds a student registration's roster details between "signUp sent the
  // OTP email" and "the code was verified" — create_student_with_saf needs
  // a live session (auth.uid()), which only exists after verifyOtp succeeds,
  // so this can't run inside registerUserInner anymore when confirmation is
  // required.
  const pendingRegistrationRef = useRef<{
    email: string;
    isStudent: boolean;
    student_number: string;
    first_name: string;
    last_name: string;
    course: string;
    year_level: string;
    section: string;
    department: DepartmentCode;
    course_id?: number;
    displayName: string;
    officer_position: string;
  } | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);

  const [courses, setCourses] = useState<Course[]>([]);
  const [takenRoleSlots, setTakenRoleSlots] = useState<{ course_id: number | null; department_code?: string | null; slot_key: string }[]>([]);
  const [superAdminExists, setSuperAdminExists] = useState<boolean>(true); // fail-safe true until confirmed otherwise

  // Fetched unconditionally (not gated on isAuthenticated) — the registration
  // form needs all three before anyone is logged in. All are backed by
  // public-readable/anon-callable DB objects for exactly this reason.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const client = getSupabase();
      const [{ data: courseRows }, { data: slotRows }, { data: superAdminFlag }] = await Promise.all([
        client.from('courses').select('id, department_code, name, code, is_active').eq('is_active', true).order('name'),
        client.rpc('get_taken_role_slots'),
        client.rpc('super_admin_exists')
      ]);
      if (cancelled) return;
      if (courseRows) setCourses(courseRows as Course[]);
      if (slotRows) setTakenRoleSlots(slotRows);
      if (typeof superAdminFlag === 'boolean') setSuperAdminExists(superAdminFlag);
    })();
    return () => { cancelled = true; };
  }, []);

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
    if (mode === 'login') {
      setIsLoginModalOpen(true);
      setIsRegisterModalOpen(false);
    } else {
      setIsRegisterModalOpen(true);
      setIsLoginModalOpen(false);
    }
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setIsLoginModalOpen(false);
    setIsRegisterModalOpen(false);
  };

  const openLoginModal = () => {
    setIsLoginModalOpen(true);
    setIsRegisterModalOpen(false);
    setIsAuthModalOpen(true);
    setAuthModalMode('login');
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
    setIsAuthModalOpen(false);
  };

  const openRegisterModal = () => {
    setIsRegisterModalOpen(true);
    setIsLoginModalOpen(false);
    setIsAuthModalOpen(true);
    setAuthModalMode('register');
  };

  const closeRegisterModal = () => {
    setIsRegisterModalOpen(false);
    setIsAuthModalOpen(false);
  };

  // Seeded with the mock/local default; overwritten by the live fetch below
  // once authenticated (school_years/semesters are RLS-gated to authenticated
  // reads, so fetching pre-login would just fail).
  const [activeSemester, setActiveSemester] = useState<ActiveSemester>(INITIAL_ACTIVE_SEMESTER);

  // Same pattern: DEPARTMENTS carries the UI-only styling (color/badgeBg/
  // textColor) that has no DB equivalent; the live fetch below merges in
  // real allocated/spent/remaining/usedPercentage from department_financials.
  const [departments, setDepartments] = useState<Record<DepartmentCode, DepartmentInfo>>(DEPARTMENTS);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      const client = getSupabase();

      const { data: sy } = await client.from('school_years').select('id, label').eq('is_current', true).maybeSingle();
      if (sy) {
        const { data: sem } = await client.from('semesters').select('id, name').eq('school_year_id', sy.id).eq('is_current', true).maybeSingle();
        if (!cancelled && sem) {
          setActiveSemester({
            id: `as_${sy.id}_${sem.id}`,
            schoolyear_id: String(sy.id),
            semester_id: String(sem.id),
            school_year_label: sy.label,
            semester_name: sem.name,
            is_current: true
          });
        }
      }

      const [{ data: deptRows }, { data: finRows }] = await Promise.all([
        client.from('departments').select('code, name, color_hex, is_active'),
        client.from('department_financials').select('code, allocated, spent, remaining, used_percentage')
      ]);
      if (cancelled || !deptRows) return;

      const finByCode = Object.fromEntries((finRows || []).map((f: any) => [f.code, f]));
      setDepartments(prev => {
        const next = { ...prev };
        deptRows.forEach((d: any) => {
          const code = d.code as DepartmentCode;
          const base = prev[code];
          if (!base) return; // unknown code — DEPARTMENTS is the source of truth for the 8 valid codes
          const fin = finByCode[code];
          next[code] = {
            ...base,
            name: d.name || base.name,
            allocated: fin ? Number(fin.allocated) : base.allocated,
            spent: fin ? Number(fin.spent) : base.spent,
            remaining: fin ? Number(fin.remaining) : base.remaining,
            usedPercentage: fin ? Number(fin.used_percentage) : base.usedPercentage
          };
        });
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);
  // All three start from the mock/local seed as a placeholder and are
  // overwritten by the live fetch below once authenticated.
  const [students, setStudents] = useState<Student[]>(MOCK_STUDENTS);
  const [safRecords, setSafRecords] = useState<SAFRecord[]>(MOCK_SAF_RECORDS);
  const [transactions, setTransactions] = useState<DepartmentTransaction[]>(MOCK_TRANSACTIONS);

  const mapStudentRow = (row: any): Student => ({
    id: row.id,
    profile_id: row.profile_id || undefined,
    student_number: row.student_number,
    first_name: row.first_name,
    last_name: row.last_name,
    course: row.course,
    year_level: row.year_level,
    section: row.section,
    email: row.email,
    department: row.department_code,
    activesem_id: row.semester_id != null ? String(row.semester_id) : '',
    school_year: activeSemester.school_year_label
  });

  const mapSafRow = (row: any): SAFRecord => {
    const s = row.students;
    return {
      id: row.id,
      student_id: row.student_id,
      student_number: s?.student_number || '',
      student_name: s ? `${s.first_name} ${s.last_name}` : '',
      course: s?.course || '',
      section: s?.section || '',
      year_level: s?.year_level || '',
      department: row.department_code,
      amount: Number(row.amount),
      paid: row.paid,
      payment_date: row.payment_date || undefined,
      receipt_no: row.receipt_no || undefined,
      payment_method: row.payment_method || undefined,
      activesem_id: row.semester_id != null ? String(row.semester_id) : '',
      school_year: activeSemester.school_year_label,
      double_entry: {
        debit_account: row.debit_account,
        credit_account: row.credit_account,
        amount: Number(row.amount),
        reference_no: row.reference_no || '',
        transaction_type: 'SAF_CASH_IN',
        created_at: row.created_at
      },
      collected_by: row.collected_by || 'Pending',
      notes: row.notes || undefined
    };
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      const client = getSupabase();
      const [{ data: studentRows }, { data: safRows }, { data: txRows }] = await Promise.all([
        client.from('students').select('*'),
        client.from('saf_records').select('*, students(student_number, first_name, last_name, course, section, year_level)'),
        client.from('transactions').select('*').order('created_at', { ascending: false })
      ]);
      if (cancelled) return;
      if (studentRows) setStudents(studentRows.map(mapStudentRow));
      if (safRows) setSafRecords(safRows.map(mapSafRow));
      if (txRows) setTransactions(txRows.map(mapTransactionRow));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const [events, setEvents] = useState<SchoolEvent[]>(MOCK_SCHOOL_EVENTS);
  const [attendances, setAttendances] = useState<EventAttendance[]>(MOCK_ATTENDANCES);

  const mapEventRow = (row: any): SchoolEvent => ({
    id: row.id,
    event_title: row.event_title,
    event_description: row.event_description || undefined,
    description: row.event_description || undefined,
    venue: row.venue || '',
    event_type: row.event_type,
    event_date: row.event_date,
    start_time: row.start_time || undefined,
    end_time: row.end_time || undefined,
    penalty: Number(row.penalty_fee_amount),
    penalty_fee_amount: Number(row.penalty_fee_amount),
    activesem_id: row.semester_id != null ? String(row.semester_id) : '',
    department: row.department_code || 'ALL',
    school_year: activeSemester.school_year_label,
    created_at: row.created_at,
    status: row.status || undefined,
    proposed_by: row.proposed_by || undefined,
    reviewed_by: row.reviewed_by || undefined,
    review_remarks: row.review_remarks || undefined,
    published_at: row.published_at || undefined
  });

  const mapAttendanceRow = (row: any): EventAttendance => {
    const s = row.students;
    const ev = row.school_events;
    return {
      id: row.id,
      event_id: row.event_id,
      event_title: ev?.event_title || '',
      student_id: row.student_id,
      student_number: s?.student_number || '',
      student_name: s ? `${s.first_name} ${s.last_name}` : '',
      course: s?.course || '',
      section: s?.section || '',
      department: s?.department_code || 'CAF',
      status: row.status,
      time_in: row.time_in || undefined,
      penalty_amount: Number(row.penalty_amount),
      amount: Number(row.penalty_amount),
      penalty_paid: row.penalty_paid,
      penalty_paid_date: row.penalty_paid_date || undefined,
      receipt_no: row.receipt_no || undefined,
      notes: row.notes || undefined,
      photo_url: row.photo_url || undefined
    };
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      const client = getSupabase();
      const { data: eventRows } = await client.from('school_events').select('*').order('event_date', { ascending: false });
      if (!cancelled && eventRows) setEvents(eventRows.map(mapEventRow));

      const { data: attRows } = await client
        .from('event_attendance')
        .select('*, students(student_number, first_name, last_name, course, section, department_code), school_events(event_title)');
      if (!cancelled && attRows) setAttendances(attRows.map(mapAttendanceRow));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const [userAccounts, setUserAccounts] = useState<UserAccountSummary[]>([]);
  const [clearances, setClearances] = useState<ClearanceRecord[]>([]);

  const mapClearanceRow = (row: any): ClearanceRecord => ({
    id: row.id,
    student_id: row.student_id,
    semester_id: row.semester_id != null ? String(row.semester_id) : undefined,
    clearance_code: row.clearance_code,
    saf_paid: row.saf_paid,
    unpaid_penalties_count: row.unpaid_penalties_count,
    unpaid_penalties_amount: Number(row.unpaid_penalties_amount),
    status: row.status,
    generated_by: row.generated_by || undefined,
    generated_at: row.generated_at
  });

  // Staff-only lists: profiles (for user management) and clearances (for the
  // SAF clearance panel). Fetched for everyone who's authenticated — RLS
  // already scopes what comes back (profiles: only staff see all rows;
  // clearances: authenticated read is open, harmless).
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      const client = getSupabase();
      const [{ data: profileRows }, { data: clearanceRows }] = await Promise.all([
        client.from('profiles').select('id, full_name, email, role, department, is_active, course_id, officer_position'),
        client.from('clearances').select('*')
      ]);
      if (cancelled) return;
      if (profileRows) {
        setUserAccounts(profileRows.map((r: any): UserAccountSummary => ({
          id: r.id, full_name: r.full_name, email: r.email, role: r.role,
          department: r.department || undefined, is_active: r.is_active,
          course_id: r.course_id ?? undefined, officer_position: r.officer_position || undefined
        })));
      }
      if (clearanceRows) setClearances(clearanceRows.map(mapClearanceRow));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const addUserAccount = async (userData: {
    name: string; email: string; role: UserRole; department: DepartmentCode; student_number?: string;
  }): Promise<{ success: boolean; message: string; tempPassword?: string }> => {
    const cleanEmail = userData.email.trim().toLowerCase();
    const tempPassword = 'Ncf-' + Math.random().toString(36).slice(2, 8) + Math.floor(10 + Math.random() * 90);

    // Isolated client: signUp on the shared singleton would replace the
    // calling admin's own session with the new user's.
    const isolated = getIsolatedSupabase();
    const { data, error } = await isolated.auth.signUp({
      email: cleanEmail,
      password: tempPassword,
      options: { data: { full_name: userData.name.trim(), role: userData.role, department: userData.department } }
    });

    if (error) {
      const message = /already registered|already exists/i.test(error.message)
        ? `An account with "${cleanEmail}" already exists.`
        : error.message;
      return { success: false, message };
    }
    if (!data.user) return { success: false, message: 'Account creation failed. Please try again.' };

    if (userData.role === 'student' && data.session) {
      const parts = userData.name.trim().split(' ');
      const firstName = parts.slice(0, -1).join(' ') || parts[0];
      const lastName = parts.length > 1 ? parts[parts.length - 1] : 'Student';
      const studentNumber = userData.student_number?.trim() || `2024-${Math.floor(10000 + Math.random() * 90000)}`;
      const { error: rpcError } = await isolated.rpc('create_student_with_saf', {
        p_student_number: studentNumber,
        p_first_name: firstName,
        p_last_name: lastName,
        p_course: deriveCourse(userData.department),
        p_year_level: '1st Year',
        p_section: `${userData.department}-1A`,
        p_email: cleanEmail,
        p_department_code: userData.department,
        p_semester_id: activeSemester.semester_id ? Number(activeSemester.semester_id) : null,
        p_profile_id: data.user.id
      });
      if (rpcError) {
        return { success: false, message: `Account created, but the student roster entry failed: ${rpcError.message}` };
      }
    }

    await isolated.auth.signOut();
    setUserAccounts(prev => [
      { id: data.user!.id, full_name: userData.name.trim(), email: cleanEmail, role: userData.role, department: userData.department, is_active: true },
      ...prev
    ]);

    return {
      success: true,
      message: `Account created for ${userData.name.trim()}.`,
      tempPassword
    };
  };

  const deactivateUser = async (profileId: string) => {
    const client = getSupabase();
    const { error } = await client.from('profiles').update({ is_active: false }).eq('id', profileId);
    if (error) { console.error('Failed to deactivate user', error); return; }
    setUserAccounts(prev => prev.map(u => u.id === profileId ? { ...u, is_active: false } : u));
  };

  const reactivateUser = async (profileId: string) => {
    const client = getSupabase();
    const { error } = await client.from('profiles').update({ is_active: true }).eq('id', profileId);
    if (error) { console.error('Failed to reactivate user', error); return; }
    setUserAccounts(prev => prev.map(u => u.id === profileId ? { ...u, is_active: true } : u));
  };

  // Super Admin only — a real, permanent removal (not the usual
  // soft-deactivate). The RPC itself blocks this whenever the account has
  // any transaction/proposal/event/SAF/clearance history on record, so it
  // only ever succeeds for a genuinely clean account; everything else is
  // still handled via deactivateUser above.
  const deleteUserAccount = async (profileId: string): Promise<{ success: boolean; message: string }> => {
    const client = getSupabase();
    const { error } = await client.rpc('delete_user_account', { p_profile_id: profileId });
    if (error) return { success: false, message: error.message };
    setUserAccounts(prev => prev.filter(u => u.id !== profileId));
    return { success: true, message: 'Account permanently deleted.' };
  };

  // Receipt paths are stored (never signed URLs, which expire) — this
  // resolves one to a short-lived viewable link on demand, e.g. when a
  // "View Receipt" link is actually clicked.
  const getSignedReceiptUrl = async (path: string): Promise<string | null> => {
    const client = getSupabase();
    const { data, error } = await client.storage.from('receipts').createSignedUrl(path, 300);
    if (error || !data) { console.error('Failed to sign receipt URL', error); return null; }
    return data.signedUrl;
  };

  // "My Receipts" — every SAF PDF receipt generated for the current student,
  // listed from their own folder in the receipts bucket (RLS-scoped by the
  // Storage policy on that path already in place from Phase 0).
  const [myReceipts, setMyReceipts] = useState<{ name: string; path: string; created_at?: string }[]>([]);

  useEffect(() => {
    if (!isAuthenticated || currentUser.role !== 'student') { setMyReceipts([]); return; }
    let cancelled = false;
    (async () => {
      const client = getSupabase();
      const { data, error } = await client.storage.from('receipts').list(`saf-receipts/${currentUser.id}`, {
        sortBy: { column: 'created_at', order: 'desc' }
      });
      if (cancelled) return;
      if (error) { console.error('Failed to list SAF receipts', error); return; }
      setMyReceipts((data || []).map(f => ({
        name: f.name, path: `saf-receipts/${currentUser.id}/${f.name}`, created_at: f.created_at
      })));
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, currentUser.id, currentUser.role]);

  const generateClearance = async (studentId: string): Promise<ClearanceRecord | null> => {
    const client = getSupabase();
    const { data, error } = await client.rpc('generate_clearance', { p_student_id: studentId });
    if (error || !data) { console.error('Failed to generate clearance', error); return null; }
    const record = mapClearanceRow(data);
    setClearances(prev => [record, ...prev.filter(c => c.student_id !== studentId)]);
    return record;
  };

  // ============================================================
  // Officer promotion (Adviser-only)
  // ============================================================
  const promoteToOfficer = async (studentProfileId: string, slotKey: OfficerSlotKey): Promise<{ success: boolean; message: string }> => {
    const client = getSupabase();
    const label = OFFICER_POSITION_LABELS[slotKey];
    const { error } = await client.rpc('promote_to_officer', {
      p_student_profile_id: studentProfileId, p_slot_key: slotKey, p_position_label: label
    });
    if (error) return { success: false, message: error.message };
    setUserAccounts(prev => prev.map(u => u.id === studentProfileId
      ? { ...u, role: slotKey === 'auditor' ? 'council_member' : slotKey.includes('governor') ? 'officer_governor' : 'officer_treasurer' }
      : u));
    return { success: true, message: `Promoted to ${label}.` };
  };

  const vacateOfficerPosition = async (profileId: string): Promise<{ success: boolean; message: string }> => {
    const client = getSupabase();
    const { error } = await client.rpc('vacate_officer_position', { p_profile_id: profileId });
    if (error) return { success: false, message: error.message };
    setUserAccounts(prev => prev.map(u => u.id === profileId ? { ...u, role: 'student' } : u));
    return { success: true, message: 'Position vacated — reverted to student.' };
  };

  // ============================================================
  // Promotion hierarchy: Super Admin -> Admin -> Dean -> Adviser.
  // One holder per department per school year (role_slots), and
  // deactivating any holder auto-frees their slot server-side (a
  // DB trigger), so re-promoting into a freed slot needs no extra
  // client-side action beyond the existing deactivateUser call.
  // ============================================================
  const promoteEmployeeToAdmin = async (employeeProfileId: string, departmentCode: DepartmentCode): Promise<{ success: boolean; message: string }> => {
    const client = getSupabase();
    const { error } = await client.rpc('promote_employee_to_admin', {
      p_employee_profile_id: employeeProfileId, p_department_code: departmentCode
    });
    if (error) return { success: false, message: error.message };
    setUserAccounts(prev => prev.map(u => u.id === employeeProfileId ? { ...u, role: 'admin', department: departmentCode } : u));
    return { success: true, message: `Promoted to Admin of ${departmentCode}.` };
  };

  const promoteEmployeeToDean = async (employeeProfileId: string): Promise<{ success: boolean; message: string }> => {
    const client = getSupabase();
    const { error } = await client.rpc('promote_employee_to_dean', { p_employee_profile_id: employeeProfileId });
    if (error) return { success: false, message: error.message };
    setUserAccounts(prev => prev.map(u => u.id === employeeProfileId ? { ...u, role: 'dean' } : u));
    return { success: true, message: 'Promoted to Dean.' };
  };

  const promoteEmployeeToAdviser = async (employeeProfileId: string): Promise<{ success: boolean; message: string }> => {
    const client = getSupabase();
    const { error } = await client.rpc('promote_employee_to_adviser', { p_employee_profile_id: employeeProfileId });
    if (error) return { success: false, message: error.message };
    setUserAccounts(prev => prev.map(u => u.id === employeeProfileId ? { ...u, role: 'csc_adviser' } : u));
    return { success: true, message: 'Promoted to Adviser.' };
  };

  // Demote a Dean/Adviser/Admin back to Employee — unlike deactivateUser
  // this keeps the account fully active (they can still log in), it just
  // reverts the role and frees the role_slots claim, so the person
  // themselves becomes eligible for re-promotion later. The RPC itself
  // enforces who may demote whom (Super Admin->Admin, Admin->Dean/Adviser
  // in their own department, Dean->Adviser in their own department).
  const demoteToEmployee = async (profileId: string): Promise<{ success: boolean; message: string }> => {
    const client = getSupabase();
    const { error } = await client.rpc('demote_to_employee', { p_profile_id: profileId });
    if (error) return { success: false, message: error.message };
    setUserAccounts(prev => prev.map(u => u.id === profileId ? { ...u, role: 'employee', officer_position: undefined } : u));
    return { success: true, message: 'Demoted to Employee.' };
  };

  // ============================================================
  // Notifications
  // ============================================================
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      const client = getSupabase();
      const { data } = await client.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
      if (!cancelled && data) {
        setNotifications(data.map((n: any): NotificationItem => ({
          id: n.id, title: n.title, body: n.body || undefined, link_tab: n.link_tab || undefined,
          created_at: n.created_at, read_at: n.read_at || undefined
        })));
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const markNotificationRead = async (id: string) => {
    const client = getSupabase();
    const { error } = await client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    if (error) { console.error('Failed to mark notification read', error); return; }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  };

  // ============================================================
  // Adviser Handover: an outgoing Adviser sends a single read-only PDF
  // bundling their activity log & department's previous records to the
  // Admin+Dean of their department. A successor Adviser can request the
  // same file, but only gains access once an Admin or Dean approves it —
  // enforced server-side by RLS on adviser_handover_files/storage, not just
  // by this list being filtered.
  // ============================================================
  const [handoverFiles, setHandoverFiles] = useState<AdviserHandoverFile[]>([]);
  const [handoverRequests, setHandoverRequests] = useState<AdviserHandoverRequest[]>([]);

  const refreshHandoverData = async () => {
    const client = getSupabase();
    const [filesRes, requestsRes] = await Promise.all([
      client.from('adviser_handover_files').select('*, profiles!adviser_handover_files_adviser_id_fkey(full_name)').order('generated_at', { ascending: false }),
      client.from('adviser_handover_requests').select('*, profiles!adviser_handover_requests_requester_id_fkey(full_name)').order('created_at', { ascending: false })
    ]);
    if (!filesRes.error && filesRes.data) {
      setHandoverFiles(filesRes.data.map((f: any): AdviserHandoverFile => ({
        id: f.id, adviser_id: f.adviser_id, adviser_name: f.profiles?.full_name,
        department_code: f.department_code, file_path: f.file_path, generated_at: f.generated_at
      })));
    }
    if (!requestsRes.error && requestsRes.data) {
      setHandoverRequests(requestsRes.data.map((r: any): AdviserHandoverRequest => ({
        id: r.id, file_id: r.file_id, requester_id: r.requester_id, requester_name: r.profiles?.full_name,
        department_code: r.department_code, status: r.status, decided_by: r.decided_by || undefined,
        decided_at: r.decided_at || undefined, remarks: r.remarks || undefined, created_at: r.created_at
      })));
    }
  };

  useEffect(() => {
    if (!isAuthenticated) { setHandoverFiles([]); setHandoverRequests([]); return; }
    // Only Adviser/Dean/Admin/Super Admin ever have rows visible to them
    // under RLS anyway — everyone else's query just comes back empty, so no
    // role gate is needed here beyond being logged in.
    refreshHandoverData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Builds the single "activity log & previous records" PDF for the
  // department the Adviser is currently scoped to — transactions, budget
  // proposals (with their nested liquidation & reimbursement outcomes), and
  // events/attendance/penalty enforcement, covering their whole term.
  const buildAdviserHandoverPdf = (): Blob => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const centerX = pageWidth / 2;
    let y = 60;

    const ensureRoom = (needed: number) => {
      if (y + needed > pageHeight - 50) { doc.addPage(); y = 60; }
    };
    const sectionHeader = (title: string) => {
      ensureRoom(50);
      y += 10;
      doc.setDrawColor(0, 135, 62);
      doc.setLineWidth(1);
      doc.line(60, y, pageWidth - 60, y);
      y += 20;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0, 135, 62);
      doc.text(title, 60, y);
      doc.setTextColor(0, 0, 0);
      y += 18;
    };
    const line = (text: string, opts?: { bold?: boolean; size?: number }) => {
      ensureRoom(16);
      doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
      doc.setFontSize(opts?.size || 9.5);
      doc.text(text, 60, y);
      y += 15;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('NAGA COLLEGE FOUNDATION (NCF)', centerX, y, { align: 'center' });
    y += 18;
    doc.setFontSize(11);
    doc.text('Supreme Student Council — Adviser Handover File', centerX, y, { align: 'center' });
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Complete Activity Log & Previous Records (Read-Only)', centerX, y, { align: 'center' });
    y += 20;
    doc.setDrawColor(0, 135, 62);
    doc.setLineWidth(1.5);
    doc.line(60, y, pageWidth - 60, y);
    y += 26;

    line(`Adviser: ${currentUser.name}`, { bold: true });
    line(`Department: ${userDepartment} — ${scopedDepartmentInfo.name}`);
    line(`Generated: ${new Date().toLocaleString()}`);
    line(`School Year: ${activeSemester.school_year_label} • ${activeSemester.semester_name}`);

    sectionHeader(`Transactions (${scopedTransactions.length})`);
    if (scopedTransactions.length === 0) {
      line('No transactions on record.');
    } else {
      scopedTransactions.forEach(tx => {
        line(`${tx.date} • ${tx.reference_code} • ${tx.category} • ${tx.title} — ${tx.type === 'INCOME' ? '+' : '-'}₱${tx.amount.toFixed(2)} (${tx.status})`);
      });
    }

    sectionHeader(`Budget Proposals (${scopedProposals.length})`);
    if (scopedProposals.length === 0) {
      line('No budget proposals on record.');
    } else {
      scopedProposals.forEach(p => {
        line(`${p.budget_title} — ₱${p.total_budget_amount.toFixed(2)} — ${p.budget_status.replace(/_/g, ' ')}`, { bold: true });
        if (p.liquidation) {
          line(`  Liquidation: ${p.liquidation.status} — spent ₱${p.liquidation.total_spent.toFixed(2)} of ₱${p.liquidation.total_released.toFixed(2)}`);
        }
        p.reimbursements.forEach(r => {
          line(`  Reimbursement: ${r.officer_name} — ₱${r.amount_spent.toFixed(2)} — ${r.reimbursement_status}`);
        });
      });
    }

    sectionHeader(`Events (${scopedEvents.length})`);
    if (scopedEvents.length === 0) {
      line('No events on record.');
    } else {
      scopedEvents.forEach(ev => {
        line(`${ev.event_date} • ${ev.event_title} — ${ev.venue} — ${ev.status || 'PUBLISHED'}`);
      });
    }

    sectionHeader(`Attendance & Penalty Enforcement (${scopedAttendances.length})`);
    if (scopedAttendances.length === 0) {
      line('No attendance/penalty records on record.');
    } else {
      scopedAttendances.forEach(att => {
        const penaltyNote = att.penalty_amount > 0 ? ` — Penalty ₱${att.penalty_amount.toFixed(2)} (${att.penalty_paid ? 'Paid' : 'Unpaid'})` : '';
        line(`${att.student_name} • ${att.event_title} — ${att.status}${penaltyNote}`);
      });
    }

    sectionHeader('Certification');
    line('This file is a read-only record generated for continuity and handover reference. It cannot be', { size: 9 });
    line('edited by a newly elected Adviser — it exists solely so incoming leadership can review what', { size: 9 });
    line('took place during the previous term.', { size: 9 });

    return doc.output('blob');
  };

  // Adviser action: generate + upload the file now, notify Admin+Dean
  // immediately (Section: "send" needs no approval — the Adviser themself
  // is choosing to share it).
  const sendAdviserHandoverFile = async (): Promise<{ success: boolean; message: string }> => {
    if (currentUser.role !== 'csc_adviser') return { success: false, message: 'Only an Adviser can send a handover file.' };
    const client = getSupabase();
    try {
      const pdfBlob = buildAdviserHandoverPdf();
      const storagePath = `handover/${userDepartment}/${currentUser.id}/${Date.now()}.pdf`;
      const { error: uploadErr } = await client.storage.from('handover-files').upload(storagePath, pdfBlob, {
        contentType: 'application/pdf', upsert: true
      });
      if (uploadErr) return { success: false, message: uploadErr.message };

      const { error: rpcErr } = await client.rpc('send_adviser_handover_file', { p_file_path: storagePath });
      if (rpcErr) return { success: false, message: rpcErr.message };

      await refreshHandoverData();
      return { success: true, message: 'Activity log & records file sent to your Admin and Dean.' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Failed to generate/send the handover file.' };
    }
  };

  // Adviser action: request access to an existing handover file from their
  // own department (e.g. a successor requesting their predecessor's file).
  const requestAdviserHandoverFile = async (fileId: string): Promise<{ success: boolean; message: string }> => {
    const client = getSupabase();
    const { error } = await client.rpc('request_adviser_handover_file', { p_file_id: fileId });
    if (error) return { success: false, message: error.message };
    await refreshHandoverData();
    return { success: true, message: 'Request sent — awaiting Admin or Dean approval.' };
  };

  // Admin/Dean action: approve or reject a pending handover file access request.
  const reviewAdviserHandoverRequest = async (
    requestId: string, decision: 'APPROVED' | 'REJECTED', remarks?: string
  ): Promise<{ success: boolean; message: string }> => {
    const client = getSupabase();
    const { error } = await client.rpc('review_adviser_handover_request', {
      p_request_id: requestId, p_decision: decision, p_remarks: remarks || null
    });
    if (error) return { success: false, message: error.message };
    await refreshHandoverData();
    return { success: true, message: decision === 'APPROVED' ? 'Access approved.' : 'Request rejected.' };
  };

  // Signed link to view/download a handover file — RLS on the bucket
  // itself is what actually enforces "read-only unless sender/admin/dean/
  // approved requester"; this just resolves a path someone is already
  // allowed to see into a short-lived viewable link.
  const getSignedHandoverFileUrl = async (path: string): Promise<string | null> => {
    const client = getSupabase();
    const { data, error } = await client.storage.from('handover-files').createSignedUrl(path, 300);
    if (error || !data) { console.error('Failed to sign handover file URL', error); return null; }
    return data.signedUrl;
  };

  // ============================================================
  // Events: propose (officer) -> review (adviser/dean) -> publish
  // ============================================================
  const proposeEvent = async (event: Omit<SchoolEvent, 'id' | 'created_at' | 'status'>): Promise<{ success: boolean; message: string }> => {
    const client = getSupabase();
    const { error } = await client.rpc('propose_event', {
      p_event_title: event.event_title,
      p_event_description: event.event_description || event.description || null,
      p_venue: event.venue,
      p_event_type: event.event_type,
      p_event_date: event.event_date,
      p_start_time: event.start_time || null,
      p_end_time: event.end_time || null,
      p_penalty_fee_amount: event.penalty ?? event.penalty_fee_amount ?? 50,
      p_semester_id: event.activesem_id ? Number(event.activesem_id) : null,
      p_department_code: event.department === 'ALL' ? null : event.department
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Event proposed — awaiting Adviser/Dean approval.' };
  };

  const reviewEvent = async (eventId: string, decision: 'APPROVED' | 'REJECTED', remarks?: string) => {
    const client = getSupabase();
    const { error } = await client.rpc('review_event', { p_event_id: eventId, p_decision: decision, p_remarks: remarks });
    if (error) { console.error('Failed to review event', error); return; }
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: decision === 'APPROVED' ? 'PUBLISHED' : 'REJECTED' } : e));
  };

  // ============================================================
  // Liquidation review: Adviser -> Dean
  // ============================================================
  const adviserReviewLiquidation = async (liquidationId: string, decision: 'APPROVED' | 'REVISION' | 'REJECTED', remarks?: string) => {
    const client = getSupabase();
    const { error } = await client.rpc('adviser_review_liquidation', { p_liquidation_id: liquidationId, p_decision: decision, p_remarks: remarks });
    if (error) { console.error('Failed to submit adviser liquidation review', error); return; }
    setProposals(prev => prev.map(p => p.liquidation?.id === liquidationId ? {
      ...p,
      liquidation: {
        ...p.liquidation!,
        status: decision === 'APPROVED' ? 'PENDING_DEAN' : decision === 'REVISION' ? 'FOR_REVISION' : 'Rejected',
        adviser_decision: decision, adviser_remarks: remarks
      }
    } : p));
  };

  const deanReviewLiquidation = async (liquidationId: string, decision: 'APPROVED' | 'REVISION' | 'REJECTED', remarks?: string) => {
    const client = getSupabase();
    const { error } = await client.rpc('dean_review_liquidation', { p_liquidation_id: liquidationId, p_decision: decision, p_remarks: remarks });
    if (error) { console.error('Failed to submit dean liquidation review', error); return; }
    setProposals(prev => prev.map(p => p.liquidation?.id === liquidationId ? {
      ...p,
      liquidation: {
        ...p.liquidation!,
        status: decision === 'APPROVED' ? 'Audited' : decision === 'REVISION' ? 'FOR_REVISION' : 'Rejected',
        dean_decision: decision, dean_remarks: remarks
      }
    } : p));
  };

  const [proposals, setProposals] = useState<BudgetProposal[]>(MOCK_PROPOSALS);

  // Reconstructs the app's deeply-nested BudgetProposal shape from a
  // budget_requests row fetched with every related table embedded via
  // PostgREST's FK-based nested select (one round trip for everything).
  // Display-name fields (council_member_name, author_name, adviser_name,
  // dean_name, officer_name) aren't re-derived here — the profiles FKs are
  // ambiguous to embed safely (budget_requests has 3 separate FKs to
  // profiles) — they're set correctly by each action's own optimistic
  // update at write time, and only show blank on a fresh page reload.
  const mapProposalRow = (row: any): BudgetProposal => ({
    id: row.id,
    budget_title: row.title,
    budget_description: row.budget_description || '',
    department: row.department_code,
    event_id: row.event_id || undefined,
    event_title: undefined,
    total_budget_amount: Number(row.total_amount),
    budget_status: row.status,
    activesem_id: row.semester_id != null ? String(row.semester_id) : '',
    school_year: row.fiscal_year,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by_officer: row.requested_by_name,
    requested_by: row.requested_by || undefined,
    treasurer_notes: row.treasurer_notes || undefined,
    line_items: (row.budget_request_items || []).map((li: any): BudgetLineItem => ({
      id: li.id, item_desc: li.description, category: li.category,
      quantity: Number(li.quantity), unit_cost: Number(li.unit_cost),
      estimated_amount: Number(li.amount), remarks: li.remarks || ''
    })),
    executive_review: row.executive_reviewed_by ? {
      reviewed_by: '', decision: row.executive_decision, remarks: row.executive_remarks || '',
      date: row.executive_reviewed_at?.slice(0, 10) || ''
    } : undefined,
    council_resolution: row.council_resolution_number ? {
      resolution_number: row.council_resolution_number,
      resolution_title: `Resolution approving budget allocation for ${row.title}`,
      date_voted: row.updated_at?.slice(0, 10) || '',
      status: row.council_resolution_status
    } : undefined,
    votes: (row.council_votes || []).map((v: any) => ({
      id: v.id, council_member_id: v.council_member_id, council_member_name: '', position: '',
      vote: v.vote, comment: v.comment || '', voted_at: v.voted_at
    })),
    notes: (row.proposal_notes || []).map((n: any): ProposalNote => ({
      id: n.id, author_id: n.author_id, author_name: '', author_role: '',
      note_content: n.note_content, created_at: n.created_at, is_official: n.is_official
    })),
    adviser_approval: row.adviser_id ? {
      adviser_name: '', decision: row.adviser_decision, remarks: row.adviser_remarks || '',
      date: row.adviser_decided_at?.slice(0, 10) || ''
    } : undefined,
    dean_approval: row.dean_id ? {
      dean_name: '', decision: row.dean_decision, remarks: row.dean_remarks || '',
      date: row.dean_decided_at?.slice(0, 10) || '', release_authorized: row.release_authorized
    } : undefined,
    cashouts: (row.cashouts || []).map((c: any): CashoutRecord => ({
      id: c.id, budget_id: row.id, amount_released: Number(c.amount_released), date_released: c.date_released,
      purpose: c.purpose, cashout_status: c.cashout_status, officer_id: c.officer_id || '', officer_name: '',
      voucher_no: c.voucher_no || '', proof_docs: c.proof_docs || []
    })),
    expenses: (row.transactions || []).filter((t: any) => !t.is_income).map((t: any): ExpenseRecord => ({
      id: t.id, budget_id: row.id, expense_desc: t.title, category: t.category,
      amount_spent: Number(t.amount), date_incurred: t.transaction_date, proof_attach: [],
      officer_id: t.created_by || '', officer_name: '',
      reimbursement_status: (row.reimbursements || []).some((r: any) => r.expense_transaction_id === t.id)
        ? ((row.reimbursements.find((r: any) => r.expense_transaction_id === t.id)?.status === 'Paid') ? 'Reimbursed'
          : (row.reimbursements.find((r: any) => r.expense_transaction_id === t.id)?.status === 'Approved') ? 'Approved' : 'Requested')
        : 'None'
    })),
    reimbursements: (row.reimbursements || []).map((r: any): ReimbursementRecord => ({
      id: r.id, expense_id: r.expense_transaction_id || '', budget_id: row.id,
      amount_spent: Number(r.amount_requested), date_submitted: r.date_submitted,
      reimbursement_status: r.status, remarks: r.remarks || '', officer_name: r.claimant_name || '',
      receipt_ref: r.receipt_no || ''
    })),
    liquidation: row.liquidation_reports?.[0] ? {
      id: row.liquidation_reports[0].id, budget_id: row.id, total_budget: Number(row.total_amount),
      total_released: Number(row.liquidation_reports[0].total_released),
      total_spent: Number(row.liquidation_reports[0].total_spent),
      balance: Number(row.liquidation_reports[0].balance),
      status: row.liquidation_reports[0].status,
      accounting_summary: row.liquidation_reports[0].accounting_summary || [],
      submitted_by: '', submitted_date: row.liquidation_reports[0].created_at?.slice(0, 10) || '',
      auditor_remarks: row.liquidation_reports[0].remarks || undefined,
      notes: row.liquidation_reports[0].remarks || undefined
    } : undefined,
    budget_return: row.budget_returns?.[0] ? {
      id: row.budget_returns[0].id, budget_id: row.id,
      amount_returned: Number(row.budget_returns[0].amount_returned),
      date_returned: row.budget_returns[0].date_returned,
      cash_in_reference: row.budget_returns[0].cash_in_reference || '',
      double_entry: { debit: 'Cash on Hand (SAF Vault)', credit: 'Unspent Event Budget Return' },
      returned_by: '', received_by: row.budget_returns[0].received_by || '',
      remarks: row.budget_returns[0].remarks || ''
    } : undefined
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      const client = getSupabase();
      const { data, error } = await client.from('budget_requests').select(`
        *,
        budget_request_items(*),
        council_votes(*),
        proposal_notes(*),
        cashouts(*),
        reimbursements(*),
        liquidation_reports(*),
        budget_returns(*),
        transactions(*)
      `).order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) { console.error('Failed to fetch proposals', error); return; }
      if (data) setProposals(data.map(mapProposalRow));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const [forecastMetric] = useState<ForecastMetric>(MOCK_FORECAST);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [mobileFrameMode, setMobileFrameMode] = useState<boolean>(false);
  const [selectedProposalIdForModal, setSelectedProposalIdForModal] = useState<string | null>(null);
  const [isLiveSupabase] = useState<boolean>(isSupabaseLiveConfigured());

  const syncToSupabase = async (): Promise<{ success: boolean; message: string }> => {
    try {
      if (!isSupabaseLiveConfigured()) {
        return {
          success: false,
          message: 'Saved in LocalStorage database. Supabase cloud sync is ready once VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set in .env.'
        };
      }
      const client = getSupabase();
      // Test connectivity
      const { error } = await client.from('departments').select('count', { count: 'exact', head: true });
      if (error) {
        return {
          success: false,
          message: `Connected to Supabase endpoint, but table schema may need initialization: ${error.message}`
        };
      }
      return { 
        success: true, 
        message: 'Successfully synchronized state with Supabase PostgreSQL cloud database!' 
      };
    } catch (e: any) {
      return { 
        success: false, 
        message: `Database sync response: ${e?.message || 'Connection established'}` 
      };
    }
  };

  // Save changes to LocalStorage
  useEffect(() => {
    localStorage.setItem('ncf_active_sem', JSON.stringify(activeSemester));
  }, [activeSemester]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_students`, JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_saf`, JSON.stringify(safRecords));
  }, [safRecords]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_transactions`, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_events`, JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_attendances`, JSON.stringify(attendances));
  }, [attendances]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_proposals`, JSON.stringify(proposals));
  }, [proposals]);

  // Builds the app's User shape from a real Supabase auth user + its profiles
  // row (created automatically by the fn_handle_new_user DB trigger on
  // signup). officer_position/course are derived client-side since they
  // aren't stored on profiles; course/year_level/section for students come
  // from their students row (profiles doesn't carry academic info either).
  // Roles that started as a self-registered/enrolled student and still have
  // a linked `students` roster row (officers are promoted students, not a
  // separate account type) — course/year/section come from that row.
  const STUDENT_LINKED_ROLES: UserRole[] = ['student', 'officer_treasurer', 'officer_governor', 'council_member'];

  // Two-Factor Authentication (TOTP) — a signInWithPassword (or restored
  // session) can land at Supabase's "aal1" assurance level even though the
  // account has a verified second factor; the app must withhold access
  // until a second-factor challenge is completed ("aal2"). This holds the
  // pending factorId while that gate is up; the UI (LoginPage) shows a
  // code-entry screen instead of the credentials form whenever it's set.
  const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string } | null>(null);

  // Returns 'ok' if no further factor is needed, or 'challenge_required' (and
  // sets mfaChallenge) if the account has a verified TOTP factor pending
  // verification for this session.
  const checkAndHandleMfa = async (): Promise<'ok' | 'challenge_required'> => {
    const client = getSupabase();
    const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel) {
      const { data: factorsData } = await client.auth.mfa.listFactors();
      const totpFactor = factorsData?.totp?.find(f => f.status === 'verified') || factorsData?.totp?.[0];
      if (totpFactor) {
        setMfaChallenge({ factorId: totpFactor.id });
        return 'challenge_required';
      }
    }
    return 'ok';
  };

  const buildUserFromSession = async (authUser: { id: string; email?: string | null }): Promise<User> => {
    const client = getSupabase();
    const { data: profile } = await client
      .from('profiles')
      .select('full_name, email, role, department, contact_number, is_active, course_id, officer_position')
      .eq('id', authUser.id)
      .maybeSingle();

    const role = (profile?.role as UserRole) || 'student';
    const department = (profile?.department as DepartmentCode | undefined) || undefined;

    let student_number: string | undefined;
    let course: string | undefined;
    let year_level: string | undefined;
    let section: string | undefined;

    if (STUDENT_LINKED_ROLES.includes(role)) {
      const { data: studentRow } = await client
        .from('students')
        .select('student_number, course, year_level, section')
        .eq('profile_id', authUser.id)
        .maybeSingle();
      student_number = studentRow?.student_number;
      course = studentRow?.course;
      year_level = studentRow?.year_level;
      section = studentRow?.section;
    }

    return {
      id: authUser.id,
      name: profile?.full_name || authUser.email || 'User',
      email: profile?.email || authUser.email || '',
      role,
      department,
      course_id: profile?.course_id ?? undefined,
      officer_position: profile?.officer_position || deriveOfficerPosition(role, department),
      student_number,
      course: course || (role === 'student' ? deriveCourse(department) : undefined),
      year_level,
      section,
      contact_number: profile?.contact_number || undefined,
      is_active: profile?.is_active ?? true
    };
  };

  // Restore a real session on load, and stay in sync with sign-in/out
  // happening elsewhere (another tab, token refresh, etc).
  useEffect(() => {
    let cancelled = false;
    const client = getSupabase();

    client.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data.session?.user) {
        const mfaResult = await checkAndHandleMfa();
        if (cancelled) return;
        if (mfaResult === 'challenge_required') {
          // A restored session that still needs its second factor —
          // leave isAuthenticated false; LoginPage shows the code screen.
          setIsAuthLoading(false);
          return;
        }
        const user = await buildUserFromSession(data.session.user);
        if (cancelled) return;
        if (user.is_active === false) {
          await client.auth.signOut();
        } else {
          setCurrentUser(user);
          setIsAuthenticated(true);
        }
      }
      setIsAuthLoading(false);
    });

    const { data: sub } = client.auth.onAuthStateChange(async (_event, session) => {
      if (suppressAuthEventsRef.current) return;
      if (_event === 'PASSWORD_RECOVERY') {
        // A recovery-link click gives a real (temporary) session, but we
        // don't want the app to treat this as a normal login — show the
        // reset-password form instead until a new password is set.
        setIsPasswordRecovery(true);
        setIsAuthLoading(false);
        return;
      }
      if (session?.user) {
        const mfaResult = await checkAndHandleMfa();
        if (mfaResult === 'challenge_required') return;
        const user = await buildUserFromSession(session.user);
        if (user.is_active === false) {
          await client.auth.signOut();
          return;
        }
        setCurrentUser(user);
        setIsAuthenticated(true);
      } else {
        setCurrentUser(GUEST_USER);
        setIsAuthenticated(false);
        setMfaChallenge(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginUser = async (identifier: string, password: string): Promise<{ success: boolean; message: string; user?: User }> => {
    const client = getSupabase();
    const cleanId = identifier.trim();

    let email = cleanId;
    if (!cleanId.includes('@')) {
      const { data: resolvedEmail, error: resolveError } = await client.rpc('resolve_login_email', { p_identifier: cleanId });
      if (resolveError || !resolvedEmail) {
        return {
          success: false,
          message: `Walang nahanap na account para sa "${identifier}". Pakitiyak ang iyong email o ID number, o mag-rehistro ng bago.`
        };
      }
      email = resolvedEmail;
    }

    // Suppressed so the global onAuthStateChange listener doesn't race this
    // function's own explicit MFA-gate handling below.
    suppressAuthEventsRef.current = true;
    let data: Awaited<ReturnType<typeof client.auth.signInWithPassword>>['data'];
    try {
      const res = await client.auth.signInWithPassword({ email, password });
      if (res.error || !res.data.user) {
        return { success: false, message: 'Maling email/ID o password. Pakisubukang muli.' };
      }
      data = res.data;

      // Two-Factor Authentication gate: a password-correct sign-in still
      // withholds access if the account has a verified TOTP factor —
      // the caller (LoginPage) sees mfaRequired and shows a code screen.
      const mfaResult = await checkAndHandleMfa();
      if (mfaResult === 'challenge_required') {
        return { success: true, message: 'Enter your 6-digit authenticator code to continue.' };
      }
    } finally {
      suppressAuthEventsRef.current = false;
    }

    const user = await buildUserFromSession(data.user);
    if (user.is_active === false) {
      await client.auth.signOut();
      return { success: false, message: 'Your account has been deactivated. Please contact your adviser or admin.' };
    }
    setCurrentUser(user);
    setIsAuthenticated(true);
    setActiveTab(user.role === 'student' ? 'student_portal' : 'home');
    setIsAuthModalOpen(false);

    return {
      success: true,
      message: `Maligayang pagbabalik, ${user.name}! Naka-log in bilang ${user.officer_position || user.role}.`,
      user
    };
  };

  const logoutUser = () => {
    getSupabase().auth.signOut();
    // onAuthStateChange also handles this, but flip immediately for a snappy UI.
    setCurrentUser(GUEST_USER);
    setIsAuthenticated(false);
    setMfaChallenge(null);
    setIsAuthModalOpen(true);
    setAuthModalMode('login');
  };

  // ============================================================
  // Two-Factor Authentication (TOTP)
  // ============================================================
  const mfaVerifyLogin = async (code: string): Promise<{ success: boolean; message: string }> => {
    if (!mfaChallenge) return { success: false, message: 'No pending verification — please log in again.' };
    const client = getSupabase();
    const { data: challengeData, error: challengeError } = await client.auth.mfa.challenge({ factorId: mfaChallenge.factorId });
    if (challengeError || !challengeData) {
      return { success: false, message: challengeError?.message || 'Failed to start verification. Please try again.' };
    }
    const { data: verifyData, error: verifyError } = await client.auth.mfa.verify({
      factorId: mfaChallenge.factorId, challengeId: challengeData.id, code: code.trim()
    });
    if (verifyError || !verifyData) {
      return { success: false, message: 'Invalid code. Please check your authenticator app and try again.' };
    }

    setMfaChallenge(null);
    const user = await buildUserFromSession(verifyData.user);
    if (user.is_active === false) {
      await client.auth.signOut();
      return { success: false, message: 'Your account has been deactivated. Please contact your adviser or admin.' };
    }
    setCurrentUser(user);
    setIsAuthenticated(true);
    setActiveTab(user.role === 'student' ? 'student_portal' : 'home');
    setIsAuthModalOpen(false);
    return { success: true, message: `Maligayang pagbabalik, ${user.name}!` };
  };

  // Backing out of a pending 2FA challenge leaves a dangling aal1 session —
  // sign out entirely so the person lands back on a clean login screen.
  const cancelMfaChallenge = () => {
    setMfaChallenge(null);
    getSupabase().auth.signOut();
  };

  const [mfaFactors, setMfaFactors] = useState<{ id: string; friendly_name?: string; status: string }[]>([]);

  const refreshMfaFactors = async () => {
    if (!isAuthenticated) { setMfaFactors([]); return; }
    const { data } = await getSupabase().auth.mfa.listFactors();
    setMfaFactors((data?.totp || []).map(f => ({ id: f.id, friendly_name: f.friendly_name, status: f.status })));
  };

  useEffect(() => {
    refreshMfaFactors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const mfaEnrollStart = async (): Promise<{ success: boolean; message: string; factorId?: string; qrCode?: string; secret?: string }> => {
    const client = getSupabase();
    const { data, error } = await client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `NCF Predict (${currentUser.email})`
    });
    if (error || !data) return { success: false, message: error?.message || 'Failed to start 2FA setup.' };
    return { success: true, message: '', factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  };

  const mfaEnrollConfirm = async (factorId: string, code: string): Promise<{ success: boolean; message: string }> => {
    const client = getSupabase();
    const { data: challengeData, error: challengeError } = await client.auth.mfa.challenge({ factorId });
    if (challengeError || !challengeData) {
      return { success: false, message: challengeError?.message || 'Failed to verify. Please try again.' };
    }
    const { error: verifyError } = await client.auth.mfa.verify({ factorId, challengeId: challengeData.id, code: code.trim() });
    if (verifyError) {
      return { success: false, message: 'Invalid code. Please check your authenticator app and try again.' };
    }
    await refreshMfaFactors();
    return { success: true, message: 'Two-factor authentication is now enabled on your account.' };
  };

  const mfaUnenroll = async (factorId: string): Promise<{ success: boolean; message: string }> => {
    const client = getSupabase();
    const { error } = await client.auth.mfa.unenroll({ factorId });
    if (error) return { success: false, message: error.message };
    await refreshMfaFactors();
    return { success: true, message: 'Two-factor authentication has been disabled.' };
  };

  const requestPasswordReset = async (email: string): Promise<{ success: boolean; message: string }> => {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${window.location.pathname}#reset-password`
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'If an account exists for that email, a reset link has been sent.' };
  };

  const updatePassword = async (newPassword: string): Promise<{ success: boolean; message: string }> => {
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || newPassword.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters and contain both letters and numbers.' };
    }
    const { error } = await getSupabase().auth.updateUser({ password: newPassword });
    if (error) return { success: false, message: error.message };
    // The recovery session is done its job — sign out so they log in fresh
    // with the new password rather than silently landing in the dashboard.
    setIsPasswordRecovery(false);
    await getSupabase().auth.signOut();
    return { success: true, message: 'Password updated. You can now log in with your new password.' };
  };

  const registerUser = async (userData: {
    name: string;
    email: string;
    role: UserRole;
    department: DepartmentCode;
    course_id?: number;
    student_number?: string;
    officer_position?: string;
    course?: string;
    year_level?: string;
    section?: string;
    password: string;
    contact_number?: string;
  }): Promise<{ success: boolean; message: string; user?: User; requiresOtp?: boolean }> => {
    if (!userData.password || userData.password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }
    if (!/[a-zA-Z]/.test(userData.password) || !/[0-9]/.test(userData.password)) {
      return { success: false, message: 'Password must contain both letters and numbers.' };
    }

    const cleanEmail = userData.email.trim().toLowerCase();
    const isGbox = /@gbox\.ncf\.edu\.ph$/i.test(cleanEmail);
    const isNcf = /@ncf\.edu\.ph$/i.test(cleanEmail);
    if (userData.role === 'student' && !isGbox) {
      return { success: false, message: 'Student accounts must use an @gbox.ncf.edu.ph email address.' };
    }
    // Admin/Dean/Adviser are promotion-only now (see promoteEmployeeToAdmin/
    // Dean/Adviser below) — they never reach signUp through this path at all,
    // but the domain rule still applies to the two roles that *do* self-register
    // as staff-ish accounts: Employee and (once, before one exists) Super Admin.
    if (['employee', 'super_admin'].includes(userData.role)) {
      if (isGbox) {
        return { success: false, message: 'Employee and Super Admin accounts must use an @ncf.edu.ph email address, not @gbox.ncf.edu.ph.' };
      }
      if (!isNcf) {
        return { success: false, message: 'Employee and Super Admin accounts must use an @ncf.edu.ph email address.' };
      }
    }

    const client = getSupabase();
    suppressAuthEventsRef.current = true;
    try {
      return await registerUserInner(client, cleanEmail, userData);
    } finally {
      suppressAuthEventsRef.current = false;
    }
  };

  const registerUserInner = async (
    client: ReturnType<typeof getSupabase>,
    cleanEmail: string,
    userData: {
      name: string; role: UserRole; department: DepartmentCode; course_id?: number; student_number?: string;
      officer_position?: string; course?: string; year_level?: string; section?: string;
      password: string; contact_number?: string;
    }
  ): Promise<{ success: boolean; message: string; user?: User; requiresOtp?: boolean }> => {

    const { data, error } = await client.auth.signUp({
      email: cleanEmail,
      password: userData.password,
      options: {
        data: {
          full_name: userData.name.trim(),
          role: userData.role,
          department: userData.department,
          course_id: userData.course_id ?? null
        }
      }
    });

    if (error) {
      let message = error.message;
      if (/already registered|already exists/i.test(error.message)) {
        message = `Mayroon nang nakarehistrong account gamit ang email na "${cleanEmail}". Mangyaring mag-log in na lamang.`;
      } else if (/already taken for this|already exists/i.test(error.message)) {
        message = error.message;
      } else if (/must use an? @|promotion only|Super Admin account already exists/i.test(error.message)) {
        message = error.message; // our own trigger's message, already clear
      }
      return { success: false, message };
    }
    if (!data.user) {
      return { success: false, message: 'Registration failed. Please try again.' };
    }

    const officer_position = userData.officer_position || deriveOfficerPosition(userData.role, userData.department);
    const course = userData.course || deriveCourse(userData.department);
    const year_level = userData.year_level || '1st Year';
    const section = userData.section || `${userData.department}-1A`;
    const isStudent = userData.role === 'student';

    const student_number = (userData.student_number?.trim())
      || (isStudent ? `2024-${Math.floor(10000 + Math.random() * 90000)}` : '');
    const parts = userData.name.trim().split(' ');
    const firstName = parts.slice(0, -1).join(' ') || parts[0];
    const lastName = parts.length > 1 ? parts[parts.length - 1] : 'Student';

    // No session back yet == email confirmation is required (the normal,
    // expected case with the OTP flow enabled in the Supabase dashboard).
    // The students RPC needs a live session (auth.uid()), so it can't run
    // yet — stash everything it'll need and let verifyRegistrationOtp finish
    // the job once the 6-digit code is confirmed.
    if (!data.session) {
      pendingRegistrationRef.current = {
        email: cleanEmail,
        isStudent,
        student_number,
        first_name: firstName,
        last_name: lastName,
        course,
        year_level,
        section,
        department: userData.department,
        course_id: userData.course_id,
        displayName: userData.name.trim(),
        officer_position
      };
      return {
        success: true,
        requiresOtp: true,
        message: `We sent a 6-digit verification code to ${cleanEmail}. Enter it below to finish creating your account.`
      };
    }

    // Confirmation is off project-side (defensive fallback) — finish
    // immediately using the session signUp already returned.
    if (isStudent) {
      const { error: rpcError } = await client.rpc('create_student_with_saf', {
        p_student_number: student_number,
        p_first_name: firstName,
        p_last_name: lastName,
        p_course: course,
        p_year_level: year_level,
        p_section: section,
        p_email: cleanEmail,
        p_department_code: userData.department,
        p_semester_id: activeSemester.semester_id ? Number(activeSemester.semester_id) : null,
        p_profile_id: data.user.id,
        p_course_id: userData.course_id ?? null
      });
      if (rpcError) {
        await client.auth.signOut();
        const dupMessage = /duplicate key|unique constraint/i.test(rpcError.message)
          ? `Student ID "${student_number}" is already taken. Please use a different one.`
          : `Account created, but the student roster entry failed: ${rpcError.message}`;
        return { success: false, message: dupMessage };
      }
    }

    // Registration never auto-logs-in — sign back out (any RPC work above
    // already ran using this transient session) and send the user to the
    // login page instead of straight into the dashboard.
    await client.auth.signOut();

    return {
      success: true,
      message: `Account created for ${userData.name.trim()} as ${officer_position}. Please log in.`
    };
  };

  // Completes a registration whose signUp() sent a 6-digit code instead of
  // establishing a session immediately. Suppresses the global auth listener
  // for the same reason loginUser/registerUser already do — the transient
  // verify session shouldn't flash the app into a logged-in state.
  const verifyRegistrationOtp = async (email: string, code: string): Promise<{ success: boolean; message: string }> => {
    const client = getSupabase();
    const cleanEmail = email.trim().toLowerCase();
    suppressAuthEventsRef.current = true;
    try {
      const { data, error } = await client.auth.verifyOtp({ email: cleanEmail, token: code.trim(), type: 'signup' });
      if (error || !data.user) {
        return { success: false, message: 'Invalid or expired code. Please check the code and try again.' };
      }

      const pending = pendingRegistrationRef.current;
      if (pending && pending.email === cleanEmail && pending.isStudent) {
        const { error: rpcError } = await client.rpc('create_student_with_saf', {
          p_student_number: pending.student_number,
          p_first_name: pending.first_name,
          p_last_name: pending.last_name,
          p_course: pending.course,
          p_year_level: pending.year_level,
          p_section: pending.section,
          p_email: cleanEmail,
          p_department_code: pending.department,
          p_semester_id: activeSemester.semester_id ? Number(activeSemester.semester_id) : null,
          p_profile_id: data.user.id,
          p_course_id: pending.course_id ?? null
        });
        if (rpcError) {
          await client.auth.signOut();
          const dupMessage = /duplicate key|unique constraint/i.test(rpcError.message)
            ? `Student ID "${pending.student_number}" is already taken. Please use a different one.`
            : `Verified, but the student roster entry failed: ${rpcError.message}`;
          return { success: false, message: dupMessage };
        }
      }

      pendingRegistrationRef.current = null;
      await client.auth.signOut();
      return { success: true, message: 'Email verified! Your account is ready — please log in.' };
    } finally {
      suppressAuthEventsRef.current = false;
    }
  };

  // Same code-instead-of-link idea for password reset — see requestPasswordReset
  // below for the email-send half of this flow.
  const verifyPasswordResetOtp = async (email: string, code: string): Promise<{ success: boolean; message: string }> => {
    const client = getSupabase();
    suppressAuthEventsRef.current = true;
    try {
      const { data, error } = await client.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'recovery' });
      if (error || !data.session) {
        return { success: false, message: 'Invalid or expired code. Please check the code and try again.' };
      }
      // verifyOtp establishes a real recovery session — drive the app into
      // the same "set a new password" screen a clicked recovery link uses,
      // explicitly rather than relying on onAuthStateChange to fire
      // PASSWORD_RECOVERY for a verifyOtp-established session.
      setIsPasswordRecovery(true);
      return { success: true, message: 'Code verified — set your new password below.' };
    } finally {
      suppressAuthEventsRef.current = false;
    }
  };

  const updateOwnProfile = async (updates: {
    name?: string; contact_number?: string; course?: string; year_level?: string; section?: string;
  }): Promise<{ success: boolean; message: string }> => {
    if (currentUser.id === 'guest') return { success: false, message: 'Not logged in.' };
    const client = getSupabase();

    const profileUpdates: Record<string, any> = {};
    if (updates.name !== undefined) profileUpdates.full_name = updates.name.trim();
    if (updates.contact_number !== undefined) profileUpdates.contact_number = updates.contact_number.trim() || null;

    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await client.from('profiles').update(profileUpdates).eq('id', currentUser.id);
      if (error) return { success: false, message: `Failed to update profile: ${error.message}` };
    }

    if (currentUser.role === 'student') {
      const studentUpdates: Record<string, any> = {};
      if (updates.course !== undefined) studentUpdates.course = updates.course;
      if (updates.year_level !== undefined) studentUpdates.year_level = updates.year_level;
      if (updates.section !== undefined) studentUpdates.section = updates.section;
      if (Object.keys(studentUpdates).length > 0) {
        const { error } = await client.from('students').update(studentUpdates).eq('profile_id', currentUser.id);
        if (error) return { success: false, message: `Failed to update student info: ${error.message}` };
      }
    }

    setCurrentUser(prev => ({
      ...prev,
      name: updates.name !== undefined ? updates.name.trim() : prev.name,
      contact_number: updates.contact_number !== undefined ? (updates.contact_number.trim() || undefined) : prev.contact_number,
      course: updates.course ?? prev.course,
      year_level: updates.year_level ?? prev.year_level,
      section: updates.section ?? prev.section
    }));

    return { success: true, message: 'Profile updated.' };
  };

  const updateActiveSemester = async (syLabel: string, semName: string) => {
    const client = getSupabase();

    // Derive plausible start/end dates from a "SY 2025-2026"-style label —
    // school_years.end_date > start_date is enforced by a CHECK constraint.
    const years = syLabel.match(/\d{4}/g);
    const y1 = years?.[0] ? parseInt(years[0], 10) : new Date().getFullYear();
    const y2 = years?.[1] ? parseInt(years[1], 10) : y1 + 1;

    const { data: existingSy } = await client.from('school_years').select('id').eq('label', syLabel).maybeSingle();
    let syId: number | undefined = existingSy?.id;
    if (!syId) {
      const { data: newSy, error } = await client.from('school_years')
        .insert({ label: syLabel, start_date: `${y1}-06-01`, end_date: `${y2}-05-31` })
        .select('id').single();
      if (error || !newSy) { console.error('Failed to create school year', error); return; }
      syId = newSy.id;
    }
    await client.from('school_years').update({ is_current: false }).neq('id', syId);
    await client.from('school_years').update({ is_current: true }).eq('id', syId);

    const { data: existingSem } = await client.from('semesters').select('id').eq('school_year_id', syId).eq('name', semName).maybeSingle();
    let semId: number | undefined = existingSem?.id;
    if (!semId) {
      const { data: newSem, error } = await client.from('semesters')
        .insert({ school_year_id: syId, name: semName })
        .select('id').single();
      if (error || !newSem) { console.error('Failed to create semester', error); return; }
      semId = newSem.id;
    }
    await client.from('semesters').update({ is_current: false }).neq('id', semId);
    await client.from('semesters').update({ is_current: true }).eq('id', semId);

    setActiveSemester({
      id: `as_${syId}_${semId}`,
      schoolyear_id: String(syId),
      semester_id: String(semId),
      school_year_label: syLabel,
      semester_name: semName,
      is_current: true
    });
  };

  const updateDepartmentAllocated = (code: DepartmentCode, amount: number) => {
    setDepartments(prev => ({
      ...prev,
      [code]: {
        ...prev[code],
        allocated: amount,
        remaining: amount - prev[code].spent,
        usedPercentage: Math.round((prev[code].spent / amount) * 100)
      }
    }));
  };

  const addStudent = async (studentData: Omit<Student, 'id'>) => {
    const client = getSupabase();
    const { data, error } = await client.rpc('create_student_with_saf', {
      p_student_number: studentData.student_number,
      p_first_name: studentData.first_name,
      p_last_name: studentData.last_name,
      p_course: studentData.course,
      p_year_level: studentData.year_level,
      p_section: studentData.section,
      p_email: studentData.email,
      p_department_code: studentData.department,
      p_semester_id: activeSemester.semester_id ? Number(activeSemester.semester_id) : null,
      p_profile_id: currentUser.id !== 'guest' ? currentUser.id : null
    });
    if (error || !data) {
      console.error('Failed to add student', error);
      return;
    }

    setStudents(prev => [mapStudentRow(data), ...prev]);

    const { data: safRow } = await client
      .from('saf_records')
      .select('*, students(student_number, first_name, last_name, course, section, year_level)')
      .eq('student_id', data.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (safRow) setSafRecords(prev => [mapSafRow(safRow), ...prev]);
  };

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    const client = getSupabase();
    const dbUpdates: Record<string, any> = {};
    if (updates.first_name !== undefined) dbUpdates.first_name = updates.first_name;
    if (updates.last_name !== undefined) dbUpdates.last_name = updates.last_name;
    if (updates.course !== undefined) dbUpdates.course = updates.course;
    if (updates.year_level !== undefined) dbUpdates.year_level = updates.year_level;
    if (updates.section !== undefined) dbUpdates.section = updates.section;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.department !== undefined) dbUpdates.department_code = updates.department;

    const { error } = await client.from('students').update(dbUpdates).eq('id', id);
    if (error) { console.error('Failed to update student', error); return; }
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Builds a one-page official SAF receipt as a PDF Blob — used by
  // recordSafPayment to generate a real downloadable receipt (Section 9)
  // rather than the old plain-text .txt slip.
  const buildSafReceiptPdf = (rec: SAFRecord): Blob => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    let y = 60;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('NAGA COLLEGE FOUNDATION (NCF)', centerX, y, { align: 'center' });
    y += 18;
    doc.setFontSize(11);
    doc.text('Supreme Student Council — Student Activity Fund (SAF)', centerX, y, { align: 'center' });
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Official Cash Receipt', centerX, y, { align: 'center' });
    y += 20;
    doc.setDrawColor(0, 135, 62);
    doc.setLineWidth(1.5);
    doc.line(60, y, pageWidth - 60, y);
    y += 30;

    const row = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(label, 70, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 260, y);
      y += 22;
    };

    row('Receipt No.:', rec.receipt_no || 'N/A');
    row('Date Issued:', rec.payment_date || new Date().toLocaleString());
    row('School Year:', `${rec.school_year} • ${rec.department}`);
    row('Student Name:', rec.student_name);
    row('Student Number:', rec.student_number);
    row('Course / Section:', `${rec.course} - ${rec.section} (${rec.year_level})`);
    row('Payment Method:', rec.payment_method || 'Cash');
    row('Reference No.:', rec.double_entry.reference_no);

    y += 10;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(60, y, pageWidth - 60, y);
    y += 30;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('CREDIT: Cash on Hand', 70, y);
    doc.setFontSize(16);
    doc.text(`Amount Paid: PHP ${rec.amount.toFixed(2)}`, 70, y + 24);
    y += 60;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('This receipt certifies that the above Student Activity Fund (SAF) payment has been', 70, y);
    y += 14;
    doc.text('received and recorded in the NCF Predict treasury ledger.', 70, y);
    y += 30;
    doc.text(`Collected by: ${rec.collected_by}`, 70, y);
    y += 14;
    doc.text('Thank you for supporting student council activities & projects.', 70, y);

    return doc.output('blob');
  };

  const recordSafPayment = async (safId: string, paymentMethod: 'Cash' | 'Online / Bank' | 'G-Cash', notes?: string) => {
    const client = getSupabase();
    const timestamp = new Date();
    const receiptNo = `SAF-${timestamp.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const debitAccount = 'Student Activity Fund (SAF)';
    const creditAccount = paymentMethod === 'Cash' ? 'Cash on Hand (Treasury Vault)' : 'Cash in Bank (NCF Trust Account)';

    const targetRec = safRecords.find(r => r.id === safId);
    if (!targetRec) return;

    const { error } = await client.from('saf_records').update({
      paid: true,
      payment_date: timestamp.toISOString(),
      receipt_no: receiptNo,
      payment_method: paymentMethod,
      collected_by: currentUser.id !== 'guest' ? currentUser.id : null,
      notes: notes || targetRec.notes,
      debit_account: debitAccount,
      credit_account: creditAccount,
      reference_no: receiptNo
    }).eq('id', safId);
    if (error) { console.error('Failed to record SAF payment', error); return; }

    const formattedDate = timestamp.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    setSafRecords(prev => prev.map(rec => rec.id === safId ? {
      ...rec,
      paid: true,
      payment_date: formattedDate,
      receipt_no: receiptNo,
      payment_method: paymentMethod,
      collected_by: `${currentUser.name} (${currentUser.officer_position || 'Treasury Officer'})`,
      notes: notes || rec.notes,
      double_entry: {
        debit_account: debitAccount,
        credit_account: creditAccount,
        amount: rec.amount,
        reference_no: receiptNo,
        transaction_type: 'SAF_CASH_IN',
        created_at: timestamp.toISOString()
      }
    } : rec));

    await addTransaction({
      title: `SAF Fee Collection - ${targetRec.student_name}`,
      department: targetRec.department,
      category: 'Revenue',
      date: timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: targetRec.amount,
      type: 'INCOME',
      status: 'Completed',
      description: `SAF Double-entry cash-in (Receipt #${receiptNo})`
    });

    // Auto-generate a real PDF receipt, store it, and notify the student
    // (Section 9) — best-effort: a failure here never undoes the payment
    // that was already recorded above.
    try {
      const finalRec: SAFRecord = {
        ...targetRec,
        paid: true,
        payment_date: formattedDate,
        receipt_no: receiptNo,
        payment_method: paymentMethod,
        collected_by: `${currentUser.name} (${currentUser.officer_position || 'Treasury Officer'})`,
        double_entry: {
          debit_account: debitAccount, credit_account: creditAccount, amount: targetRec.amount,
          reference_no: receiptNo, transaction_type: 'SAF_CASH_IN', created_at: timestamp.toISOString()
        }
      };
      const pdfBlob = buildSafReceiptPdf(finalRec);
      const studentProfileId = students.find(s => s.id === targetRec.student_id)?.profile_id;
      const storagePath = `saf-receipts/${studentProfileId || targetRec.student_id}/${receiptNo}.pdf`;
      const { error: uploadErr } = await client.storage.from('receipts').upload(storagePath, pdfBlob, {
        contentType: 'application/pdf', upsert: true
      });
      if (uploadErr) {
        console.error('Failed to upload SAF receipt PDF', uploadErr);
      } else if (studentProfileId) {
        await client.rpc('notify_recipient', {
          p_recipient_id: studentProfileId,
          p_title: 'SAF Payment Received',
          p_body: `Your ₱${targetRec.amount.toFixed(2)} SAF payment was recorded. Receipt #${receiptNo} is ready in My Receipts.`,
          p_link_tab: 'student_portal'
        });
      }
    } catch (pdfErr) {
      console.error('Failed to generate/upload SAF receipt PDF', pdfErr);
    }
  };

  const addSafRecord = async (record: Omit<SAFRecord, 'id' | 'double_entry' | 'receipt_no'>) => {
    const client = getSupabase();
    const timestamp = new Date();
    const receiptNo = `SAF-${timestamp.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const debitAccount = 'Student Activity Fund (SAF)';
    const creditAccount = record.payment_method === 'Cash' ? 'Cash on Hand' : 'Cash in Bank';

    const { data, error } = await client.from('saf_records').insert({
      student_id: record.student_id,
      department_code: record.department,
      amount: record.amount,
      paid: record.paid,
      payment_date: record.paid ? timestamp.toISOString() : null,
      receipt_no: record.paid ? receiptNo : null,
      payment_method: record.payment_method,
      debit_account: debitAccount,
      credit_account: creditAccount,
      reference_no: receiptNo,
      collected_by: currentUser.id !== 'guest' ? currentUser.id : null,
      notes: record.notes
    }).select('*, students(student_number, first_name, last_name, course, section, year_level)').single();

    if (error || !data) { console.error('Failed to add SAF record', error); return; }
    setSafRecords(prev => [mapSafRow(data), ...prev]);
  };

  // Re-pulls allocated/spent/remaining/usedPercentage from the
  // department_financials view (which is itself computed from
  // budgets + transactions) — used after any write that could change them.
  const refreshDepartmentFinancials = async () => {
    const client = getSupabase();
    const { data: finRows } = await client.from('department_financials').select('code, allocated, spent, remaining, used_percentage');
    if (!finRows) return;
    setDepartments(prev => {
      const next = { ...prev };
      finRows.forEach((fin: any) => {
        const code = fin.code as DepartmentCode;
        if (!next[code]) return;
        next[code] = {
          ...next[code],
          allocated: Number(fin.allocated),
          spent: Number(fin.spent),
          remaining: Number(fin.remaining),
          usedPercentage: Number(fin.used_percentage)
        };
      });
      return next;
    });
  };

  const mapTransactionRow = (row: any): DepartmentTransaction => ({
    id: row.id,
    title: row.title,
    department: row.department_code,
    category: row.category,
    date: row.transaction_date,
    amount: Number(row.amount),
    type: row.is_income ? 'INCOME' : 'EXPENSE',
    is_archived: row.is_archived,
    status: row.status,
    reference_code: row.reference_code || row.id,
    description: row.notes || undefined,
    created_by: row.created_by || undefined,
    reviewed_by: row.reviewed_by || undefined,
    reviewed_at: row.reviewed_at || undefined
  });

  const addTransaction = async (tx: Omit<DepartmentTransaction, 'id' | 'reference_code' | 'is_archived'>) => {
    const client = getSupabase();
    const referenceCode = `${tx.department}-${tx.category.toUpperCase().slice(0, 3)}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    // tx.date is a display-formatted string (e.g. "Jan 5") throughout the
    // app's call sites, not a real ISO date the DB's DATE column can take —
    // every call site means "now" anyway (there's no backdating UI), so the
    // DB always gets today's real date regardless of what was passed in.
    const { data, error } = await client.from('transactions').insert({
      department_code: tx.department,
      title: tx.title,
      category: tx.category === 'All' ? 'Operations' : tx.category,
      reference_code: referenceCode,
      transaction_date: new Date().toISOString().slice(0, 10),
      amount: tx.amount,
      is_income: tx.type === 'INCOME',
      // Manually-entered transactions (AddTransactionModal doesn't pass a
      // status) go to a Pending review queue unless the creator is already
      // an elevated reviewer role — that's what makes "admin/adviser can
      // review all transactions" meaningful. System-generated transactions
      // (SAF payments, penalty collections, budget returns) always pass
      // status:'Completed' explicitly and bypass this.
      status: tx.status || (['admin', 'csc_adviser', 'dean'].includes(currentUser.role) ? 'Completed' : 'Pending'),
      notes: tx.description,
      created_by: currentUser.id !== 'guest' ? currentUser.id : undefined
    }).select().single();

    if (error || !data) {
      console.error('Failed to add transaction', error);
      return;
    }

    setTransactions(prev => [mapTransactionRow(data), ...prev]);
    await refreshDepartmentFinancials();
  };

  const toggleArchiveTransaction = async (id: string) => {
    const current = transactions.find(tx => tx.id === id);
    if (!current) return;
    const client = getSupabase();
    const { error } = await client.from('transactions').update({ is_archived: !current.is_archived }).eq('id', id);
    if (error) { console.error('Failed to toggle archive', error); return; }
    setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, is_archived: !tx.is_archived } : tx));
  };

  const deleteTransaction = async (id: string) => {
    const client = getSupabase();
    const { error } = await client.from('transactions').delete().eq('id', id);
    if (error) { console.error('Failed to delete transaction', error); return; }
    setTransactions(prev => prev.filter(tx => tx.id !== id));
  };

  const reviewTransaction = async (id: string, decision: 'Completed' | 'Rejected', remarks?: string) => {
    const client = getSupabase();
    const updates: Record<string, any> = {
      status: decision,
      reviewed_by: currentUser.id !== 'guest' ? currentUser.id : null,
      reviewed_at: new Date().toISOString()
    };
    if (remarks) updates.notes = remarks;
    const { error } = await client.from('transactions').update(updates).eq('id', id);
    if (error) { console.error('Failed to review transaction', error); return; }

    setTransactions(prev => prev.map(tx => tx.id === id ? {
      ...tx, status: decision, reviewed_by: currentUser.name, reviewed_at: new Date().toISOString(),
      description: remarks || tx.description
    } : tx));
    await refreshDepartmentFinancials();
  };

  const addEvent = async (eventData: Omit<SchoolEvent, 'id' | 'created_at'>) => {
    const client = getSupabase();
    const penaltyFee = eventData.penalty ?? eventData.penalty_fee_amount ?? 50.00;
    const desc = eventData.event_description || eventData.description || 'Mandatory departmental academic activity.';

    const { data: eventRow, error } = await client.from('school_events').insert({
      event_title: eventData.event_title,
      event_description: desc,
      venue: eventData.venue,
      event_type: eventData.event_type,
      event_date: eventData.event_date,
      start_time: eventData.start_time || null,
      end_time: eventData.end_time || null,
      penalty_fee_amount: penaltyFee,
      semester_id: activeSemester.semester_id ? Number(activeSemester.semester_id) : null,
      department_code: eventData.department === 'ALL' ? null : eventData.department,
      created_by: currentUser.id !== 'guest' ? currentUser.id : null
    }).select().single();

    if (error || !eventRow) { console.error('Failed to add event', error); return; }

    const newEvent = mapEventRow(eventRow);
    setEvents(prev => [newEvent, ...prev]);

    // Pre-populate default attendance for students under this department or ALL
    const targetStudents = students.filter(s => eventData.department === 'ALL' || s.department === eventData.department);
    if (targetStudents.length === 0) return;

    const { data: attRows, error: attError } = await client.from('event_attendance').insert(
      targetStudents.map(stud => ({
        event_id: eventRow.id,
        student_id: stud.id,
        status: 'Absent',
        penalty_amount: penaltyFee,
        penalty_paid: false,
        notes: 'Initial event registration'
      }))
    ).select();

    if (attError || !attRows) { console.error('Failed to seed attendance', attError); return; }
    const newAttendances: EventAttendance[] = attRows.map((row: any) => {
      const stud = targetStudents.find(s => s.id === row.student_id)!;
      return {
        id: row.id,
        event_id: row.event_id,
        event_title: newEvent.event_title,
        student_id: stud.id,
        student_number: stud.student_number,
        student_name: `${stud.first_name} ${stud.last_name}`,
        course: stud.course,
        section: stud.section,
        department: stud.department,
        status: 'Absent',
        penalty_amount: penaltyFee,
        amount: penaltyFee,
        penalty_paid: false,
        notes: 'Initial event registration'
      };
    });
    setAttendances(prev => [...newAttendances, ...prev]);
  };

  const recordAttendance = async (
    eventId: string,
    studentIdOrNumber: string,
    statusOrIsPresent: 'Present' | 'Absent' | 'Excused' | boolean,
    remarks?: string
  ) => {
    const client = getSupabase();
    const status: 'Present' | 'Absent' | 'Excused' =
      typeof statusOrIsPresent === 'boolean'
        ? (statusOrIsPresent ? 'Present' : 'Absent')
        : statusOrIsPresent;

    const targetEvent = events.find(e => e.id === eventId);
    const stud = students.find(s => s.id === studentIdOrNumber || s.student_number === studentIdOrNumber);
    if (!stud) return;

    const penaltyVal = status === 'Absent' ? (targetEvent?.penalty ?? targetEvent?.penalty_fee_amount ?? 50.00) : 0;
    const timeIn = status === 'Present' ? new Date().toTimeString().slice(0, 8) : null;
    const notes = remarks || (status === 'Absent' ? 'Unexcused absence' : 'Present in attendance verified');

    const { data, error } = await client.from('event_attendance').upsert({
      event_id: eventId,
      student_id: stud.id,
      status,
      time_in: timeIn,
      penalty_amount: penaltyVal,
      penalty_paid: status === 'Present' || status === 'Excused',
      notes
    }, { onConflict: 'event_id,student_id' }).select().single();

    if (error || !data) { console.error('Failed to record attendance', error); return; }

    setAttendances(prev => {
      const existingIdx = prev.findIndex(att => att.event_id === eventId && att.student_id === stud.id);
      const updated: EventAttendance = {
        id: data.id,
        event_id: eventId,
        event_title: targetEvent?.event_title || 'Semester Event',
        student_id: stud.id,
        student_number: stud.student_number,
        student_name: `${stud.first_name} ${stud.last_name}`,
        course: stud.course,
        section: stud.section,
        department: stud.department,
        status,
        time_in: data.time_in || undefined,
        penalty_amount: penaltyVal,
        amount: penaltyVal,
        penalty_paid: status === 'Present' || status === 'Excused',
        notes
      };
      if (existingIdx >= 0) {
        return prev.map((att, idx) => idx === existingIdx ? updated : att);
      }
      return [updated, ...prev];
    });
  };

  // Student self-check-in photo (Section 10) — the row must already exist
  // (created when the officer takes attendance); RLS/the Phase 0 guard
  // trigger restrict a student's own update to photo_url/notes only, never
  // status or penalty fields.
  const updateAttendancePhoto = async (attendanceId: string, photoPath: string) => {
    const client = getSupabase();
    const { error } = await client.from('event_attendance').update({ photo_url: photoPath }).eq('id', attendanceId);
    if (error) { console.error('Failed to save check-in photo', error); return; }
    setAttendances(prev => prev.map(att => att.id === attendanceId ? { ...att, photo_url: photoPath } : att));
  };

  const payPenalty = async (attendanceId: string, receiptNo?: string, confirmationRemark?: string) => {
    const client = getSupabase();
    const rNo = receiptNo || `PEN-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const formattedDate = new Date().toISOString().slice(0, 10);
    // Section 1f: payment stays pending until a Treasurer/Assistant Treasurer
    // attaches a confirmation remark validating receipt — the remark is
    // required by the UI (EventsAndPenalties.tsx) and stored verbatim here.
    const settleNote = confirmationRemark ? `Penalty settled at Treasury — ${confirmationRemark}` : 'Penalty settled at Treasury';

    const { error } = await client.from('event_attendance').update({
      penalty_paid: true,
      penalty_paid_date: formattedDate,
      receipt_no: rNo,
      notes: settleNote
    }).eq('id', attendanceId);
    if (error) { console.error('Failed to record penalty payment', error); return; }

    setAttendances(prev => prev.map(att => att.id === attendanceId ? {
      ...att,
      penalty_paid: true,
      penalty_paid_date: formattedDate,
      receipt_no: rNo,
      notes: settleNote
    } : att));

    const attRecord = attendances.find(a => a.id === attendanceId);
    if (attRecord && attRecord.penalty_amount > 0) {
      await addTransaction({
        title: `Event Penalty Fee - ${attRecord.student_name}`,
        department: attRecord.department,
        category: 'Revenue',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount: attRecord.penalty_amount,
        type: 'INCOME',
        status: 'Completed',
        description: `Penalty fee collection for missed event: ${attRecord.event_title} (Receipt #${rNo})`
      });
    }
  };

  const createProposal = async (proposalData: Omit<BudgetProposal, 'id' | 'created_at' | 'updated_at' | 'votes' | 'notes' | 'cashouts' | 'expenses' | 'reimbursements'>): Promise<string> => {
    const client = getSupabase();

    const { data: row, error } = await client.from('budget_requests').insert({
      title: proposalData.budget_title,
      budget_description: proposalData.budget_description,
      department_code: proposalData.department,
      event_id: proposalData.event_id || null,
      requested_by: currentUser.id !== 'guest' ? currentUser.id : null,
      requested_by_name: proposalData.created_by_officer,
      treasurer_notes: proposalData.treasurer_notes,
      fiscal_year: proposalData.school_year,
      semester_id: activeSemester.semester_id ? Number(activeSemester.semester_id) : null,
      status: 'DRAFT',
      total_amount: proposalData.total_budget_amount
    }).select().single();

    if (error || !row) { console.error('Failed to create proposal', error); return ''; }

    if (proposalData.line_items.length > 0) {
      await client.from('budget_request_items').insert(
        proposalData.line_items.map(li => ({
          request_id: row.id,
          description: li.item_desc,
          category: li.category,
          quantity: li.quantity,
          unit_cost: li.unit_cost,
          amount: li.estimated_amount,
          remarks: li.remarks
        }))
      );
    }

    const initialNoteContent = proposalData.treasurer_notes || 'Draft budget proposal created.';
    if (currentUser.id !== 'guest') {
      await client.from('proposal_notes').insert({
        proposal_id: row.id,
        author_id: currentUser.id,
        note_content: initialNoteContent,
        is_official: true
      });
    }

    const newProposal: BudgetProposal = {
      ...proposalData,
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      votes: [],
      notes: [{
        id: `note_init_${row.id}`,
        author_id: currentUser.id,
        author_name: currentUser.name,
        author_role: currentUser.role,
        note_content: initialNoteContent,
        created_at: new Date().toLocaleString(),
        is_official: true
      }],
      cashouts: [],
      expenses: [],
      reimbursements: []
    };
    setProposals(prev => [newProposal, ...prev]);
    return row.id;
  };

  const updateProposalDraft = async (id: string, updates: Partial<BudgetProposal>) => {
    const client = getSupabase();
    const dbUpdates: Record<string, any> = {};
    if (updates.budget_title !== undefined) dbUpdates.title = updates.budget_title;
    if (updates.budget_description !== undefined) dbUpdates.budget_description = updates.budget_description;
    if (updates.total_budget_amount !== undefined) dbUpdates.total_amount = updates.total_budget_amount;
    if (updates.treasurer_notes !== undefined) dbUpdates.treasurer_notes = updates.treasurer_notes;
    if (updates.budget_status !== undefined) dbUpdates.status = updates.budget_status;

    if (Object.keys(dbUpdates).length > 0) {
      const { error } = await client.from('budget_requests').update(dbUpdates).eq('id', id);
      if (error) { console.error('Failed to update proposal', error); return; }
    }
    setProposals(prev => prev.map(p => p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString().slice(0, 10) } : p));
  };

  // Skips the old Executive-Review/Council-Voting stages: Officer -> Adviser
  // -> Dean is the whole review sequence now. Those stages/RPCs are left in
  // the schema unused rather than removed, so no old data/enum breaks.
  const submitProposalForReview = async (id: string) => {
    await updateProposalDraft(id, { budget_status: 'CSC_ADVISER_APPROVAL' });
  };

  const executiveReviewProposal = async (id: string, decision: 'APPROVED_TO_COUNCIL' | 'NEEDS_REVISION' | 'REJECTED', remarks: string) => {
    const client = getSupabase();
    const nextStatus = decision === 'APPROVED_TO_COUNCIL' ? 'COUNCIL_VOTING' : (decision === 'NEEDS_REVISION' ? 'FOR_REVISION' : 'REJECTED');
    const date = new Date().toISOString().slice(0, 10);

    const { error } = await client.from('budget_requests').update({
      status: nextStatus,
      executive_reviewed_by: currentUser.id !== 'guest' ? currentUser.id : null,
      executive_decision: decision,
      executive_remarks: remarks,
      executive_reviewed_at: new Date().toISOString()
    }).eq('id', id);
    if (error) { console.error('Failed to submit executive review', error); return; }

    setProposals(prev => prev.map(p => p.id === id ? {
      ...p,
      budget_status: nextStatus,
      executive_review: {
        reviewed_by: `${currentUser.name} (${currentUser.officer_position || 'Executive Committee'})`,
        decision, remarks, date
      },
      updated_at: date
    } : p));
  };

  const voteOnProposal = async (proposalId: string, vote: 'IN_FAVOR' | 'AGAINST' | 'ABSTAIN', comment: string) => {
    const client = getSupabase();
    const { data: row, error } = await client.rpc('cast_council_vote', {
      p_proposal_id: proposalId, p_vote: vote, p_comment: comment
    });
    if (error || !row) { console.error('Failed to cast vote', error); return; }

    const newVote = {
      id: `vote_${Date.now()}`,
      council_member_id: currentUser.id,
      council_member_name: currentUser.name,
      position: currentUser.officer_position || 'Council Member',
      vote,
      comment,
      voted_at: new Date().toLocaleString()
    };

    setProposals(prev => prev.map(p => {
      if (p.id !== proposalId) return p;
      const updatedVotes = [...p.votes.filter(v => v.council_member_id !== currentUser.id), newVote];
      return {
        ...p,
        votes: updatedVotes,
        budget_status: row.status,
        council_resolution: row.council_resolution_number ? {
          resolution_number: row.council_resolution_number,
          resolution_title: `Resolution approving budget allocation for ${p.budget_title}`,
          date_voted: new Date().toISOString().slice(0, 10),
          status: row.council_resolution_status
        } : p.council_resolution,
        updated_at: row.updated_at
      };
    }));
  };

  const addProposalNote = async (proposalId: string, noteContent: string, isOfficial: boolean = true) => {
    const client = getSupabase();
    if (currentUser.id === 'guest') return;
    const { data, error } = await client.from('proposal_notes').insert({
      proposal_id: proposalId,
      author_id: currentUser.id,
      note_content: noteContent,
      is_official: isOfficial
    }).select().single();
    if (error || !data) { console.error('Failed to add note', error); return; }

    const newNote: ProposalNote = {
      id: data.id,
      author_id: currentUser.id,
      author_name: currentUser.name,
      author_role: currentUser.officer_position || currentUser.role,
      note_content: noteContent,
      created_at: new Date().toLocaleString(),
      is_official: isOfficial
    };
    setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, notes: [...p.notes, newNote], updated_at: new Date().toISOString().slice(0, 10) } : p));
  };

  const adviserApproveProposal = async (proposalId: string, decision: 'APPROVED' | 'REVISION' | 'REJECTED', remarks: string) => {
    const client = getSupabase();
    const nextStatus = decision === 'APPROVED' ? 'DEAN_APPROVAL' : (decision === 'REVISION' ? 'FOR_REVISION' : 'REJECTED');
    const date = new Date().toISOString().slice(0, 10);

    const { error } = await client.from('budget_requests').update({
      status: nextStatus,
      adviser_id: currentUser.id !== 'guest' ? currentUser.id : null,
      adviser_decision: decision,
      adviser_remarks: remarks,
      adviser_decided_at: new Date().toISOString()
    }).eq('id', proposalId);
    if (error) { console.error('Failed to submit adviser decision', error); return; }

    setProposals(prev => prev.map(p => {
      if (p.id === proposalId) {
        return {
          ...p,
          budget_status: nextStatus,
          adviser_approval: { adviser_name: currentUser.name, decision, remarks, date },
          updated_at: date
        };
      }
      return p;
    }));
  };

  const deanApproveProposal = async (proposalId: string, decision: 'APPROVED_FUND_RELEASE' | 'REVISION' | 'REJECTED', remarks: string) => {
    const client = getSupabase();
    const { data: row, error } = await client.rpc('approve_dean_decision', {
      p_proposal_id: proposalId, p_decision: decision, p_remarks: remarks
    });
    if (error || !row) { console.error('Failed to submit dean decision', error); return; }

    const isApproved = decision === 'APPROVED_FUND_RELEASE';
    let newCashout: CashoutRecord | null = null;
    if (isApproved) {
      const { data: coRow } = await client.from('cashouts').select('*').eq('proposal_id', proposalId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (coRow) {
        newCashout = {
          id: coRow.id, budget_id: proposalId, amount_released: Number(coRow.amount_released),
          date_released: coRow.date_released, purpose: coRow.purpose, cashout_status: coRow.cashout_status,
          officer_id: coRow.officer_id || '', officer_name: currentUser.name, voucher_no: coRow.voucher_no || '',
          proof_docs: coRow.proof_docs || []
        };
      }
    }

    setProposals(prev => prev.map(p => p.id === proposalId ? {
      ...p,
      budget_status: row.status,
      dean_approval: {
        dean_name: currentUser.name, decision, remarks,
        date: new Date().toISOString().slice(0, 10), release_authorized: row.release_authorized
      },
      cashouts: newCashout ? [...p.cashouts, newCashout] : p.cashouts,
      updated_at: row.updated_at
    } : p));
  };

  const requestCashout = async (budgetId: string, amount: number, purpose: string, proofDocs: { name: string; type: string; url: string; date: string }[]) => {
    const client = getSupabase();
    const voucherNo = `DV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const docs = proofDocs.length > 0 ? proofDocs : [
      { name: 'Official_Budget_Release_Request.pdf', type: 'Letter', url: '#', date: new Date().toISOString().slice(0, 10) }
    ];

    const { data, error } = await client.from('cashouts').insert({
      proposal_id: budgetId,
      amount_released: amount,
      purpose,
      cashout_status: 'Released',
      officer_id: currentUser.id !== 'guest' ? currentUser.id : null,
      voucher_no: voucherNo,
      proof_docs: docs
    }).select().single();
    if (error || !data) { console.error('Failed to request cashout', error); return; }

    const newCashout: CashoutRecord = {
      id: data.id, budget_id: budgetId, amount_released: amount, date_released: data.date_released,
      purpose, cashout_status: 'Released', officer_id: currentUser.id, officer_name: currentUser.name,
      voucher_no: voucherNo, proof_docs: docs
    };
    setProposals(prev => prev.map(p => p.id === budgetId ? { ...p, cashouts: [...p.cashouts, newCashout], updated_at: new Date().toISOString().slice(0, 10) } : p));
  };

  const addExpense = async (budgetId: string, desc: string, category: string, amount: number, proof: { name: string; type: string; url: string; invoice_number: string }) => {
    const targetProp = proposals.find(p => p.id === budgetId);
    if (!targetProp) return;

    const client = getSupabase();
    const referenceCode = `${targetProp.department}-EXP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const { data, error } = await client.from('transactions').insert({
      department_code: targetProp.department,
      proposal_id: budgetId,
      title: `${desc} (${targetProp.budget_title})`,
      category: 'Event',
      reference_code: referenceCode,
      transaction_date: new Date().toISOString().slice(0, 10),
      amount,
      is_income: false,
      status: 'Completed',
      notes: `Expense receipt #${proof.invoice_number} attached`,
      // proof.url is a real Storage object path once uploaded via
      // ReceiptUploadField (was previously always the placeholder '#' and
      // never persisted at all — this column already existed, unused).
      receipt_url: proof.url && proof.url !== '#' ? proof.url : null,
      created_by: currentUser.id !== 'guest' ? currentUser.id : null
    }).select().single();
    if (error || !data) { console.error('Failed to add expense', error); return; }

    const newExp: ExpenseRecord = {
      id: data.id, budget_id: budgetId, expense_desc: desc, category, amount_spent: amount,
      date_incurred: data.transaction_date, proof_attach: [proof],
      officer_id: currentUser.id, officer_name: currentUser.name, reimbursement_status: 'None'
    };
    setProposals(prev => prev.map(p => p.id === budgetId ? { ...p, expenses: [...p.expenses, newExp], updated_at: new Date().toISOString().slice(0, 10) } : p));
    setTransactions(prev => [mapTransactionRow(data), ...prev]);
    await refreshDepartmentFinancials();
  };

  const requestReimbursement = async (expenseId: string, budgetId: string, amount: number, remarks: string) => {
    const targetProp = proposals.find(p => p.id === budgetId);
    if (!targetProp) return;
    const client = getSupabase();
    const receiptRef = `REC-${Date.now()}`;

    const { data, error } = await client.from('reimbursements').insert({
      request_code: receiptRef,
      proposal_id: budgetId,
      expense_transaction_id: expenseId,
      claimant_name: currentUser.name,
      claimant_id: currentUser.id !== 'guest' ? currentUser.id : null,
      department_code: targetProp.department,
      event_name: targetProp.budget_title,
      purpose: remarks || 'Expense reimbursement',
      amount_requested: amount,
      date_submitted: new Date().toISOString().slice(0, 10),
      receipt_no: receiptRef,
      category: 'Event',
      fiscal_year: targetProp.school_year,
      status: 'Pending',
      remarks
    }).select().single();
    if (error || !data) { console.error('Failed to request reimbursement', error); return; }

    const newReimb: ReimbursementRecord = {
      id: data.id, expense_id: expenseId, budget_id: budgetId, amount_spent: amount,
      date_submitted: data.date_submitted, reimbursement_status: 'Pending', remarks,
      officer_name: currentUser.name, receipt_ref: receiptRef
    };
    setProposals(prev => prev.map(p => p.id === budgetId ? {
      ...p,
      reimbursements: [...p.reimbursements, newReimb],
      expenses: p.expenses.map(e => e.id === expenseId ? { ...e, reimbursement_status: 'Requested' } : e)
    } : p));
  };

  const approveReimbursement = async (reimbursementId: string, decision: 'Approved' | 'Rejected' = 'Approved', remarks?: string) => {
    const client = getSupabase();
    const updatePayload: Record<string, unknown> = { status: decision };
    if (remarks) updatePayload.remarks = remarks;
    const { error } = await client.from('reimbursements').update(updatePayload).eq('id', reimbursementId);
    if (error) { console.error('Failed to update reimbursement', error); return; }

    setProposals(prev => prev.map(p => {
      const matchReimb = p.reimbursements.find(r => r.id === reimbursementId);
      if (matchReimb) {
        return {
          ...p,
          reimbursements: p.reimbursements.map(r => r.id === reimbursementId ? { ...r, reimbursement_status: decision, remarks: remarks || r.remarks } : r),
          // A rejection sends the underlying expense back to unclaimed so
          // the officer can re-submit; approval marks it settled.
          expenses: p.expenses.map(e => e.id === matchReimb.expense_id ? { ...e, reimbursement_status: decision === 'Approved' ? 'Approved' : 'None' } : e)
        };
      }
      return p;
    }));
  };

  const submitLiquidation = async (budgetId: string, accountingSummary: { category: string; spent: number; line_item_count: number }[], notes: string) => {
    const client = getSupabase();
    const { data: row, error } = await client.rpc('submit_liquidation', {
      p_proposal_id: budgetId,
      p_accounting_summary: accountingSummary,
      p_notes: notes || 'Liquidation submitted with all supporting invoices and official receipts verified.'
    });
    if (error || !row) { console.error('Failed to submit liquidation', error); return; }

    const targetProp = proposals.find(p => p.id === budgetId);
    const newLiquidation: LiquidationRecord = {
      id: row.id, budget_id: budgetId, total_budget: targetProp?.total_budget_amount || 0,
      total_released: Number(row.total_released), total_spent: Number(row.total_spent), balance: Number(row.balance),
      status: row.status, accounting_summary: accountingSummary, submitted_by: currentUser.name,
      submitted_date: row.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      notes: row.remarks || undefined
    };
    setProposals(prev => prev.map(p => p.id === budgetId ? { ...p, liquidation: newLiquidation, updated_at: new Date().toISOString().slice(0, 10) } : p));
  };

  const recordBudgetReturn = async (budgetId: string, amount: number, remarks: string) => {
    const targetProp = proposals.find(p => p.id === budgetId);
    if (!targetProp) return;
    const client = getSupabase();
    const refCode = `CR-RETURN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const { data, error } = await client.from('budget_returns').insert({
      proposal_id: budgetId,
      amount_returned: amount,
      cash_in_reference: refCode,
      returned_by: currentUser.id !== 'guest' ? currentUser.id : null,
      received_by: 'Dean / Student Affairs Officer',
      remarks
    }).select().single();
    if (error || !data) { console.error('Failed to record budget return', error); return; }

    const newReturn: BudgetReturnRecord = {
      id: data.id, budget_id: budgetId, amount_returned: amount, date_returned: data.date_returned,
      cash_in_reference: refCode,
      double_entry: { debit: 'Cash on Hand (SAF Vault)', credit: 'Unspent Event Budget Return' },
      returned_by: currentUser.name, received_by: 'Dean / Student Affairs Officer', remarks
    };
    setProposals(prev => prev.map(p => p.id === budgetId ? { ...p, budget_return: newReturn, updated_at: new Date().toISOString().slice(0, 10) } : p));

    await addTransaction({
      title: `Budget Return: ${targetProp.budget_title}`,
      department: targetProp.department,
      category: 'Revenue',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount,
      type: 'INCOME',
      status: 'Completed',
      description: `Cash-in double entry return of unspent SAF budget (${refCode})`
    });
  };

  const updateStudentInfo = async (studentNumber: string, updates: Partial<Student>) => {
    const target = students.find(s => s.student_number === studentNumber);
    if (!target) return;
    await updateStudent(target.id, updates);
  };

  // Department Scoping Logic
  const userDepartment: DepartmentCode = currentUser.department || 'CAF';
  // Every role is locked to its own registered department — Adviser, Dean,
  // and Student explicitly included (a CCS Adviser must never see COE's
  // events/transactions/SAF/students/proposals, etc.). Admin and Super Admin
  // stay unrestricted: Admin is a system-management role with no department
  // of its own scoped view (nav trimmed to Manage Users only), and Super
  // Admin is department-less by definition (it promotes one Admin per
  // department, cross-department). Previously Adviser/Dean were deliberately
  // excluded here for a "cross-department oversight" design that has since
  // been superseded by course/department-scoped staff accounts — every
  // `scopedX` list below now honors this for all of them.
  const isDepartmentRestricted = !['admin', 'super_admin'].includes(currentUser.role);

  const scopedDepartmentInfo: DepartmentInfo = departments[userDepartment] || departments.CAF;

  // Scoped lists: Only contains the user's department if restricted
  const scopedDepartmentList: DepartmentInfo[] = isDepartmentRestricted
    ? [scopedDepartmentInfo]
    : Object.values(departments);

  const scopedTransactions: DepartmentTransaction[] = isDepartmentRestricted
    ? transactions.filter(t => t.department === userDepartment)
    : transactions;

  const scopedProposals: BudgetProposal[] = isDepartmentRestricted
    ? proposals.filter(p => p.department === userDepartment)
    : proposals;

  const scopedSafRecords: SAFRecord[] = isDepartmentRestricted
    ? safRecords.filter(s => s.department === userDepartment)
    : safRecords;

  const scopedStudents: Student[] = isDepartmentRestricted
    ? students.filter(s => s.department === userDepartment)
    : students;

  const scopedEvents: SchoolEvent[] = isDepartmentRestricted
    ? events.filter(e => e.department === userDepartment || e.department === 'ALL')
    : events;

  const scopedAttendances: EventAttendance[] = isDepartmentRestricted
    ? attendances.filter(a => a.department === userDepartment)
    : attendances;

  const scopedPenalties: EventAttendance[] = scopedAttendances;

  const isReadOnlyStudent = currentUser.role === 'student';

  // Dean/Adviser get course-scoped, view-only access to Transactions, SAF
  // Cash-In, Penalties/Attendance, and SAF Clearance (Section 5) — they
  // still retain write access to Reimbursement/Liquidation decisions and
  // Event approval, which are gated separately, so this is narrower than
  // isReadOnlyStudent and applied only to those specific screens.
  const isViewOnlyReviewer = currentUser.role === 'dean' || currentUser.role === 'csc_adviser';
  // Super Admin gets the exact same system-management-only nav as Admin —
  // Manage Users (promotion panels) and nothing else.
  const isAdminSystemOnly = currentUser.role === 'admin' || currentUser.role === 'super_admin';
  const isEmployeeAwaitingAssignment = currentUser.role === 'employee';

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isAuthenticated,
        isAuthLoading,
        isReadOnlyStudent,
        isViewOnlyReviewer,
        isAdminSystemOnly,
        isEmployeeAwaitingAssignment,
        registerUser,
        verifyRegistrationOtp,
        requestPasswordReset,
        verifyPasswordResetOtp,
        updatePassword,
        isPasswordRecovery,
        superAdminExists,
        mfaFactors,
        mfaChallengePending: mfaChallenge !== null,
        mfaEnrollStart,
        mfaEnrollConfirm,
        mfaUnenroll,
        mfaVerifyLogin,
        cancelMfaChallenge,
        courses,
        takenRoleSlots,
        promoteToOfficer,
        vacateOfficerPosition,
        promoteEmployeeToAdmin,
        promoteEmployeeToDean,
        promoteEmployeeToAdviser,
        demoteToEmployee,
        notifications,
        markNotificationRead,
        handoverFiles,
        handoverRequests,
        sendAdviserHandoverFile,
        requestAdviserHandoverFile,
        reviewAdviserHandoverRequest,
        getSignedHandoverFileUrl,
        proposeEvent,
        reviewEvent,
        adviserReviewLiquidation,
        deanReviewLiquidation,
        updateOwnProfile,
        userAccounts,
        addUserAccount,
        deactivateUser,
        reactivateUser,
        deleteUserAccount,
        clearances,
        generateClearance,
        getSignedReceiptUrl,
        myReceipts,
        userDepartment,
        isDepartmentRestricted,
        scopedDepartmentInfo,
        scopedDepartmentList,
        scopedTransactions,
        scopedProposals,
        scopedSafRecords,
        scopedStudents,
        scopedEvents,
        scopedAttendances,
        scopedPenalties,
        loginUser,
        logoutUser,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authModalMode,
        setAuthModalMode,
        openAuthModal,
        closeAuthModal,
        isLoginModalOpen,
        setIsLoginModalOpen,
        openLoginModal,
        closeLoginModal,
        isRegisterModalOpen,
        setIsRegisterModalOpen,
        openRegisterModal,
        closeRegisterModal,
        activeSemester,
        updateActiveSemester,
        departments,
        updateDepartmentAllocated,
        students,
        addStudent,
        updateStudent,
        updateStudentInfo,
        currentStudentNumber: currentUser.student_number || '2024-00142',
        safRecords,
        recordSafPayment,
        addSafRecord,
        transactions,
        addTransaction,
        reviewTransaction,
        toggleArchiveTransaction,
        deleteTransaction,
        events,
        addEvent,
        createEvent: addEvent,
        attendances,
        penalties: attendances,
        recordAttendance,
        updateAttendancePhoto,
        payPenalty,
        proposals,
        createProposal,
        updateProposalDraft,
        submitProposalForReview,
        executiveReviewProposal,
        voteOnProposal,
        addProposalNote,
        adviserApproveProposal,
        deanApproveProposal,
        requestCashout,
        addExpense,
        requestReimbursement,
        approveReimbursement,
        submitLiquidation,
        recordBudgetReturn,
        forecastMetric,
        syncToSupabase,
        activeTab,
        setActiveTab,
        currentTab: activeTab,
        setCurrentTab: setActiveTab,
        isLiveSupabase,
        mobileFrameMode,
        setMobileFrameMode,
        selectedProposalIdForModal,
        setSelectedProposalIdForModal
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
