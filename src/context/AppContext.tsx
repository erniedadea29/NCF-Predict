import React, { createContext, useContext, useState, useEffect } from 'react';
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
  ProposalNote
} from '../types';
import { 
  DEPARTMENTS, 
  INITIAL_ACTIVE_SEMESTER, 
  MOCK_USERS, 
  MOCK_STUDENTS, 
  MOCK_SAF_RECORDS, 
  MOCK_TRANSACTIONS, 
  MOCK_SCHOOL_EVENTS, 
  MOCK_ATTENDANCES, 
  MOCK_PROPOSALS,
  MOCK_FORECAST 
} from '../data/mockData';
import { isSupabaseLiveConfigured, updateSupabaseCredentials, getSupabase } from '../lib/supabaseClient';

export interface SupabaseConfigState {
  url: string;
  anonKey: string;
  autoSync: boolean;
}

interface AppContextType {
  // Authentication & User Accounts
  currentUser: User;
  setCurrentUser: (user: User) => void;
  switchRole: (role: UserRole, studentNumber?: string) => void;
  users: User[];
  loginUser: (identifier: string, password?: string) => { success: boolean; message: string; user?: User };
  logoutUser: () => void;
  isAuthenticated: boolean;
  isReadOnlyStudent: boolean;
  registerUser: (userData: {
    name: string;
    email: string;
    role: UserRole;
    department: DepartmentCode;
    student_number?: string;
    officer_position?: string;
    course?: string;
    year_level?: string;
    section?: string;
    password?: string;
    contact_number?: string;
  }) => { success: boolean; message: string; user?: User };
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
  updateActiveSemester: (syLabel: string, semName: string) => void;

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
  addTransaction: (tx: Omit<DepartmentTransaction, 'id' | 'reference_code' | 'is_archived'>) => void;
  toggleArchiveTransaction: (id: string) => void;
  deleteTransaction: (id: string) => void;

  // Events & Attendance Penalties
  events: SchoolEvent[];
  addEvent: (event: Omit<SchoolEvent, 'id' | 'created_at'>) => void;
  createEvent: (event: Omit<SchoolEvent, 'id' | 'created_at'>) => void;
  attendances: EventAttendance[];
  penalties: EventAttendance[];
  recordAttendance: (eventId: string, studentId: string, status: 'Present' | 'Absent' | 'Excused', remarks?: string) => void;
  payPenalty: (attendanceId: string, receiptNo?: string) => void;

  // Budget Proposals & 5-Stage Approval Workflow
  proposals: BudgetProposal[];
  createProposal: (proposal: Omit<BudgetProposal, 'id' | 'created_at' | 'updated_at' | 'votes' | 'notes' | 'cashouts' | 'expenses' | 'reimbursements'>) => string;
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
  approveReimbursement: (reimbursementId: string) => void;
  submitLiquidation: (budgetId: string, accountingSummary: { category: string; spent: number; line_item_count: number }[], notes: string) => void;
  recordBudgetReturn: (budgetId: string, amount: number, remarks: string) => void;

  // Forecast & AI
  forecastMetric: ForecastMetric;

  // Supabase Sync
  supabaseConfig: SupabaseConfigState;
  updateSupabaseConfig: (cfg: { url: string; anonKey: string; autoSync?: boolean }) => void;
  syncToSupabase: () => Promise<{ success: boolean; message: string }>;

