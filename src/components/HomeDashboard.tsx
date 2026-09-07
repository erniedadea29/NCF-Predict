import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  PlusCircle, 
  FileText, 
  UserCheck, 
  Receipt,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Layers,
  Lock,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { DepartmentCode, DepartmentBudgetSummary } from '../types';

interface HomeDashboardProps {
  onOpenAddTransaction: () => void;
  onOpenCreateProposal: () => void;
  onOpenDeptSwitch?: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ 
  onOpenAddTransaction, 
  onOpenCreateProposal,
  onOpenDeptSwitch
}) => {
  const { 
    currentUser, 
    activeSemester, 
    departments, 
    scopedDepartmentInfo,
    scopedDepartmentList,
    scopedTransactions,
    scopedProposals, 
    scopedSafRecords, 
    userDepartment,
    isDepartmentRestricted,
    setActiveTab
  } = useApp();

  // Department-scoped budget calculations
  const totalAllocated = isDepartmentRestricted 
    ? scopedDepartmentInfo.allocated 
    : scopedDepartmentList.reduce((sum, d) => sum + d.allocated, 0);

  const totalSpent = isDepartmentRestricted 
    ? scopedDepartmentInfo.spent 
    : scopedDepartmentList.reduce((sum, d) => sum + d.spent, 0);

  const totalRemaining = isDepartmentRestricted 
    ? scopedDepartmentInfo.remaining 
    : totalAllocated - totalSpent;

  const spentPercent = totalAllocated > 0 
    ? Math.round((totalSpent / totalAllocated) * 100) 
    : 0;

  const forecastAmount = isDepartmentRestricted 
    ? scopedDepartmentInfo.forecast 
    : 646300;

  // SAF statistics for designated department
  const totalSafCollected = scopedSafRecords.filter(s => s.paid).reduce((sum, s) => sum + s.amount, 0);
  const paidCount = scopedSafRecords.filter(s => s.paid).length;
  const unpaidCount = scopedSafRecords.filter(s => !s.paid).length;

  return (
    <div className="space-y-6">
      {/* Greeting & Department Context Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Hello, {currentUser.name.split(' ')[0]}! 👋
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              {currentUser.officer_position || currentUser.role.replace('_', ' ').toUpperCase()}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-blue-600" />
              Dept: {userDepartment}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {isDepartmentRestricted 
              ? `Designated Department View: ${scopedDepartmentInfo.name} (${userDepartment})` 
              : 'NCF Predict Budget & Student Activity Fund (SAF) Central Management'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenDeptSwitch && (
            <button
              onClick={onOpenDeptSwitch}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-300"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              Switch / Register Dept
            </button>
          )}
          <span className="px-3 py-1.5 rounded-xl bg-[#00873E] text-white text-xs font-bold shadow-xs flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {activeSemester.school_year_label} • {activeSemester.semester_name}
          </span>
        </div>
      </div>

      {/* Department Isolation Security Alert Notice */}
      {isDepartmentRestricted && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="p-1.5 bg-amber-100 rounded-lg text-amber-800 shrink-0 mt-0.5">
            <Lock className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <p className="font-bold flex items-center gap-1.5">
              Department-Level Data Isolation Active
              <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-amber-200/80 text-[10px] font-black text-amber-950">
                {userDepartment} ONLY
              </span>
            </p>
            <p className="text-amber-800/90 leading-relaxed">
              As a registered user of <strong className="font-bold">{scopedDepartmentInfo.name} ({userDepartment})</strong>, you are restricted to viewing and managing only your department's budget allocation, proposals, transactions, and student SAF records. Other departments' confidential data is locked.
            </p>
          </div>
        </div>
      )}

      {/* Primary Annual Budget Hero Card (Scoped to Designated Department) */}
      <div className="bg-[#00873E] text-white rounded-2xl p-5 sm:p-6 shadow-md overflow-hidden relative">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">
                  {isDepartmentRestricted ? `${scopedDepartmentInfo.name} (${userDepartment}) Budget` : 'Annual Budget Allocation'}
                </p>
                <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-black rounded-md uppercase">
                  {userDepartment}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-0.5">
                ₱{(totalAllocated / 1000).toFixed(1)}k
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-white/20 backdrop-blur-xs text-white text-xs font-bold rounded-full border border-white/20">
                {activeSemester.school_year_label}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium text-emerald-100">
              <span>₱{(totalSpent / 1000).toFixed(1)}k spent of ₱{(totalAllocated / 1000).toFixed(1)}k</span>
              <span className="font-bold text-white text-sm">{spentPercent}%</span>
            </div>
            <div className="w-full h-3 bg-black/20 rounded-full overflow-hidden p-0.5">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${Math.min(100, spentPercent)}%` }}
              ></div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
              <p className="text-[11px] text-emerald-100 font-medium">Remaining Funds</p>
              <p className="text-lg sm:text-xl font-bold text-white">₱{(totalRemaining / 1000).toFixed(1)}k</p>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
              <p className="text-[11px] text-emerald-100 font-medium">AI ARIMA-LSTM Forecast</p>
              <p className="text-lg sm:text-xl font-bold text-white">₱{(forecastAmount / 1000).toFixed(1)}k</p>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
              <p className="text-[11px] text-emerald-100 font-medium">Department SAF Collected</p>
              <p className="text-lg sm:text-xl font-bold text-white">₱{totalSafCollected.toLocaleString('en-US')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Hub */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={onOpenCreateProposal}
          className="p-3.5 bg-white hover:bg-emerald-50/50 border border-slate-200 rounded-xl flex flex-col items-start text-left transition shadow-2xs group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-105 transition">
            <FileText className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-800">Draft {userDepartment} Proposal</span>
          <span className="text-[11px] text-slate-500">5-Stage Approval Flow</span>
        </button>

        <button
          onClick={onOpenAddTransaction}
          className="p-3.5 bg-white hover:bg-emerald-50/50 border border-slate-200 rounded-xl flex flex-col items-start text-left transition shadow-2xs group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-2 group-hover:scale-105 transition">
            <PlusCircle className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-800">Add {userDepartment} Transaction</span>
          <span className="text-[11px] text-slate-500">Record Income / Expense</span>
        </button>

        <button
          onClick={() => setActiveTab('saf_students')}
          className="p-3.5 bg-white hover:bg-emerald-50/50 border border-slate-200 rounded-xl flex flex-col items-start text-left transition shadow-2xs group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-105 transition">
            <Receipt className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-800">{userDepartment} SAF Cash-In</span>
          <span className="text-[11px] text-slate-500">Debit SAF, Credit Cash</span>
        </button>

        <button
          onClick={() => setActiveTab('events_attendance')}
          className="p-3.5 bg-white hover:bg-emerald-50/50 border border-slate-200 rounded-xl flex flex-col items-start text-left transition shadow-2xs group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-2 group-hover:scale-105 transition">
            <UserCheck className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-800">Penalties & Attendance</span>
          <span className="text-[11px] text-slate-500">{userDepartment} Fines & Events</span>
        </button>
      </div>

      {/* Department Budget Breakdown (Filtered to User's Designated Department) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {isDepartmentRestricted ? `${scopedDepartmentInfo.name} (${userDepartment}) Budget Status` : 'Department Budgets - AY 2024-25'}
              </h3>
              {isDepartmentRestricted && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-800">
                  DESIGNATED VIEW
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {isDepartmentRestricted 
                ? `Authorized budget view for ${scopedDepartmentInfo.name} (${userDepartment})` 
                : 'Allocated vs Spent vs Remaining & ML Forecast'}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('forecast')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            View AI Forecast Analysis <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3.5">
          {scopedDepartmentList.map((dept) => (
            <div 
              key={dept.code}
              className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/40 hover:bg-slate-50 transition space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${dept.badgeBg}`}>
                    {dept.code}
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{dept.name}</h4>
                    <p className="text-[11px] text-slate-400">Department Budget • {activeSemester.school_year_label}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs font-black bg-slate-100 text-slate-800 rounded-lg border border-slate-200">
                    {dept.usedPercentage}% USED
                  </span>
                </div>
              </div>

              {/* Progress Bar with department theme color */}
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500 shadow-xs"
                  style={{ 
                    width: `${Math.min(100, dept.usedPercentage)}%`,
                    backgroundColor: dept.color
                  }}
                ></div>
              </div>

              {/* Stats Columns matching PDF page 6 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ALLOCATED</span>
                  <p className="font-black text-sm text-slate-900">₱{(dept.allocated / 1000).toFixed(1)}k</p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SPENT</span>
                  <p className="font-black text-sm text-slate-900">₱{(dept.spent / 1000).toFixed(1)}k</p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">REMAINING</span>
                  <p className="font-black text-sm text-emerald-700">₱{(dept.remaining / 1000).toFixed(1)}k</p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">AI FORECAST</span>
                  <p className="font-black text-sm text-purple-700">₱{(dept.forecast / 1000).toFixed(1)}k</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Proposals Stage Monitor (Filtered to User's Designated Department) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Active {userDepartment} Budget Proposals
            </h3>
            <p className="text-xs text-slate-500">Live Stage & Sign-off Tracking ({scopedProposals.length} total for {userDepartment})</p>
          </div>
          <button
            onClick={() => setActiveTab('budget')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            Manage Proposals <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {scopedProposals.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs text-slate-500">No active budget proposals drafted yet for {userDepartment}.</p>
            <button
              onClick={onOpenCreateProposal}
              className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              + Create first {userDepartment} proposal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {scopedProposals.slice(0, 3).map((prop) => (
              <div 
                key={prop.id}
                onClick={() => setActiveTab('budget')}
                className="p-4 rounded-xl border border-slate-200 hover:border-emerald-400 bg-slate-50/40 hover:bg-emerald-50/20 transition cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-900">
                      {prop.department}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      prop.budget_status === 'APPROVED_RELEASED' ? 'bg-emerald-100 text-emerald-800' :
                      prop.budget_status === 'COUNCIL_VOTING' ? 'bg-blue-100 text-blue-800' :
                      prop.budget_status === 'CSC_ADVISER_APPROVAL' ? 'bg-purple-100 text-purple-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {prop.budget_status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{prop.budget_title}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">{prop.budget_description}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                  <span className="text-slate-500">Total Requested:</span>
                  <span className="font-black text-slate-900">₱{prop.total_budget_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
