import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
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
  Briefcase,
  ShieldCheck,
  GraduationCap,
  Landmark,
  LogIn
} from 'lucide-react';

interface RegisterPageProps {
  onGoToLogin: () => void;
}

// ---------------------------------------------------------------------------
// Four broad account types the person registering can choose from.
// Each maps to one (or a filtered set) of the system's internal roles so the
// existing 5-stage approval workflow keeps working under the hood.
// ---------------------------------------------------------------------------
type AccountType = 'officer' | 'admin' | 'adviser' | 'student';

interface PositionOption {
  id: string;
  title: string;
  role: UserRole;
  description: string;
}

const ACCOUNT_TYPE_META: Record<AccountType, { label: string; description: string; icon: React.ReactNode; color: string; ring: string }> = {
  officer: {
    label: 'Officer',
    description: 'Treasurer, Governor, or Council Member handling budgets & voting.',
    icon: <Briefcase className="w-5 h-5" />,
    color: 'bg-amber-100 text-amber-800 border-amber-300',
    ring: 'ring-amber-400'
  },
  admin: {
    label: 'Admin',
    description: 'Dean / Executive with final approval & fund-release authority.',
    icon: <ShieldCheck className="w-5 h-5" />,
    color: 'bg-rose-100 text-rose-800 border-rose-300',
    ring: 'ring-rose-400'
  },
  adviser: {
    label: 'Adviser',
    description: 'Student Council Adviser / OSA formal review & approval.',
    icon: <Landmark className="w-5 h-5" />,
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    ring: 'ring-emerald-400'
  },
  student: {
    label: 'Student',
    description: 'View-only access to SAF status, attendance, and penalties.',
    icon: <GraduationCap className="w-5 h-5" />,
    color: 'bg-slate-100 text-slate-800 border-slate-300',
    ring: 'ring-slate-400'
  }
};

const POSITIONS_BY_TYPE: Record<AccountType, PositionOption[]> = {
  officer: [
    { id: 'treasurer_dept', title: 'Department Treasurer', role: 'officer_treasurer', description: 'Manages SAF collection, budget drafts, and disbursement cashouts.' },
    { id: 'treasurer_asst', title: 'Assistant Treasurer', role: 'officer_treasurer', description: 'Assists in auditing SAF collections, receipts, and line items.' },
    { id: 'gov_college', title: 'College Governor', role: 'officer_governor', description: 'Executive review and endorsement of budget proposals.' },
    { id: 'gov_vice', title: 'Vice Governor', role: 'officer_governor', description: 'Assists the Governor in leading department programs.' },
    { id: 'council_pres', title: 'Student Council President', role: 'officer_governor', description: 'Overall council leadership and resolution sign-off.' },
    { id: 'council_rep', title: 'Council Representative', role: 'council_member', description: 'Votes and comments on budget proposal resolutions.' },
    { id: 'council_sec', title: 'Council Secretary', role: 'council_member', description: 'Documents meetings, resolutions, and event attendance.' }
  ],
  admin: [
    { id: 'dean_college', title: 'College Dean', role: 'dean', description: 'Final approval and fund-release authorization.' },
    { id: 'dean_assoc', title: 'Associate Dean / Program Chair', role: 'dean', description: 'Assists in departmental leadership and fund oversight.' }
  ],
  adviser: [
    { id: 'adviser_csc', title: 'Student Council Adviser', role: 'csc_adviser', description: 'Formal review and approval before the Dean.' },
    { id: 'adviser_osa', title: 'Office of Student Affairs Officer', role: 'csc_adviser', description: 'Oversees general regulation of student organizations.' }
  ],
  student: [
    { id: 'student_reg', title: 'Student / Council Member', role: 'student', description: 'View SAF status, attendance, and clearance penalties.' },
    { id: 'student_officer', title: 'Class Mayor / Representative', role: 'student', description: 'Class or block representative for department coordination.' }
  ]
};

