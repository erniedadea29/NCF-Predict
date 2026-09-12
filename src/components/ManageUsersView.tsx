import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole, OfficerSlotKey, OFFICER_POSITION_LABELS, DepartmentCode, UserAccountSummary } from '../types';
import { DEPARTMENTS } from '../data/mockData';
import { SearchableUserSelect } from './SearchableUserSelect';
import {
  ShieldCheck,
  ShieldOff,
  Search,
  Award,
  UserMinus,
  Crown,
  Landmark,
  GraduationCap,
  Trash2,
  Archive
} from 'lucide-react';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'officer_treasurer', label: 'Treasurer' },
  { value: 'officer_governor', label: 'Governor' },
  { value: 'council_member', label: 'Council Member' },
  { value: 'cashier', label: 'SAF Cashier' },
  { value: 'csc_adviser', label: 'Adviser' },
  { value: 'dean', label: 'Dean' },
  { value: 'admin', label: 'System Admin' },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'employee', label: 'Employee' },
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
          <SearchableUserSelect
            candidates={eligibleStudents}
            value={studentId}
            onChange={setStudentId}
            placeholder="Search students..."
          />
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
                title="Demote — reverts to student, keeps the account active">
                <UserMinus className="w-3.5 h-3.5" /> Demote
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Super Admin promotes one Admin per department (up to all 8).
const AdminPromotionPanel: React.FC = () => {
  const { userAccounts, promoteEmployeeToAdmin, deactivateUser, demoteToEmployee } = useApp();
  const [departmentCode, setDepartmentCode] = useState<DepartmentCode>('CAF');
  const [employeeId, setEmployeeId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Super Admin has no department of its own — candidates span every
  // department; the department picker below decides which slot to claim.
  const eligibleEmployees = userAccounts.filter(u => u.role === 'employee' && u.is_active);
  const currentAdmins = userAccounts.filter(u => u.role === 'admin' && u.is_active);

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) { setMessage({ type: 'error', text: 'Select an employee first.' }); return; }
    setSubmitting(true);
    setMessage(null);
    const res = await promoteEmployeeToAdmin(employeeId, departmentCode);
    setSubmitting(false);
    setMessage({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) setEmployeeId('');
  };

  const handleDeactivate = async (profileId: string) => {
    setSubmitting(true);
    setMessage(null);
    await deactivateUser(profileId);
    setSubmitting(false);
    setMessage({ type: 'success', text: 'Deactivated — that department\'s Admin slot is now open for a new promotion.' });
  };

  const handleDemote = async (profileId: string) => {
    setSubmitting(true);
    setMessage(null);
    const res = await demoteToEmployee(profileId);
    setSubmitting(false);
    setMessage({ type: res.success ? 'success' : 'error', text: res.success ? 'Demoted to Employee — they remain active and can be re-promoted later.' : res.message });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Crown className="w-4.5 h-4.5 text-[#00873E]" />
        <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Promote Employee to Admin</h3>
      </div>
      <p className="text-[11px] text-slate-500 -mt-2">
        One Admin per department per school year, across all 8 departments. Demote reverts them to Employee (still active, re-promotable);
        Deactivate blocks their login entirely. Either one frees the department's slot immediately.
      </p>

      {message && (
        <div className={`p-2.5 rounded-xl text-xs border ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handlePromote} className="space-y-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Department</label>
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(DEPARTMENTS) as DepartmentCode[]).map(dept => {
              const taken = currentAdmins.some(a => a.department === dept);
              return (
                <button
                  key={dept}
                  type="button"
                  disabled={taken}
                  onClick={() => setDepartmentCode(dept)}
                  className={`p-2 rounded-lg border text-xs font-extrabold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    departmentCode === dept ? 'border-[#00873E] bg-emerald-50 text-emerald-950 ring-1 ring-[#00873E]' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                  title={taken ? `${dept} already has an Admin` : dept}
                >
                  {dept}{taken ? ' •' : ''}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Employee</label>
            <SearchableUserSelect
              candidates={eligibleEmployees}
              value={employeeId}
              onChange={setEmployeeId}
              placeholder="Search employees..."
            />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={submitting || !employeeId}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-[#00873E] hover:bg-[#007033] text-white shadow-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap">
              {submitting ? 'Promoting...' : 'Promote'}
            </button>
          </div>
        </div>
      </form>

      {currentAdmins.length > 0 && (
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Current Admins ({currentAdmins.length}/8)</p>
          {currentAdmins.map(a => (
            <div key={a.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-xl px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{a.full_name}</p>
                <p className="text-[10px] text-slate-500 truncate">{a.department} • {a.email}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => handleDemote(a.id)} disabled={submitting}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                  title="Demote to Employee — stays active, eligible for re-promotion">
                  <UserMinus className="w-3.5 h-3.5" /> Demote
                </button>
                <button onClick={() => handleDeactivate(a.id)} disabled={submitting}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                  title="Deactivate — frees this department's Admin slot">
                  <ShieldOff className="w-3.5 h-3.5" /> Deactivate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Admin promotes exactly one Dean, in the Admin's own department.
const DeanPromotionPanel: React.FC = () => {
  const { userAccounts, currentUser, promoteEmployeeToDean, deactivateUser, demoteToEmployee } = useApp();
  const [employeeId, setEmployeeId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const eligibleEmployees = userAccounts.filter(u => u.role === 'employee' && u.is_active && u.department === currentUser.department);
  const currentDean = userAccounts.find(u => u.role === 'dean' && u.is_active && u.department === currentUser.department);

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) { setMessage({ type: 'error', text: 'Select an employee first.' }); return; }
    setSubmitting(true);
    setMessage(null);
    const res = await promoteEmployeeToDean(employeeId);
    setSubmitting(false);
    setMessage({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) setEmployeeId('');
  };

  const handleDeactivate = async (profileId: string) => {
    setSubmitting(true);
    setMessage(null);
    await deactivateUser(profileId);
    setSubmitting(false);
    setMessage({ type: 'success', text: 'Deactivated — the Dean slot for your department is now open for a new promotion.' });
  };

  const handleDemote = async (profileId: string) => {
    setSubmitting(true);
    setMessage(null);
    const res = await demoteToEmployee(profileId);
    setSubmitting(false);
    setMessage({ type: res.success ? 'success' : 'error', text: res.success ? 'Demoted to Employee — they remain active and can be re-promoted later.' : res.message });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Landmark className="w-4.5 h-4.5 text-[#00873E]" />
        <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Promote Employee to Dean</h3>
      </div>
      <p className="text-[11px] text-slate-500 -mt-2">
        Exactly one Dean for {currentUser.department} this school year. Demote reverts them to Employee (still active, re-promotable);
        Deactivate blocks their login entirely. Either one frees the slot immediately.
      </p>

      {message && (
        <div className={`p-2.5 rounded-xl text-xs border ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {message.text}
        </div>
      )}

      {currentDean ? (
        <div className="flex items-center justify-between gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">{currentDean.full_name}</p>
            <p className="text-[10px] text-slate-500 truncate">{currentDean.email}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => handleDemote(currentDean.id)} disabled={submitting}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
              title="Demote to Employee — stays active, eligible for re-promotion">
              <UserMinus className="w-3.5 h-3.5" /> Demote
            </button>
            <button onClick={() => handleDeactivate(currentDean.id)} disabled={submitting}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
              title="Deactivate — frees the Dean slot">
              <ShieldOff className="w-3.5 h-3.5" /> Deactivate
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handlePromote} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Employee</label>
            <SearchableUserSelect
              candidates={eligibleEmployees}
              value={employeeId}
              onChange={setEmployeeId}
              placeholder="Search employees in your department..."
            />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={submitting || !employeeId}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-[#00873E] hover:bg-[#007033] text-white shadow-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap">
              {submitting ? 'Promoting...' : 'Promote'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

// Dean promotes exactly one Adviser, in the Dean's own department.
const AdviserPromotionPanel: React.FC = () => {
  const { userAccounts, currentUser, promoteEmployeeToAdviser, deactivateUser, demoteToEmployee } = useApp();
  const [employeeId, setEmployeeId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const eligibleEmployees = userAccounts.filter(u => u.role === 'employee' && u.is_active && u.department === currentUser.department);
  const currentAdviser = userAccounts.find(u => u.role === 'csc_adviser' && u.is_active && u.department === currentUser.department);

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) { setMessage({ type: 'error', text: 'Select an employee first.' }); return; }
    setSubmitting(true);
    setMessage(null);
    const res = await promoteEmployeeToAdviser(employeeId);
    setSubmitting(false);
    setMessage({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) setEmployeeId('');
  };

  const handleDeactivate = async (profileId: string) => {
    setSubmitting(true);
    setMessage(null);
    await deactivateUser(profileId);
    setSubmitting(false);
    setMessage({ type: 'success', text: 'Deactivated — the Adviser slot for your department is now open for a new promotion.' });
  };

  const handleDemote = async (profileId: string) => {
    setSubmitting(true);
    setMessage(null);
    const res = await demoteToEmployee(profileId);
    setSubmitting(false);
    setMessage({ type: res.success ? 'success' : 'error', text: res.success ? 'Demoted to Employee — they remain active and can be re-promoted later.' : res.message });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <GraduationCap className="w-4.5 h-4.5 text-[#00873E]" />
        <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Promote Employee to Adviser</h3>
      </div>
      <p className="text-[11px] text-slate-500 -mt-2">
        Exactly one Adviser for {currentUser.department} this school year. Demote reverts them to Employee (still active, re-promotable);
        Deactivate blocks their login entirely. Either one frees the slot immediately.
      </p>

      {message && (
        <div className={`p-2.5 rounded-xl text-xs border ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {message.text}
        </div>
      )}

      {currentAdviser ? (
        <div className="flex items-center justify-between gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">{currentAdviser.full_name}</p>
            <p className="text-[10px] text-slate-500 truncate">{currentAdviser.email}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => handleDemote(currentAdviser.id)} disabled={submitting}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
              title="Demote to Employee — stays active, eligible for re-promotion">
              <UserMinus className="w-3.5 h-3.5" /> Demote
            </button>
            <button onClick={() => handleDeactivate(currentAdviser.id)} disabled={submitting}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
              title="Deactivate — frees the Adviser slot">
              <ShieldOff className="w-3.5 h-3.5" /> Deactivate
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handlePromote} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Employee</label>
            <SearchableUserSelect
              candidates={eligibleEmployees}
              value={employeeId}
              onChange={setEmployeeId}
              placeholder="Search employees in your department..."
            />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={submitting || !employeeId}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-[#00873E] hover:bg-[#007033] text-white shadow-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap">
              {submitting ? 'Promoting...' : 'Promote'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export const ManageUsersView: React.FC = () => {
  const { userAccounts, deactivateUser, reactivateUser, deleteUserAccount, demoteToEmployee, currentUser, isDepartmentRestricted, userDepartment } = useApp();

  // Dean/Adviser only manage accounts within their own registered
  // department — Admin/Super Admin (unrestricted) still see everyone
  // system-wide.
  const scopedUserAccounts = isDepartmentRestricted
    ? userAccounts.filter(u => u.department === userDepartment)
    : userAccounts;

  const [searchQuery, setSearchQuery] = useState('');
  // Two-step inline confirm for permanent delete (Super Admin only) — no
  // accidental one-click hard deletes.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null);

  const filteredUsers = scopedUserAccounts.filter(u => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const handleDeleteAccount = async (profileId: string) => {
    setDeletingId(profileId);
    setDeleteError(null);
    const res = await deleteUserAccount(profileId);
    setDeletingId(null);
    setConfirmingDeleteId(null);
    if (!res.success) setDeleteError({ id: profileId, message: res.message });
  };

  const [demotingId, setDemotingId] = useState<string | null>(null);
  const [demoteError, setDemoteError] = useState<{ id: string; message: string } | null>(null);

  const handleDemoteAccount = async (profileId: string) => {
    setDemotingId(profileId);
    setDemoteError(null);
    const res = await demoteToEmployee(profileId);
    setDemotingId(null);
    if (!res.success) setDemoteError({ id: profileId, message: res.message });
  };

  // Who the current viewer is allowed to demote back to Employee — mirrors
  // demote_to_employee's own server-side rule exactly (Super Admin->Admin,
  // Admin->Dean/Adviser in their own department, Dean->Adviser in theirs).
  const canDemote = (u: UserAccountSummary): boolean => {
    if (u.id === currentUser.id) return false;
    if (currentUser.role === 'super_admin') return u.role === 'admin';
    if (currentUser.role === 'admin') return (u.role === 'dean' || u.role === 'csc_adviser') && u.department === currentUser.department;
    if (currentUser.role === 'dean') return u.role === 'csc_adviser' && u.department === currentUser.department;
    return false;
  };

  // Deactivated accounts get their own "Archived" section instead of
  // showing inline (with a badge) inside the active lists — Section 5.
  const activeFilteredUsers = filteredUsers.filter(u => u.is_active);
  const archivedFilteredUsers = filteredUsers.filter(u => !u.is_active);

  // Super Admin sees the whole system at once, so Student and Employee
  // accounts get their own containers instead of one mixed list — everyone
  // else's role check is unambiguous already (only two roles are this
  // easy to confuse at a glance).
  const isSuperAdminView = currentUser.role === 'super_admin';
  const studentUsers = activeFilteredUsers.filter(u => u.role === 'student');
  const employeeUsers = activeFilteredUsers.filter(u => u.role === 'employee');
  const staffUsers = activeFilteredUsers.filter(u => u.role !== 'student' && u.role !== 'employee');

  const renderAccountRow = (u: UserAccountSummary) => {
    const canHardDelete = currentUser.role === 'super_admin' && u.id !== currentUser.id && u.role !== 'super_admin';
    const demotable = canDemote(u);
    return (
      <div key={u.id} className="p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-3">
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
            {demotable && (
              <button
                onClick={() => handleDemoteAccount(u.id)}
                disabled={demotingId === u.id}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                title="Demote — reverts to Employee, keeps the account active and eligible for re-promotion later"
              >
                <UserMinus className="w-3.5 h-3.5" /> {demotingId === u.id ? 'Demoting...' : 'Demote'}
              </button>
            )}
            {canHardDelete && confirmingDeleteId !== u.id && (
              <button
                onClick={() => { setConfirmingDeleteId(u.id); setDeleteError(null); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-[11px] font-bold transition cursor-pointer"
                title="Permanently delete this account — cannot be undone"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
          </div>
        </div>

        {canHardDelete && confirmingDeleteId === u.id && (
          <div className="flex items-center justify-between gap-2 bg-slate-900 text-white rounded-xl px-3 py-2 text-xs">
            <span>Permanently delete <strong>{u.full_name}</strong>? This cannot be undone.</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setConfirmingDeleteId(null)}
                disabled={deletingId === u.id}
                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAccount(u.id)}
                disabled={deletingId === u.id}
                className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition cursor-pointer disabled:opacity-50"
              >
                {deletingId === u.id ? 'Deleting...' : 'Yes, delete permanently'}
              </button>
            </div>
          </div>
        )}

        {deleteError && deleteError.id === u.id && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-3 py-2 text-xs">
            {deleteError.message}
          </div>
        )}

        {demoteError && demoteError.id === u.id && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2 text-xs">
            {demoteError.message}
          </div>
        )}
      </div>
    );
  };

  const AccountListContainer: React.FC<{ title: string; users: UserAccountSummary[]; accent?: 'emerald' | 'indigo' | 'slate' | 'rose'; icon?: React.ReactNode }> = ({ title, users, accent = 'slate', icon }) => {
    const accentClasses = {
      emerald: 'bg-[#00873E] text-white',
      indigo: 'bg-indigo-600 text-white',
      slate: 'bg-slate-800 text-white',
      rose: 'bg-rose-100 text-rose-800'
    }[accent];
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-full flex flex-col">
        <div className="px-4 py-3 border-b border-slate-100">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${accentClasses}`}>
            {icon} {title} ({users.length})
          </span>
        </div>
        <div className="divide-y divide-slate-100 flex-1">
          {users.map(renderAccountRow)}
          {users.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-400">No {title.toLowerCase()} found.</div>
          )}
        </div>
      </div>
    );
  };

  // A dedicated, separately-labeled "Archived" container for deactivated
  // accounts (Section 5) — kept distinct from Deactivate's own inline
  // badge so archived accounts read as a deliberate holding area, not
  // clutter mixed into the active lists.
  const ArchivedSection = () => (
    <AccountListContainer
      title="Archived"
      users={archivedFilteredUsers}
      accent="rose"
      icon={<Archive className="w-3.5 h-3.5" />}
    />
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Manage Users</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {scopedUserAccounts.length} account(s) on record{isDepartmentRestricted ? ` in ${userDepartment}` : ''}
          </p>
        </div>
      </div>

      {currentUser.role === 'super_admin' && <AdminPromotionPanel />}
      {currentUser.role === 'admin' && <DeanPromotionPanel />}
      {currentUser.role === 'dean' && <AdviserPromotionPanel />}
      {currentUser.role === 'csc_adviser' && <OfficerPromotionPanel />}

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text" placeholder="Search by name or email..." value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-emerald-500"
        />
      </div>

      {isSuperAdminView ? (
        <div className="space-y-4">
          {/* Student / Employee side by side — the two easiest-to-confuse
              roles get their own labeled column instead of sharing a list. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AccountListContainer title="Student" users={studentUsers} accent="emerald" />
            <AccountListContainer title="Employee" users={employeeUsers} accent="indigo" />
          </div>
          <AccountListContainer title="Staff & Officers" users={staffUsers} accent="slate" />
          <ArchivedSection />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {activeFilteredUsers.map(renderAccountRow)}
              {activeFilteredUsers.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">No users found.</div>
              )}
            </div>
          </div>
          <ArchivedSection />
        </div>
      )}
    </div>
  );
};

export default ManageUsersView;
