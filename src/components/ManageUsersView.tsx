import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole, DepartmentCode, OfficerSlotKey, OFFICER_POSITION_LABELS } from '../types';
import { DEPARTMENTS } from '../data/mockData';
import {
  UserPlus,
  ShieldCheck,
  ShieldOff,
  Copy,
  X,
  AlertCircle,
  Search,
  Award,
  UserMinus
} from 'lucide-react';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'officer_treasurer', label: 'Treasurer' },
  { value: 'officer_governor', label: 'Governor' },
  { value: 'council_member', label: 'Council Member' },
  { value: 'cashier', label: 'SAF Cashier' },
  { value: 'csc_adviser', label: 'Adviser' },
  { value: 'dean', label: 'Dean' },
  { value: 'admin', label: 'System Admin' },
  { value: 'student', label: 'Student' }
];

const roleLabel = (role: UserRole) => ROLE_OPTIONS.find(r => r.value === role)?.label || role;

const OFFICER_SLOTS: OfficerSlotKey[] = ['governor', 'vice_governor', 'treasurer', 'assistant_treasurer', 'auditor'];

// Reverse-map an officer_position label ("Vice Governor") back to its slot
// key ('vice_governor') so we can tell which slots are already occupied.
const labelToSlotKey = (label?: string): OfficerSlotKey | null => {
  if (!label) return null;
  const entry = (Object.entries(OFFICER_POSITION_LABELS) as [OfficerSlotKey, string][]).find(([, l]) => l === label);
  return entry ? entry[0] : null;
};