const DEFAULT_COURSES: Record<DepartmentCode, string[]> = {
  CAF: ['BS Accountancy (BSA)', 'BS Management Accounting (BSMA)', 'BS Accounting Information System'],
  CCS: ['BS Computer Science (BSCS)', 'BS Information Technology (BSIT)', 'Associate in Computer Technology'],
  CBM: ['BS Business Administration (BSBA)', 'BS Hospitality Management (BSHM)', 'BS Tourism Management (BSTM)'],
  COE: ['BS Civil Engineering (BSCE)', 'BS Computer Engineering (BSCpE)', 'BS Electrical Engineering (BSEE)'],
  CAS: ['AB Communication', 'AB Political Science', 'BS Psychology'],
  CCJE: ['BS Criminology (BSCrim)', 'BS Industrial Security Management'],
  CHS: ['BS Nursing (BSN)', 'BS Medical Technology', 'BS Radiologic Technology'],
  CTED: ['Bachelor of Secondary Education (BSED)', 'Bachelor of Elementary Education (BEED)']
};

export const RegisterPage: React.FC<RegisterPageProps> = ({ onGoToLogin }) => {
  const { registerUser } = useApp();

  const [accountType, setAccountType] = useState<AccountType>('student');
  const [selectedPositionId, setSelectedPositionId] = useState<string>(POSITIONS_BY_TYPE.student[0].id);
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentPositions = POSITIONS_BY_TYPE[accountType];
  const currentPosition = currentPositions.find(p => p.id === selectedPositionId) || currentPositions[0];

  const handleAccountTypeChange = (type: AccountType) => {
    setAccountType(type);
    setSelectedPositionId(POSITIONS_BY_TYPE[type][0].id);
  };

  const handleDepartmentChange = (dept: DepartmentCode) => {
    setDepartment(dept);
    const courses = DEFAULT_COURSES[dept];
    if (courses?.length) setCourse(courses[0]);
    setSection(`${dept}-1A`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your First Name and Last Name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password && password !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const res = registerUser({
        name: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim(),
        role: currentPosition.role,
        department,
        student_number: studentNumber.trim() || undefined,
        officer_position: currentPosition.title,
        course,
        year_level: yearLevel,
        section,
        password: password || undefined
      });
      setIsSubmitting(false);
      if (!res.success) {
        setError(res.message);
      }
      // On success, isAuthenticated flips to true in context and the app renders the dashboard automatically.
    }, 350);
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account Type Selector */}
            <div>
              <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-[#00873E]" />
                I am registering as *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(ACCOUNT_TYPE_META) as AccountType[]).map((type) => {
                  const meta = ACCOUNT_TYPE_META[type];
                  const isSelected = accountType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleAccountTypeChange(type)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1.5 ${
                        isSelected ? `${meta.color} ring-2 ${meta.ring} font-bold` : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {meta.icon}
                      <span className="text-xs font-extrabold">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">{ACCOUNT_TYPE_META[accountType].description}</p>
            </div>

            {/* Position within account type */}
            {currentPositions.length > 1 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Specific Position</label>
                <select
                  value={selectedPositionId}
                  onChange={(e) => setSelectedPositionId(e.target.value)}
                  className="w-full py-2.5 px-3 text-sm font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E] bg-white cursor-pointer"
                >
                  {currentPositions.map(pos => (
                    <option key={pos.id} value={pos.id}>{pos.title}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">{currentPosition.description}</p>
              </div>
            )}

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> Email *
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. jdelacruz@gbox.ncf.edu.ph"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E]" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <IdCard className="w-3.5 h-3.5 text-slate-400" /> Student / Employee ID
                </label>
                <input type="text" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)}
                  placeholder={accountType === 'admin' || accountType === 'adviser' ? 'e.g. EMP-4029' : 'e.g. 2024-00142'}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E]" />
              </div>
            </div>

            {/* Academic details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Course / Program</label>
                <select value={course} onChange={(e) => setCourse(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E] bg-white cursor-pointer">
                  {(DEFAULT_COURSES[department] || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Year Level</label>
                <select value={yearLevel} onChange={(e) => setYearLevel(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E] bg-white cursor-pointer">
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Faculty/Staff">Faculty / Adviser</option>
                  <option value="Administration">Administration</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Section</label>
                <input type="text" value={section} onChange={(e) => setSection(e.target.value)}
                  placeholder="e.g. CAF-1A"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E]" />
              </div>
            </div>

            {/* Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Set a password"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E]" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600" tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Password</label>
                <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E]" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-[#00873E] hover:bg-[#007033] text-white font-bold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating account...' : 'Complete Registration & Log In'}</span>
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
