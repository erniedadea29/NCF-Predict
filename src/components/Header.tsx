import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Calendar,
  Smartphone,
  Monitor,
  ChevronDown,
  LogOut,
  Pencil,
  UserCog
} from 'lucide-react';
import { UserRole } from '../types';
import { SchoolYearEditModal } from './SchoolYearEditModal';
import { EditProfileModal } from './EditProfileModal';

const STAFF_ROLES: UserRole[] = ['csc_adviser', 'dean', 'admin'];

export const Header: React.FC = () => {
  const {
    currentUser,
    activeSemester,
    activeTab,
    setActiveTab,
    mobileFrameMode,
    setMobileFrameMode,
    logoutUser,
    isReadOnlyStudent,
    isViewOnlyReviewer,
    isAdminSystemOnly
  } = useApp();

  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [isSyModalOpen, setIsSyModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'officer_treasurer':
        return { label: 'Treasurer', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'officer_governor':
        return { label: 'Governor', color: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'council_member':
        return { label: 'Council Member', color: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'csc_adviser':
        return { label: 'Adviser', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'dean':
        return { label: 'Dean', color: 'bg-rose-100 text-rose-800 border-rose-300' };
      case 'admin':
        return { label: 'System Admin', color: 'bg-rose-100 text-rose-800 border-rose-300' };
      case 'cashier':
        return { label: 'Cashier', color: 'bg-teal-100 text-teal-800 border-teal-300' };
      case 'student':
        return { label: 'Student', color: 'bg-slate-100 text-slate-800 border-slate-300' };
    }
  };

  const roleInfo = getRoleBadge(currentUser.role);
  const isStaff = STAFF_ROLES.includes(currentUser.role);

  // Role-aware navigation. Students get a limited, view-only nav; Dean/
  // Adviser get a course-scoped, mostly view-only nav (Reimbursement is
  // their only write-capable finance section); Admin is system-management
  // only and never sees the council workflow at all; everyone else
  // (officers/cashier) gets the full nav.
  const fullNav = [
    { id: 'home', label: 'Home' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'budget', label: 'Budget, Proposals & Reimbursement' },
    { id: 'liquidation_reports', label: 'Liquidation Reports' },
    { id: 'saf_students', label: 'SAF & Students' },
    { id: 'events_attendance', label: 'Events & Penalties' },
    { id: 'forecast', label: 'ML Forecast' },
    ...(isStaff ? [{ id: 'manage_users', label: 'Manage Users' }] : [])
  ];

  const studentNav = [
    { id: 'student_portal', label: 'My Student Portal' },
    { id: 'budget', label: 'Budget' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'events_attendance', label: 'Events & Penalties' }
  ];

  // Dean/Adviser: course-scoped, mostly view-only. No general "Budget and
  // Proposals" or "Draft CCS Proposal" sections — the Budget tab here
  // renders Reimbursement-only content (gated inside BudgetProposalWorkflow).
  const reviewerNav = [
    { id: 'home', label: 'Home' },
    { id: 'transactions', label: 'CCS Transactions' },
    { id: 'budget', label: 'Reimbursement' },
    { id: 'liquidation_reports', label: 'Liquidation Reports' },
    { id: 'saf_students', label: 'CCS SAF Cash-In' },
    { id: 'events_attendance', label: 'Events & Penalties' },
    { id: 'manage_users', label: 'Manage Users' }
  ];

  // Admin: system-management only — no council workflow, no finance tabs.
  const adminNav = [
    { id: 'manage_users', label: 'Manage Users' }
  ];

  const navList = isReadOnlyStudent
    ? studentNav
    : isAdminSystemOnly
      ? adminNav
      : isViewOnlyReviewer
        ? reviewerNav
        : fullNav;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs no-print">
      {/* Top Utility Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between border-b border-slate-100 text-xs text-slate-600">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00873E] flex items-center justify-center text-white font-bold text-lg shadow-xs tracking-tight">
              Σ
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-sm leading-tight flex items-center gap-1.5">
                NCF PREDICT
                <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">v2.5</span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">Budget & Student Activity Fund (SAF) System</p>
            </div>
          </div>
        </div>

        {/* Action Pills */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Academic Year Pill - editable for staff, read-only for students */}
          <button
            onClick={() => !isReadOnlyStudent && setIsSyModalOpen(true)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#00873E] text-white font-medium text-xs shadow-xs transition ${
              isReadOnlyStudent ? 'cursor-default opacity-90' : 'hover:bg-[#007033] cursor-pointer'
            }`}
            title={isReadOnlyStudent ? 'Current academic period' : 'Click to edit Semester & School Year'}
          >
            <Calendar className="w-3 h-3 opacity-80" />
            <span>{activeSemester.school_year_label}</span>
            {!isReadOnlyStudent && <Pencil className="w-3 h-3 opacity-70" />}
          </button>

          {/* Mobile Shell Simulation Toggle */}
          <button
            onClick={() => setMobileFrameMode(!mobileFrameMode)}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition text-xs font-medium cursor-pointer"
            title="Toggle Mobile Simulator View"
          >
            {mobileFrameMode ? <Monitor className="w-3.5 h-3.5 text-slate-600" /> : <Smartphone className="w-3.5 h-3.5 text-slate-600" />}
            <span>{mobileFrameMode ? 'Full View' : 'Mobile Frame'}</span>
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-[#00873E] text-white font-bold flex items-center justify-center text-xs">
                {currentUser.name.charAt(0)}
              </div>
              <span className="hidden lg:inline text-xs font-semibold text-slate-800 truncate max-w-[110px]">
                {currentUser.name.split(' ')[0]}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {roleMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs text-slate-500">Logged in as:</p>
                  <p className="font-bold text-slate-900 text-sm truncate">{currentUser.name}</p>
                  <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 mt-1 rounded border ${roleInfo?.color}`}>
                    {currentUser.officer_position || roleInfo?.label}
                  </span>
                  {currentUser.department && (
                    <p className="text-[10px] text-slate-400 mt-1">Dept: {currentUser.department}</p>
                  )}
                </div>

                <div className="p-1">
                  <button
                    onClick={() => { setIsEditProfileOpen(true); setRoleMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2 transition cursor-pointer"
                  >
                    <UserCog className="w-3.5 h-3.5 text-slate-500" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    onClick={() => { setRoleMenuOpen(false); setConfirmingLogout(true); }}
                    className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-rose-50 text-rose-700 font-semibold flex items-center gap-2 transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-600" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmingLogout && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xs p-5 space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Log out?</h3>
              <p className="text-xs text-slate-500 mt-1">You'll need to log in again to access your account.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingLogout(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => { logoutUser(); setConfirmingLogout(false); }}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Horizontal Tab Navigation (role-aware) */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <nav className="flex space-x-1 sm:space-x-6 overflow-x-auto scrollbar-none py-2 text-sm font-semibold">
          {navList.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`pb-2 px-3 border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === item.id
                  ? 'border-[#00873E] text-[#00873E]'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <SchoolYearEditModal isOpen={isSyModalOpen} onClose={() => setIsSyModalOpen(false)} />
      <EditProfileModal isOpen={isEditProfileOpen} onClose={() => setIsEditProfileOpen(false)} />
    </header>
  );
};