const OfficerPromotionPanel: React.FC = () => {
  const { userAccounts, currentUser, promoteToOfficer, vacateOfficerPosition } = useApp();
  const [studentId, setStudentId] = useState('');
  const [slotKey, setSlotKey] = useState<OfficerSlotKey>('governor');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Scope candidate students to the Adviser's own department (and course,
  // when the Adviser account is bound to one specific course).
  const eligibleStudents = userAccounts.filter(u =>
    u.role === 'student' && u.is_active &&
    u.department === currentUser.department &&
    (currentUser.course_id ? u.course_id === currentUser.course_id : true)
  );

  const currentOfficers = userAccounts.filter(u =>
    u.is_active &&
    u.department === currentUser.department &&
    (currentUser.course_id ? u.course_id === currentUser.course_id : true) &&
    labelToSlotKey(u.officer_position) !== null
  );

  const takenSlotKeys = new Set(currentOfficers.map(u => labelToSlotKey(u.officer_position)));

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) { setMessage({ type: 'error', text: 'Select a student first.' }); return; }
    setSubmitting(true);
    setMessage(null);
    const res = await promoteToOfficer(studentId, slotKey);
    setSubmitting(false);
    setMessage({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) setStudentId('');
  };

  const handleVacate = async (profileId: string) => {
    setSubmitting(true);
    setMessage(null);
    const res = await vacateOfficerPosition(profileId);
    setSubmitting(false);
    setMessage({ type: res.success ? 'success' : 'error', text: res.message });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Award className="w-4.5 h-4.5 text-[#00873E]" />
        <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Officer Promotion</h3>
      </div>
      <p className="text-[11px] text-slate-500 -mt-2">
        Promote a student in your department to an officer position. Each position can only be held by one active officer per school year.
      </p>

      {message && (
        <div className={`p-2.5 rounded-xl text-xs border ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handlePromote} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Student</label>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#00873E]">
            <option value="">Select a student...</option>
            {eligibleStudents.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.email})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Position</label>
          <select value={slotKey} onChange={(e) => setSlotKey(e.target.value as OfficerSlotKey)}
            className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#00873E]">
            {OFFICER_SLOTS.map(key => (
              <option key={key} value={key} disabled={takenSlotKeys.has(key)}>
                {OFFICER_POSITION_LABELS[key]}{takenSlotKeys.has(key) ? ' (Taken)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={submitting || !studentId}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-[#00873E] hover:bg-[#007033] text-white shadow-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap">
            {submitting ? 'Promoting...' : 'Promote'}
          </button>
        </div>
      </form>

      {currentOfficers.length > 0 && (
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Current Officers</p>
          {currentOfficers.map(o => (
            <div key={o.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-xl px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{o.full_name}</p>
                <p className="text-[10px] text-slate-500 truncate">{o.officer_position}</p>
              </div>
              <button onClick={() => handleVacate(o.id)} disabled={submitting}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition cursor-pointer disabled:opacity-50 shrink-0"
                title="Vacate position — reverts to student">
                <UserMinus className="w-3.5 h-3.5" /> Vacate
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ManageUsersView: React.FC = () => {
  const { userAccounts, addUserAccount, deactivateUser, reactivateUser, currentUser, isDepartmentRestricted, userDepartment } = useApp();

  // Dean/Adviser only manage accounts within their own registered
  // department — Admin (unrestricted) still sees everyone system-wide.
  const scopedUserAccounts = isDepartmentRestricted
    ? userAccounts.filter(u => u.department === userDepartment)
    : userAccounts;

  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('officer_treasurer');
  const [department, setDepartment] = useState<DepartmentCode>('CAF');
  const [studentNumber, setStudentNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = scopedUserAccounts.filter(u => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const resetForm = () => {
    setName(''); setEmail(''); setRole('officer_treasurer'); setDepartment('CAF'); setStudentNumber('');
    setError('');
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Please provide a name and email.');
      return;
    }
    setSubmitting(true);
    setError('');
    const res = await addUserAccount({ name: name.trim(), email: email.trim(), role, department, student_number: studentNumber.trim() || undefined });
    setSubmitting(false);
    if (!res.success) {
      setError(res.message);
      return;
    }
    setTempPasswordInfo({ email: email.trim(), password: res.tempPassword || '' });
    setShowAddForm(false);
    resetForm();
  };

  const copyTempPassword = () => {
    if (!tempPasswordInfo) return;
    navigator.clipboard?.writeText(tempPasswordInfo.password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Manage Users</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {scopedUserAccounts.length} account(s) on record{isDepartmentRestricted ? ` in ${userDepartment}` : ''}
          </p>
        </div>
        <button
          onClick={() => { setShowAddForm(true); resetForm(); }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#00873E] hover:bg-[#007033] text-white shadow-xs transition cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Add User</span>
        </button>
      </div>

      {currentUser.role === 'csc_adviser' && <OfficerPromotionPanel />}

      {tempPasswordInfo && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">
              Account created for {tempPasswordInfo.email}. Temporary password (this will not be shown again — copy it now):
            </p>
            <div className="flex items-center gap-2 mt-2">
              <code className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-sm font-mono text-slate-800">
                {tempPasswordInfo.password}
              </code>
              <button
                onClick={copyTempPassword}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-[11px] text-amber-700 mt-2">Relay this to the new user directly — there's no automated email delivery. They should change it after their first login.</p>
          </div>
          <button onClick={() => setTempPasswordInfo(null)} className="p-1 text-amber-600 hover:text-amber-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text" placeholder="Search by name or email..." value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-emerald-500"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {filteredUsers.map(u => (
            <div key={u.id} className="flex items-center justify-between gap-3 p-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                  u.is_active ? 'bg-[#00873E] text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {u.full_name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-900 truncate">{u.full_name}{u.id === currentUser.id ? ' (You)' : ''}</p>
                  <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">{roleLabel(u.role)}</span>
                {u.department && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">{u.department}</span>}
                {u.is_active ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Active</span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">Deactivated</span>
                )}
                {u.id !== currentUser.id && (
                  u.is_active ? (
                    <button
                      onClick={() => deactivateUser(u.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition cursor-pointer"
                      title="Deactivate (blocks their login)"
                    >
                      <ShieldOff className="w-3.5 h-3.5" /> Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => reactivateUser(u.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold transition cursor-pointer"
                      title="Reactivate"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Reactivate
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">No users found.</div>
          )}
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#00873E] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                <h3 className="font-extrabold text-base">Add User</h3>
              </div>
              <button onClick={() => setShowAddForm(false)} className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-5 space-y-3">
              {error && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Role</label>
                  <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#00873E]">
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Department</label>
                  <select value={department} onChange={(e) => setDepartment(e.target.value as DepartmentCode)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#00873E]">
                    {Object.keys(DEPARTMENTS).map(code => <option key={code} value={code}>{code}</option>)}
                  </select>
                </div>
              </div>
              {role === 'student' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Student ID (optional)</label>
                  <input type="text" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)}
                    placeholder="Auto-generated if left blank"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E]" />
                </div>
              )}
              <button type="submit" disabled={submitting}
                className="w-full py-2.5 px-4 bg-[#00873E] hover:bg-[#007033] text-white font-bold text-sm rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50">
                {submitting ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsersView;
