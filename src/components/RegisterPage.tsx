import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getSupabase } from '../lib/supabaseClient';
import { UserRole, DepartmentCode } from '../types';
import { DEPARTMENTS } from '../data/mockData';
import {
  UserPlus,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Building2,
  IdCard,
  Award,
  ShieldCheck,
  GraduationCap,
  Landmark,
  LogIn,
  Lock
} from 'lucide-react';

interface RegisterPageProps {
  onGoToLogin: () => void;
}

// ---------------------------------------------------------------------------
// Only 4 self-registerable account types now. "Officer" is no longer one of
// them — officers are promoted from an existing student account by their
// Adviser (see the Manage Users / promotion flow), not self-selected here.
// ---------------------------------------------------------------------------
type AccountType = 'student' | 'adviser' | 'dean' | 'admin';

const ACCOUNT_TYPE_META: Record<AccountType, { label: string; role: UserRole; description: string; icon: React.ReactNode; color: string; ring: string; emailHint: string }> = {
  student: {
    label: 'Student', role: 'student',
    description: 'View SAF status, attendance, budgets, and clearance penalties.',
    icon: <GraduationCap className="w-5 h-5" />,
    color: 'bg-slate-100 text-slate-800 border-slate-300', ring: 'ring-slate-400',
    emailHint: 'Must be an @gbox.ncf.edu.ph address.'
  },
  adviser: {
    label: 'Adviser', role: 'csc_adviser',
    description: 'Student Council Adviser — reviews proposals/liquidation, approves events, promotes officers.',
    icon: <Landmark className="w-5 h-5" />,
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300', ring: 'ring-emerald-400',
    emailHint: 'Must be an @ncf.edu.ph address (not @gbox.ncf.edu.ph).'
  },
  dean: {
    label: 'Dean', role: 'dean',
    description: 'Final approval & fund-release authority for one course.',
    icon: <Award className="w-5 h-5" />,
    color: 'bg-rose-100 text-rose-800 border-rose-300', ring: 'ring-rose-400',
    emailHint: 'Must be an @ncf.edu.ph address (not @gbox.ncf.edu.ph).'
  },
  admin: {
    label: 'Admin', role: 'admin',
    description: 'System management only — user accounts, courses, school year.',
    icon: <ShieldCheck className="w-5 h-5" />,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-300', ring: 'ring-indigo-400',
    emailHint: 'Must be an @ncf.edu.ph address (not @gbox.ncf.edu.ph).'
  }
};

// One admin/dean/adviser per course per school year — this bucket only needs
// the role, no sub-positions (officer positions are assigned later by the
// Adviser via promotion, not chosen here).
const STAFF_TYPES: AccountType[] = ['adviser', 'dean', 'admin'];

const DEFAULT_COURSES: Record<DepartmentCode, string[]> = {
  CAF: ['BS Accountancy (BSA)', 'BS Management Accounting (BSMA)', 'BS Accounting Information System'],
  CCS: ['BS Computer Science (BSCS)', 'BS Information Technology (BSIT)', 'BS Information System (BSIS)', 'Associate in Computer Technology'],
  CBM: ['BS Business Administration (BSBA)', 'BS Hospitality Management (BSHM)', 'BS Tourism Management (BSTM)'],
  COE: ['BS Civil Engineering (BSCE)', 'BS Computer Engineering (BSCpE)', 'BS Electrical Engineering (BSEE)'],
  CAS: ['AB Communication', 'AB Political Science', 'BS Psychology'],
  CCJE: ['BS Criminology (BSCrim)', 'BS Industrial Security Management'],
  CHS: ['BS Nursing (BSN)', 'BS Medical Technology', 'BS Radiologic Technology'],
  CTED: ['Bachelor of Secondary Education (BSED)', 'Bachelor of Elementary Education (BEED)']
};