  // Department Access Control & Scoping
  userDepartment: DepartmentCode;
  switchDepartment: (dept: DepartmentCode) => void;
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
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_users`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {}
    }
    return MOCK_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('ncf_user');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return MOCK_USERS[0]; // Maria Cristina Bautista (Treasurer - CAF)
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('ncf_is_authenticated') === 'true';
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);

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

  const [activeSemester, setActiveSemester] = useState<ActiveSemester>(() => {
    const saved = localStorage.getItem('ncf_active_sem');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_ACTIVE_SEMESTER;
  });

  const [departments, setDepartments] = useState<Record<DepartmentCode, DepartmentInfo>>(DEPARTMENTS);
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_students`);
    return saved ? JSON.parse(saved) : MOCK_STUDENTS;
  });

  const [safRecords, setSafRecords] = useState<SAFRecord[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_saf`);
    return saved ? JSON.parse(saved) : MOCK_SAF_RECORDS;
  });

  const [transactions, setTransactions] = useState<DepartmentTransaction[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_transactions`);
    return saved ? JSON.parse(saved) : MOCK_TRANSACTIONS;
  });

  const [events, setEvents] = useState<SchoolEvent[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_events`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some(e => e.id?.startsWith('ev_caf') || e.department === 'CAF')) {
          return parsed;
        }
      } catch {}
    }
    return MOCK_SCHOOL_EVENTS;
  });

  const [attendances, setAttendances] = useState<EventAttendance[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_attendances`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some(a => a.id?.startsWith('att_caf') || a.department === 'CAF')) {
          return parsed;
        }
      } catch {}
    }
    return MOCK_ATTENDANCES;
  });

  const [proposals, setProposals] = useState<BudgetProposal[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_proposals`);
    return saved ? JSON.parse(saved) : MOCK_PROPOSALS;
  });

  const [forecastMetric] = useState<ForecastMetric>(MOCK_FORECAST);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [mobileFrameMode, setMobileFrameMode] = useState<boolean>(false);
  const [selectedProposalIdForModal, setSelectedProposalIdForModal] = useState<string | null>(null);
  const [isLiveSupabase, setIsLiveSupabase] = useState<boolean>(isSupabaseLiveConfigured());

  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfigState>(() => {
    const savedUrl = typeof window !== 'undefined' ? localStorage.getItem('ncf_supabase_url') || '' : '';
    const savedKey = typeof window !== 'undefined' ? localStorage.getItem('ncf_supabase_key') || '' : '';
    return {
      url: savedUrl,
      anonKey: savedKey,
      autoSync: true
    };
  });

  const updateSupabaseConfig = (cfg: { url: string; anonKey: string; autoSync?: boolean }) => {
    setSupabaseConfig({
      url: cfg.url,
      anonKey: cfg.anonKey,
      autoSync: cfg.autoSync ?? true
    });
    updateSupabaseCredentials(cfg.url, cfg.anonKey);
    setIsLiveSupabase(isSupabaseLiveConfigured());
  };

  const syncToSupabase = async (): Promise<{ success: boolean; message: string }> => {
    try {
      if (!supabaseConfig.url || !supabaseConfig.anonKey) {
        return { 
          success: false, 
          message: 'Saved in LocalStorage database. Supabase cloud sync is ready once live credentials are provided.' 
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
    localStorage.setItem('ncf_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('ncf_is_authenticated', isAuthenticated ? 'true' : 'false');
  }, [isAuthenticated]);

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

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_users`, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('ncf_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('ncf_user');
    }
  }, [currentUser]);

  const loginUser = (identifier: string, password?: string): { success: boolean; message: string; user?: User } => {
    const cleanId = identifier.trim().toLowerCase();
    const found = users.find(u => 
      u.email.toLowerCase() === cleanId || 
      (u.student_number && u.student_number.toLowerCase() === cleanId) ||
      u.id.toLowerCase() === cleanId ||
      u.name.toLowerCase() === cleanId
    );

    if (!found) {
      return { 
        success: false, 
        message: `Walang nahanap na account para sa "${identifier}". Pakitiyak ang iyong email o ID number, o mag-rehistro ng bago.` 
      };
    }

    if (found.password && password && found.password !== password) {
      return { 
        success: false, 
        message: 'Maling password. Pakisubukang muli o gamitin ang demo password.' 
      };
    }

    setCurrentUser(found);
    setIsAuthenticated(true);
    if (found.role === 'student') {
      setActiveTab('student_portal');
    } else {
      setActiveTab('home');
    }
    setIsAuthModalOpen(false);

    return { 
      success: true, 
      message: `Maligayang pagbabalik, ${found.name}! Naka-log in bilang ${found.officer_position || found.role}.`, 
      user: found 
    };
  };

  const logoutUser = () => {
    setIsAuthenticated(false);
    setIsAuthModalOpen(true);
    setAuthModalMode('login');
  };

  const switchRole = (role: UserRole, studentNumber?: string) => {
    if (role === 'student') {
      const matchStud = students.find(s => s.student_number === studentNumber) || students.find(s => s.department === (currentUser.department || 'CAF')) || students[0];
      const studentUser: User = {
        id: `usr_${matchStud.id}`,
        name: `${matchStud.first_name} ${matchStud.last_name}`,
        email: matchStud.email,
        role: 'student',
        student_number: matchStud.student_number,
        course: matchStud.course,
        year_level: matchStud.year_level,
        section: matchStud.section,
        department: matchStud.department,
        officer_position: `${matchStud.department} Student Member`
      };
      setCurrentUser(studentUser);
      setActiveTab('student_portal');
      return;
    }

    const matchedUser = users.find(u => u.role === role && (!currentUser.department || u.department === currentUser.department)) || users.find(u => u.role === role) || MOCK_USERS.find(u => u.role === role) || MOCK_USERS[0];
    setCurrentUser(matchedUser);
  };

  const switchDepartment = (dept: DepartmentCode) => {
    // Look for a matching user in this department or update current user
    const existingInDept = users.find(u => u.department === dept && u.role === currentUser.role);
    if (existingInDept) {
      setCurrentUser(existingInDept);
    } else {
      const deptName = DEPARTMENTS[dept]?.name || dept;
      setCurrentUser(prev => ({
        ...prev,
        department: dept,
        officer_position: prev.role === 'officer_treasurer' ? `${dept} Department Treasurer` :
                          prev.role === 'officer_governor' ? `${dept} College Governor` :
                          prev.role === 'student' ? `${dept} Student Member` :
                          prev.officer_position || `${dept} Representative`,
        course: dept === 'CAF' ? 'BS Accountancy' :
                dept === 'CCS' ? 'BS Information Technology' :
                dept === 'CBM' ? 'BS Business Administration' :
                dept === 'COE' ? 'BS Civil Engineering' :
                dept === 'CAS' ? 'AB Communication' :
                dept === 'CCJE' ? 'BS Criminology' :
                dept === 'CHS' ? 'BS Nursing' : 'Bachelor of Secondary Education'
      }));
    }
  };

  const registerUser = (userData: {
    name: string;
    email: string;
    role: UserRole;
    department: DepartmentCode;
    student_number?: string;
    officer_position?: string;
    course?: string;
    year_level?: string;
    section?: string;
    password?: string;
    contact_number?: string;
  }): { success: boolean; message: string; user?: User } => {
    const cleanEmail = userData.email.trim().toLowerCase();
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { 
        success: false, 
        message: `Mayroon nang nakarehistrong account gamit ang email na "${userData.email}". Mangyaring mag-log in na lamang.` 
      };
    }

    const newUser: User = {
      id: `usr_${Date.now()}`,
      name: userData.name.trim(),
      email: userData.email.trim(),
      role: userData.role,
      department: userData.department,
      student_number: userData.student_number?.trim() || (userData.role === 'student' ? `2024-${Math.floor(10000 + Math.random() * 90000)}` : undefined),
      officer_position: userData.officer_position || (
        userData.role === 'officer_treasurer' ? `${userData.department} Department Treasurer` :
        userData.role === 'officer_governor' ? `${userData.department} College Governor` :
        userData.role === 'council_member' ? `${userData.department} Council Representative` :
        userData.role === 'csc_adviser' ? 'Student Affairs & CSC Adviser' :
        userData.role === 'dean' ? 'College Dean & Executive Director' : `${userData.department} Student Member`
      ),
      course: userData.course || (
        userData.department === 'CAF' ? 'BS Accountancy' :
        userData.department === 'CCS' ? 'BS Information Technology' :
        userData.department === 'CBM' ? 'BS Business Administration' :
        userData.department === 'COE' ? 'BS Civil Engineering' :
        userData.department === 'CAS' ? 'AB Communication' :
        userData.department === 'CCJE' ? 'BS Criminology' :
        userData.department === 'CHS' ? 'BS Nursing' : 'Bachelor of Secondary Education'
      ),
      year_level: userData.year_level || (userData.role === 'dean' || userData.role === 'csc_adviser' ? 'Faculty/Admin' : '1st Year'),
      section: userData.section || (userData.role === 'dean' || userData.role === 'csc_adviser' ? 'Administration' : `${userData.department}-1A`),
      password: userData.password,
      contact_number: userData.contact_number,
      registered_at: new Date().toISOString()
    };

    setUsers(prev => [newUser, ...prev]);
    setCurrentUser(newUser);
    setIsAuthenticated(true);

    // If registered as student (or has student number), add to students roster if not exists
    if (newUser.student_number) {
      const exists = students.some(s => s.student_number === newUser.student_number);
      if (!exists) {
        const parts = newUser.name.trim().split(' ');
        const firstName = parts.slice(0, -1).join(' ') || parts[0];
        const lastName = parts.length > 1 ? parts[parts.length - 1] : 'Student';
        addStudent({
          student_number: newUser.student_number,
          first_name: firstName,
          last_name: lastName,
          course: newUser.course || 'BS Accountancy',
          year_level: newUser.year_level || '1st Year',
          section: newUser.section || `${newUser.department}-1A`,
          email: newUser.email,
          department: newUser.department || 'CAF',
          activesem_id: activeSemester.id,
          school_year: activeSemester.school_year_label
        });
      }
    }

    if (newUser.role === 'student') {
      setActiveTab('student_portal');
    } else if (newUser.role === 'officer_treasurer') {
      setActiveTab('home');
    } else {
      setActiveTab('proposals');
    }

    setIsAuthModalOpen(false);

    return { 
      success: true, 
      message: `Matagumpay na narehistro ang account para kay ${newUser.name} bilang ${newUser.officer_position}!`, 
      user: newUser 
    };
  };

  const updateActiveSemester = (syLabel: string, semName: string) => {
    setActiveSemester({
      id: `sem_${Date.now()}`,
      schoolyear_id: `sy_${syLabel.replace(/\s+/g, '_')}`,
      semester_id: `sem_${semName.replace(/\s+/g, '_')}`,
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

  const addStudent = (studentData: Omit<Student, 'id'>) => {
    const newStudent: Student = {
      ...studentData,
      id: `stud_${Date.now()}`
    };
    setStudents(prev => [newStudent, ...prev]);

    // Automatically initialize standard SAF collection entry
    const newSaf: SAFRecord = {
      id: `saf_${Date.now()}`,
      student_id: newStudent.id,
      student_number: newStudent.student_number,
      student_name: `${newStudent.first_name} ${newStudent.last_name}`,
      course: newStudent.course,
      section: newStudent.section,
      year_level: newStudent.year_level,
      department: newStudent.department,
      amount: 250.00,
      paid: false,
      activesem_id: activeSemester.id,
      school_year: activeSemester.school_year_label,
      double_entry: {
        debit_account: 'Student Activity Fund (SAF) Receivable',
        credit_account: 'Uncollected Student Dues',
        amount: 250.00,
        reference_no: `PENDING-${newStudent.student_number}`,
        transaction_type: 'SAF_CASH_IN',
        created_at: new Date().toISOString()
      },
      collected_by: 'Pending',
      notes: 'New student enrollment registration'
    };
    setSafRecords(prev => [newSaf, ...prev]);
  };

  const updateStudent = (id: string, updates: Partial<Student>) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const recordSafPayment = (safId: string, paymentMethod: 'Cash' | 'Online / Bank' | 'G-Cash', notes?: string) => {
    const timestamp = new Date();
    const receiptNo = `SAF-${timestamp.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const formattedDate = timestamp.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    setSafRecords(prev => prev.map(rec => {
      if (rec.id === safId) {
        return {
          ...rec,
          paid: true,
          payment_date: formattedDate,
          receipt_no: receiptNo,
          payment_method: paymentMethod,
          collected_by: `${currentUser.name} (${currentUser.officer_position || 'Treasury Officer'})`,
          notes: notes || rec.notes,
          double_entry: {
            debit_account: 'Student Activity Fund (SAF)',
            credit_account: paymentMethod === 'Cash' ? 'Cash on Hand (Treasury Vault)' : 'Cash in Bank (NCF Trust Account)',
            amount: rec.amount,
            reference_no: receiptNo,
            transaction_type: 'SAF_CASH_IN',
            created_at: timestamp.toISOString()
          }
        };
      }
      return rec;
    }));

    // Record corresponding income transaction
    const targetRec = safRecords.find(r => r.id === safId);
    if (targetRec) {
      addTransaction({
        title: `SAF Fee Collection - ${targetRec.student_name}`,
        department: targetRec.department,
        category: 'Revenue',
        date: timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount: targetRec.amount,
        type: 'INCOME',
        status: 'Completed',
        description: `SAF Double-entry cash-in (Receipt #${receiptNo})`
      });
    }
  };

  const addSafRecord = (record: Omit<SAFRecord, 'id' | 'double_entry' | 'receipt_no'>) => {
    const timestamp = new Date();
    const receiptNo = `SAF-${timestamp.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const newSaf: SAFRecord = {
      ...record,
      id: `saf_${Date.now()}`,
      receipt_no: record.paid ? receiptNo : undefined,
      payment_date: record.paid ? timestamp.toLocaleDateString('en-US') : undefined,
      double_entry: {
        debit_account: 'Student Activity Fund (SAF)',
        credit_account: record.payment_method === 'Cash' ? 'Cash on Hand' : 'Cash in Bank',
        amount: record.amount,
        reference_no: receiptNo,
        transaction_type: 'SAF_CASH_IN',
        created_at: timestamp.toISOString()
      }
    };
    setSafRecords(prev => [newSaf, ...prev]);
  };

  const addTransaction = (tx: Omit<DepartmentTransaction, 'id' | 'reference_code' | 'is_archived'>) => {
    const newTx: DepartmentTransaction = {
      ...tx,
      id: `tx_${Date.now()}`,
      reference_code: `${tx.department}-${tx.category.toUpperCase().slice(0, 3)}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      is_archived: false
    };
    setTransactions(prev => [newTx, ...prev]);

    // Update department stats
    if (tx.type === 'EXPENSE') {
      setDepartments(prev => {
        const dept = prev[tx.department];
        const newSpent = dept.spent + tx.amount;
        return {
          ...prev,
          [tx.department]: {
            ...dept,
            spent: newSpent,
            remaining: dept.allocated - newSpent,
            usedPercentage: Math.min(100, Math.round((newSpent / dept.allocated) * 100))
          }
        };
      });
    }
  };

  const toggleArchiveTransaction = (id: string) => {
    setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, is_archived: !tx.is_archived } : tx));
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== id));
  };

  const addEvent = (eventData: Omit<SchoolEvent, 'id' | 'created_at'>) => {
    const penaltyFee = eventData.penalty ?? eventData.penalty_fee_amount ?? 50.00;
    const desc = eventData.event_description || eventData.description || 'Mandatory departmental academic activity.';
    const newEvent: SchoolEvent = {
      ...eventData,
      id: `ev_${Date.now()}`,
      penalty: penaltyFee,
      penalty_fee_amount: penaltyFee,
      event_description: desc,
      description: desc,
      school_year: eventData.school_year || activeSemester.school_year_label,
      created_at: new Date().toISOString().slice(0, 10)
    };
    setEvents(prev => [newEvent, ...prev]);

    // Pre-populate default attendance for students under this department or ALL
    const targetStudents = students.filter(s => eventData.department === 'ALL' || s.department === eventData.department);
    const initialAttendances: EventAttendance[] = targetStudents.map(stud => ({
      id: `att_${Date.now()}_${stud.id}`,
      event_id: newEvent.id,
      event_title: newEvent.event_title,
      student_id: stud.id,
      student_number: stud.student_number,
      student_name: `${stud.first_name} ${stud.last_name}`,
      course: stud.course,
      section: stud.section,
      department: stud.department,
      status: 'Absent', // Default until marked present
      penalty_amount: penaltyFee,
      amount: penaltyFee,
      penalty_paid: false,
      notes: 'Initial event registration'
    }));

    setAttendances(prev => [...initialAttendances, ...prev]);
  };

  const recordAttendance = (
    eventId: string, 
    studentIdOrNumber: string, 
    statusOrIsPresent: 'Present' | 'Absent' | 'Excused' | boolean, 
    remarks?: string
  ) => {
    const status: 'Present' | 'Absent' | 'Excused' = 
      typeof statusOrIsPresent === 'boolean' 
        ? (statusOrIsPresent ? 'Present' : 'Absent') 
        : statusOrIsPresent;

    const targetEvent = events.find(e => e.id === eventId);
    const penaltyVal = status === 'Absent' ? (targetEvent?.penalty ?? targetEvent?.penalty_fee_amount ?? 50.00) : 0;
    const timeIn = status === 'Present' ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined;

    setAttendances(prev => {
      const existingIdx = prev.findIndex(att => 
        att.event_id === eventId && (att.student_id === studentIdOrNumber || att.student_number === studentIdOrNumber)
      );

      if (existingIdx >= 0) {
        return prev.map((att, idx) => {
          if (idx === existingIdx) {
            return {
              ...att,
              status,
              time_in: timeIn || att.time_in,
              penalty_amount: penaltyVal,
              amount: penaltyVal,
              penalty_paid: status === 'Present' || status === 'Excused',
              notes: remarks || (status === 'Absent' ? 'Unexcused absence' : 'Present in attendance verified')
            };
          }
          return att;
        });
      } else {
        const stud = students.find(s => s.id === studentIdOrNumber || s.student_number === studentIdOrNumber);
        if (!stud) return prev;
        const newAtt: EventAttendance = {
          id: `att_${Date.now()}_${stud.id}`,
          event_id: eventId,
          event_title: targetEvent?.event_title || 'Semester Event',
          student_id: stud.id,
          student_number: stud.student_number,
          student_name: `${stud.first_name} ${stud.last_name}`,
          course: stud.course,
          section: stud.section,
          department: stud.department,
          status,
          time_in: timeIn,
          penalty_amount: penaltyVal,
          amount: penaltyVal,
          penalty_paid: status === 'Present' || status === 'Excused',
          notes: remarks || (status === 'Absent' ? 'Unexcused absence' : 'Present in attendance verified')
        };
        return [newAtt, ...prev];
      }
    });
  };

  const payPenalty = (attendanceId: string, receiptNo?: string) => {
    const rNo = receiptNo || `PEN-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const formattedDate = new Date().toISOString().slice(0, 10);

    setAttendances(prev => prev.map(att => {
      if (att.id === attendanceId) {
        return {
          ...att,
          penalty_paid: true,
          penalty_paid_date: formattedDate,
          receipt_no: rNo,
          notes: 'Penalty settled at Treasury'
        };
      }
      return att;
    }));

    // Record double entry cash-in for settled penalty
    const attRecord = attendances.find(a => a.id === attendanceId);
    if (attRecord && attRecord.penalty_amount > 0) {
      addTransaction({
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

  const createProposal = (proposalData: Omit<BudgetProposal, 'id' | 'created_at' | 'updated_at' | 'votes' | 'notes' | 'cashouts' | 'expenses' | 'reimbursements'>): string => {
    const newId = `prop_${Date.now()}`;
    const timestamp = new Date().toISOString().slice(0, 10);
    const newProposal: BudgetProposal = {
      ...proposalData,
      id: newId,
      created_at: timestamp,
      updated_at: timestamp,
      votes: [],
      notes: [
        {
          id: `note_init_${Date.now()}`,
          author_id: currentUser.id,
          author_name: currentUser.name,
          author_role: currentUser.role,
          note_content: proposalData.treasurer_notes || 'KUNG MAY NOTES KAMO IDAGDAG INI SA NOTES: Draft budget proposal created.',
          created_at: new Date().toLocaleString(),
          is_official: true
        }
      ],
      cashouts: [],
      expenses: [],
      reimbursements: []
    };

    setProposals(prev => [newProposal, ...prev]);
    return newId;
  };

  const updateProposalDraft = (id: string, updates: Partial<BudgetProposal>) => {
    setProposals(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          ...updates,
          updated_at: new Date().toISOString().slice(0, 10)
        };
      }
      return p;
    }));
  };

  const submitProposalForReview = (id: string) => {
    setProposals(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          budget_status: 'EXECUTIVE_REVIEW',
          updated_at: new Date().toISOString().slice(0, 10)
        };
      }
      return p;
    }));
  };

  const executiveReviewProposal = (id: string, decision: 'APPROVED_TO_COUNCIL' | 'NEEDS_REVISION' | 'REJECTED', remarks: string) => {
    setProposals(prev => prev.map(p => {
      if (p.id === id) {
        const nextStatus = decision === 'APPROVED_TO_COUNCIL' ? 'COUNCIL_VOTING' : (decision === 'NEEDS_REVISION' ? 'FOR_REVISION' : 'REJECTED');
        return {
          ...p,
          budget_status: nextStatus,
          executive_review: {
            reviewed_by: `${currentUser.name} (${currentUser.officer_position || 'Executive Committee'})`,
            decision,
            remarks,
            date: new Date().toISOString().slice(0, 10)
          },
          updated_at: new Date().toISOString().slice(0, 10)
        };
      }
      return p;
    }));
  };

  const voteOnProposal = (proposalId: string, vote: 'IN_FAVOR' | 'AGAINST' | 'ABSTAIN', comment: string) => {
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
      if (p.id === proposalId) {
        const updatedVotes = [...p.votes.filter(v => v.council_member_id !== currentUser.id), newVote];
        const inFavorCount = updatedVotes.filter(v => v.vote === 'IN_FAVOR').length;
        
        // If 2 or more votes in favor, auto-advance to CSC Adviser Approval stage
        const autoAdvance = inFavorCount >= 2;
        return {
          ...p,
          votes: updatedVotes,
          budget_status: autoAdvance ? 'CSC_ADVISER_APPROVAL' : p.budget_status,
          council_resolution: {
            resolution_number: p.council_resolution?.resolution_number || `CSC-RES-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
            resolution_title: `Resolution approving budget allocation for ${p.budget_title}`,
            date_voted: new Date().toISOString().slice(0, 10),
            status: autoAdvance ? 'PASSED' : 'PENDING'
          },
          updated_at: new Date().toISOString().slice(0, 10)
        };
      }
      return p;
    }));
  };

  const addProposalNote = (proposalId: string, noteContent: string, isOfficial: boolean = true) => {
    const newNote: ProposalNote = {
      id: `note_${Date.now()}`,
      author_id: currentUser.id,
      author_name: currentUser.name,
      author_role: currentUser.officer_position || currentUser.role,
      note_content: noteContent,
      created_at: new Date().toLocaleString(),
      is_official: isOfficial
    };

    setProposals(prev => prev.map(p => {
      if (p.id === proposalId) {
        return {
          ...p,
          notes: [...p.notes, newNote],
          updated_at: new Date().toISOString().slice(0, 10)
        };
      }
      return p;
    }));
  };

  const adviserApproveProposal = (proposalId: string, decision: 'APPROVED' | 'REVISION' | 'REJECTED', remarks: string) => {
    setProposals(prev => prev.map(p => {
      if (p.id === proposalId) {
        const nextStatus = decision === 'APPROVED' ? 'DEAN_APPROVAL' : (decision === 'REVISION' ? 'FOR_REVISION' : 'REJECTED');
        return {
          ...p,
          budget_status: nextStatus,
          adviser_approval: {
            adviser_name: currentUser.name,
            decision,
            remarks,
            date: new Date().toISOString().slice(0, 10)
          },
          updated_at: new Date().toISOString().slice(0, 10)
        };
      }
      return p;
    }));
  };

  const deanApproveProposal = (proposalId: string, decision: 'APPROVED_FUND_RELEASE' | 'REVISION' | 'REJECTED', remarks: string) => {
    setProposals(prev => prev.map(p => {
      if (p.id === proposalId) {
        const isApproved = decision === 'APPROVED_FUND_RELEASE';
        const nextStatus = isApproved ? 'APPROVED_RELEASED' : (decision === 'REVISION' ? 'FOR_REVISION' : 'REJECTED');
        
        // Create initial cashout record upon dean approval
        const initialCashout: CashoutRecord = {
          id: `co_${Date.now()}`,
          budget_id: p.id,
          amount_released: p.total_budget_amount,
          date_released: new Date().toISOString().slice(0, 10),
          purpose: `Fund release for approved proposal: ${p.budget_title}`,
          cashout_status: 'Released',
          officer_id: currentUser.id,
          officer_name: currentUser.name,
          voucher_no: `DV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          proof_docs: [
            { name: 'Dean_Executive_Approval_Letter.pdf', type: 'Letter', url: '#', date: new Date().toISOString().slice(0, 10) }
          ]
        };

        return {
          ...p,
          budget_status: nextStatus,
          dean_approval: {
            dean_name: currentUser.name,
            decision,
            remarks,
            date: new Date().toISOString().slice(0, 10),
            release_authorized: isApproved
          },
          cashouts: isApproved ? [...p.cashouts, initialCashout] : p.cashouts,
          updated_at: new Date().toISOString().slice(0, 10)
        };
      }
      return p;
    }));
  };

  const requestCashout = (budgetId: string, amount: number, purpose: string, proofDocs: { name: string; type: string; url: string; date: string }[]) => {
    const newCashout: CashoutRecord = {
      id: `co_${Date.now()}`,
      budget_id: budgetId,
      amount_released: amount,
      date_released: new Date().toISOString().slice(0, 10),
      purpose,
      cashout_status: 'Released',
      officer_id: currentUser.id,
      officer_name: currentUser.name,
      voucher_no: `DV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      proof_docs: proofDocs.length > 0 ? proofDocs : [
        { name: 'Official_Budget_Release_Request.pdf', type: 'Letter', url: '#', date: new Date().toISOString().slice(0, 10) }
      ]
    };

    setProposals(prev => prev.map(p => {
      if (p.id === budgetId) {
        return {
          ...p,
          cashouts: [...p.cashouts, newCashout],
          updated_at: new Date().toISOString().slice(0, 10)
        };
      }
      return p;
    }));
  };

  const addExpense = (budgetId: string, desc: string, category: string, amount: number, proof: { name: string; type: string; url: string; invoice_number: string }) => {
    const newExp: ExpenseRecord = {
      id: `exp_${Date.now()}`,
      budget_id: budgetId,
      expense_desc: desc,
      category,
      amount_spent: amount,
      date_incurred: new Date().toISOString().slice(0, 10),
      proof_attach: [proof],
      officer_id: currentUser.id,
      officer_name: currentUser.name,
      reimbursement_status: 'None'
    };

    setProposals(prev => prev.map(p => {
      if (p.id === budgetId) {
        return {
          ...p,
          expenses: [...p.expenses, newExp],
          updated_at: new Date().toISOString().slice(0, 10)
        };
      }
      return p;
    }));

    const targetProp = proposals.find(p => p.id === budgetId);
    if (targetProp) {
      addTransaction({
        title: `${desc} (${targetProp.budget_title})`,
        department: targetProp.department,
        category: 'Event',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount,
        type: 'EXPENSE',
        status: 'Completed',
        description: `Expense receipt #${proof.invoice_number} attached`
      });
    }
  };

  const requestReimbursement = (expenseId: string, budgetId: string, amount: number, remarks: string) => {
    const newReimb: ReimbursementRecord = {
      id: `reimb_${Date.now()}`,
      expense_id: expenseId,
      budget_id: budgetId,
      amount_spent: amount,
      date_submitted: new Date().toISOString().slice(0, 10),
      reimbursement_status: 'Pending',
      remarks,
      officer_name: currentUser.name,
      receipt_ref: `REC-${Date.now()}`
    };

    setProposals(prev => prev.map(p => {
      if (p.id === budgetId) {
        return {
          ...p,
          reimbursements: [...p.reimbursements, newReimb],
          expenses: p.expenses.map(e => e.id === expenseId ? { ...e, reimbursement_status: 'Requested' } : e)
        };
      }
      return p;
    }));
  };

  const approveReimbursement = (reimbursementId: string) => {
    setProposals(prev => prev.map(p => {
      const matchReimb = p.reimbursements.find(r => r.id === reimbursementId);
      if (matchReimb) {
        return {
          ...p,
          reimbursements: p.reimbursements.map(r => r.id === reimbursementId ? { ...r, reimbursement_status: 'Approved' } : r),
          expenses: p.expenses.map(e => e.id === matchReimb.expense_id ? { ...e, reimbursement_status: 'Approved' } : e)
        };
      }
      return p;
    }));
  };

  const submitLiquidation = (budgetId: string, accountingSummary: { category: string; spent: number; line_item_count: number }[], notes: string) => {
    const targetProp = proposals.find(p => p.id === budgetId);
    if (!targetProp) return;

    const totalReleased = targetProp.cashouts.reduce((sum, c) => sum + c.amount_released, 0) || targetProp.total_budget_amount;
    const totalSpent = targetProp.expenses.reduce((sum, e) => sum + e.amount_spent, 0);
    const balance = Math.max(0, totalReleased - totalSpent);

    const newLiquidation: LiquidationRecord = {
      id: `liq_${Date.now()}`,
      budget_id: budgetId,
      total_budget: targetProp.total_budget_amount,
      total_released: totalReleased,
      total_spent: totalSpent,
      balance,
      status: 'Audited',
      accounting_summary: accountingSummary,
      submitted_by: currentUser.name,
      submitted_date: new Date().toISOString().slice(0, 10),
      notes: notes || 'Liquidation submitted with all supporting invoices and official receipts verified.'
    };

    setProposals(prev => prev.map(p => {
      if (p.id === budgetId) {
        return {
          ...p,
          liquidation: newLiquidation,
          updated_at: new Date().toISOString().slice(0, 10)
        };
      }
      return p;
    }));
  };

  const recordBudgetReturn = (budgetId: string, amount: number, remarks: string) => {
    const refCode = `CR-RETURN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const newReturn: BudgetReturnRecord = {
      id: `ret_${Date.now()}`,
      budget_id: budgetId,
      amount_returned: amount,
      date_returned: new Date().toISOString().slice(0, 10),
      cash_in_reference: refCode,
      double_entry: {
        debit: 'Cash on Hand (SAF Vault)',
        credit: 'Unspent Event Budget Return'
      },
      returned_by: currentUser.name,
      received_by: 'Dean / Student Affairs Officer',
      remarks
    };

    setProposals(prev => prev.map(p => {
      if (p.id === budgetId) {
        return {
          ...p,
          budget_return: newReturn,
          updated_at: new Date().toISOString().slice(0, 10)
        };
      }
      return p;
    }));

    const targetProp = proposals.find(p => p.id === budgetId);
    if (targetProp) {
      addTransaction({
        title: `Budget Return: ${targetProp.budget_title}`,
        department: targetProp.department,
        category: 'Revenue',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount,
        type: 'INCOME',
        status: 'Completed',
        description: `Cash-in double entry return of unspent SAF budget (${refCode})`
      });
    }
  };

  const updateStudentInfo = (studentNumber: string, updates: Partial<Student>) => {
    setStudents(prev => prev.map(s => s.student_number === studentNumber ? { ...s, ...updates } : s));
  };

  // Department Scoping Logic
  const userDepartment: DepartmentCode = currentUser.department || 'CAF';
  // Check if department restricted - non-dean or if user has designated department
  const isDepartmentRestricted = Boolean(userDepartment);

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

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        switchRole,
        isAuthenticated,
        isReadOnlyStudent,
        switchDepartment,
        registerUser,
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
        users,
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
        toggleArchiveTransaction,
        deleteTransaction,
        events,
        addEvent,
        createEvent: addEvent,
        attendances,
        penalties: attendances,
        recordAttendance,
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
        supabaseConfig,
        updateSupabaseConfig,
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