export const RegisterPage: React.FC<RegisterPageProps> = ({ onGoToLogin }) => {
  const { registerUser, courses, takenRoleSlots } = useApp();

  const [accountType, setAccountType] = useState<AccountType>('student');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [department, setDepartment] = useState<DepartmentCode>('CAF');
  const [course, setCourse] = useState<string>(DEFAULT_COURSES.CAF[0]);
  const [yearLevel, setYearLevel] = useState<string>('1st Year');
  const [section, setSection] = useState<string>('CAF-1A');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studentIdAvailable, setStudentIdAvailable] = useState<boolean | null>(null);
  const [checkingStudentId, setCheckingStudentId] = useState(false);

  const isStaffType = STAFF_TYPES.includes(accountType);
  const meta = ACCOUNT_TYPE_META[accountType];

  // Courses under the selected department, from the DB (falls back to the
  // static list if the courses table hasn't loaded yet).
  const coursesInDept = useMemo(() => {
    const fromDb = courses.filter(c => c.department_code === department);
    if (fromDb.length > 0) return fromDb.map(c => ({ id: c.id, name: c.name }));
    return (DEFAULT_COURSES[department] || []).map((name, i) => ({ id: -1 - i, name }));
  }, [courses, department]);

  const takenSlotKeyForType: Record<string, string> = { adviser: 'adviser', dean: 'dean', admin: 'admin' };
  // Staff (Admin/Dean/Adviser) no longer pick a course — they're scoped to
  // their whole Department instead, so uniqueness is checked at that level.
  const isDeptTakenForRole = () => {
    const slotKey = takenSlotKeyForType[accountType];
    if (!slotKey) return false;
    return takenRoleSlots.some(s => s.department_code === department && s.slot_key === slotKey);
  };

  const checkStudentIdAvailability = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) { setStudentIdAvailable(null); return; }
    setCheckingStudentId(true);
    try {
      const { data, error: rpcError } = await getSupabase().rpc('check_student_number_available', { p_student_number: trimmed });
      setStudentIdAvailable(rpcError ? null : Boolean(data));
    } finally {
      setCheckingStudentId(false);
    }
  };

  const handleAccountTypeChange = (type: AccountType) => {
    setAccountType(type);
    setError('');
  };

  const handleDepartmentChange = (dept: DepartmentCode) => {
    setDepartment(dept);
    const defaults = DEFAULT_COURSES[dept];
    if (defaults?.length) setCourse(defaults[0]);
    setSection(`${dept}-1A`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your First Name and Last Name.');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    const isGbox = /@gbox\.ncf\.edu\.ph$/i.test(cleanEmail);
    const isNcf = /@ncf\.edu\.ph$/i.test(cleanEmail);
    if (accountType === 'student' && !isGbox) {
      setError('Student accounts must use an @gbox.ncf.edu.ph email address.');
      return;
    }
    if (isStaffType) {
      if (isGbox) { setError('Admin, Dean, and Adviser accounts must use an @ncf.edu.ph email address, not @gbox.ncf.edu.ph.'); return; }
      if (!isNcf) { setError('Admin, Dean, and Adviser accounts must use an @ncf.edu.ph email address.'); return; }
      if (isDeptTakenForRole()) { setError(`That department already has a registered ${meta.label} this school year.`); return; }
    }
    if (!password || password.length < 6) {
      setError('Please enter a password of at least 6 characters.');
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain both letters and numbers.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }
    if (accountType === 'student' && studentIdAvailable === false) {
      setError('That Student ID is already taken. Please use a different one.');
      return;
    }

    setIsSubmitting(true);
    const res = await registerUser({
      name: `${firstName.trim()} ${lastName.trim()}`,
      email: cleanEmail,
      role: meta.role,
      department,
      student_number: accountType === 'student' ? (studentNumber.trim() || undefined) : undefined,
      officer_position: meta.label,
      course: accountType === 'student' ? course : undefined,
      year_level: accountType === 'student' ? yearLevel : undefined,
      section: accountType === 'student' ? section : undefined,
      password
    });
    setIsSubmitting(false);
    if (!res.success) {
      setError(res.message);
      return;
    }
    setSuccessMessage(res.message);
    setTimeout(() => onGoToLogin(), 1800);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#00873E] via-[#03693a] to-slate-900 flex items-center justify-center p-3 sm:p-6 py-8">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 sm:p-10 max-h-[92vh] overflow-y-auto">
          <div className="mb-6">
            <div className="w-11 h-11 rounded-2xl bg-[#00873E]/10 flex items-center justify-center mb-4">
              <UserPlus className="w-5 h-5 text-[#00873E]" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">Create your account</h2>
            <p className="text-xs text-slate-500 mt-1">Choose your account type to get the right access level.</p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 mb-4">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 mb-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage} Redirecting to login&hellip;</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {/* Account Type Selector */}
            <div>
              <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-[#00873E]" />
                I am registering as *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(ACCOUNT_TYPE_META) as AccountType[]).map((type) => {
                  const m = ACCOUNT_TYPE_META[type];
                  const isSelected = accountType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleAccountTypeChange(type)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1.5 ${
                        isSelected ? `${m.color} ring-2 ${m.ring} font-bold` : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {m.icon}
                      <span className="text-xs font-extrabold">{m.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">{meta.description}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 italic">{meta.emailHint}</p>
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Building2 className="w-4 h-4 text-[#00873E]" />
                Department / College *
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(DEPARTMENTS) as DepartmentCode[]).map((dept) => {
                  const isSelected = department === dept;
                  return (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => handleDepartmentChange(dept)}
                      className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                        isSelected ? 'border-[#00873E] bg-emerald-50 text-emerald-950 font-bold ring-1 ring-[#00873E]' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-extrabold">{dept}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Course — students only. Admin/Dean/Adviser are scoped to their
                whole Department instead (one per department per school
                year, checked above via isDeptTakenForRole), so they never
                see a course picker at all. */}
            {isStaffType ? (
              isDeptTakenForRole() && (
                <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {department} already has a registered {meta.label} this school year — choose a different department, or contact that department's {meta.label} if this is a mistake.
                </p>
              )
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Course / Program *</label>
                <select
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E] bg-white cursor-pointer"
                >
                  {coursesInDept.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">First Name *</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Juan"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E]" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Last Name *</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Dela Cruz"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E]" required />
              </div>
            </div>

            <div className={`grid grid-cols-1 ${accountType === 'student' ? 'sm:grid-cols-2' : ''} gap-3`}>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> Email *
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder={accountType === 'student' ? 'e.g. jdelacruz@gbox.ncf.edu.ph' : 'e.g. jdelacruz@ncf.edu.ph'}
                  autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E]" required />
              </div>
              {accountType === 'student' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <IdCard className="w-3.5 h-3.5 text-slate-400" /> Student ID
                  </label>
                  <input type="text" value={studentNumber}
                    onChange={(e) => { setStudentNumber(e.target.value); setStudentIdAvailable(null); }}
                    onBlur={(e) => checkStudentIdAvailability(e.target.value)}
                    placeholder="e.g. 2024-00142"
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-[#00873E] ${
                      studentIdAvailable === false ? 'border-rose-400' : 'border-slate-300'
                    }`} />
                  {checkingStudentId && (
                    <p className="text-[11px] text-slate-400 mt-1">Checking availability&hellip;</p>
                  )}
                  {studentIdAvailable === false && !checkingStudentId && (
                    <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> This ID is already taken. Please use a different one.
                    </p>
                  )}
                  {studentIdAvailable === true && !checkingStudentId && (
                    <p className="text-[11px] text-emerald-600 font-semibold mt-1">✓ Available</p>
                  )}
                </div>
              )}
            </div>

            {/* Academic details — students only; Adviser/Dean/Admin don't
                have a year level or section. */}
            {accountType === 'student' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Year Level</label>
                  <select value={yearLevel} onChange={(e) => setYearLevel(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E] bg-white cursor-pointer">
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Section</label>
                  <input type="text" value={section} onChange={(e) => setSection(e.target.value)}
                    placeholder="e.g. CAF-1A"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E]" />
                </div>
              </div>
            )}

            {/* Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Set a password"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E]" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600" tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> At least 6 characters, with both letters and numbers.
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Password</label>
                <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E]" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || Boolean(successMessage)}
              className="w-full py-3 px-4 bg-[#00873E] hover:bg-[#007033] text-white font-bold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating account...' : 'Complete Registration'}</span>
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <button
              onClick={onGoToLogin}
              className="font-bold text-[#00873E] hover:text-[#007033] cursor-pointer underline underline-offset-2 inline-flex items-center gap-1"
            >
              <LogIn className="w-3.5 h-3.5" /> Log in here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
