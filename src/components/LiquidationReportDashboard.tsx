import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { DEPARTMENTS } from '../data/mockData';
import { BudgetProposal, DepartmentCode } from '../types';
import { downloadCsv } from '../utils/csvExport';
import { canPrepareLiquidation } from '../utils/liquidation';
import { isAuditor } from '../utils/budgetRequest';
import { formatDateTime } from '../utils/roleLabels';
import {
  Wallet,
  Receipt,
  ArrowDownLeft,
  ClipboardCheck,
  Search,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  PieChart,
  ShieldCheck,
  Plus,
  X,
  XCircle
} from 'lucide-react';

type LiquidationStatusFilter = 'ALL' | 'MY_ACTION' | 'WAITING' | 'AWAITING_LIQUIDATION' | 'UNDER_REVIEW' | 'PENDING_RETURN' | 'RETURNED';

interface LiquidationRow {
  proposal: BudgetProposal;
  totalReleased: number;
  totalSpent: number;
  balance: number;
  hasLiquidation: boolean;
  hasReturn: boolean;
  statusFilter: Exclude<LiquidationStatusFilter, 'ALL' | 'MY_ACTION' | 'WAITING'>;
}

interface LiquidationReportDashboardProps {
  onOpenLiquidationModal: (proposalId: string) => void;
}

const peso = (n: number) =>
  `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const LiquidationReportDashboard: React.FC<LiquidationReportDashboardProps> = ({
  onOpenLiquidationModal
}) => {
  const {
    scopedProposals,
    isDepartmentRestricted,
    userDepartment,
    scopedDepartmentInfo,
    activeSemester,
    currentUser
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<LiquidationStatusFilter>('ALL');
  const [deptFilter, setDeptFilter] = useState<DepartmentCode | 'ALL'>(() =>
    isDepartmentRestricted ? userDepartment : 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pickerOpen, setPickerOpen] = useState(false);

  // Only proposals that have reached fund release are relevant to liquidation & return
  const releasedProposals = useMemo(
    () => scopedProposals.filter(p => p.budget_status === 'APPROVED_RELEASED'),
    [scopedProposals]
  );

  const rows: LiquidationRow[] = useMemo(() => {
    return releasedProposals.map(p => {
      const totalReleased = p.cashouts.reduce((s, c) => s + c.amount_released, 0) || p.total_budget_amount;
      const liq = p.liquidation;
      // Once a liquidation report exists, "spent" is what the Treasurer liquidated in it;
      // before that, it's the expenses recorded against the budget.
      const totalSpent = liq
        ? liq.accounting_summary.reduce((s, l) => s + l.spent, 0)
        : p.expenses.reduce((s, e) => s + e.amount_spent, 0);
      const balance = Math.max(0, totalReleased - totalSpent);
      const hasLiquidation = Boolean(liq);
      const hasReturn = Boolean(p.budget_return);

      // Follows the actual liquidation status: only an Audited report moves on to fund return.
      const statusForFilter: Exclude<LiquidationStatusFilter, 'ALL' | 'MY_ACTION' | 'WAITING'> =
        hasReturn ? 'RETURNED'
        : !liq || liq.status === 'FOR_REVISION' ? 'AWAITING_LIQUIDATION'
        : liq.status === 'Audited' ? (balance > 0 ? 'PENDING_RETURN' : 'RETURNED')
        : 'UNDER_REVIEW';

      return { proposal: p, totalReleased, totalSpent, balance, hasLiquidation, hasReturn, statusFilter: statusForFilter };
    });
  }, [releasedProposals]);

  // Summary totals across the department-scoped set (before status/search filters)
  const summary = useMemo(() => {
    const totalReleased = rows.reduce((s, r) => s + r.totalReleased, 0);
    const totalSpent = rows.reduce((s, r) => s + r.totalSpent, 0);
    const totalReturned = rows.reduce((s, r) => s + (r.proposal.budget_return?.amount_returned || 0), 0);
    const awaitingLiquidation = rows.filter(r => r.statusFilter === 'AWAITING_LIQUIDATION').length;
    const pendingReturn = rows.filter(r => r.statusFilter === 'PENDING_RETURN');
    const pendingReturnAmount = pendingReturn.reduce((s, r) => s + r.balance, 0);
    return {
      totalReleased,
      totalSpent,
      totalReturned,
      awaitingLiquidation,
      pendingReturnCount: pendingReturn.length,
      pendingReturnAmount
    };
  }, [rows]);

  // Category spend from CERTIFIED liquidations only: reports the Adviser and
  // Dean have audited (status Audited, or Closed after the budget return).
  // Liquidations still under review are counted separately, not in the totals.
  const isCertified = (status?: string) => status === 'Audited' || status === 'Closed';
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { spent: number; budgets: Set<string> }> = {};
    rows.forEach(r => {
      const liq = r.proposal.liquidation;
      if (!liq || !isCertified(liq.status)) return;
      liq.accounting_summary.forEach(c => {
        if (!(c.spent > 0)) return;
        const entry = (map[c.category] ??= { spent: 0, budgets: new Set<string>() });
        entry.spent += c.spent;
        entry.budgets.add(r.proposal.id);
      });
    });
    return Object.entries(map)
      .map(([category, v]) => ({ category, spent: v.spent, budgets: v.budgets.size }))
      .sort((a, b) => b.spent - a.spent);
  }, [rows]);

  const certifiedTotal = categoryBreakdown.reduce((s, c) => s + c.spent, 0);
  const certifiedBudgets = rows.filter(r => isCertified(r.proposal.liquidation?.status)).length;
  const liquidationsInReview = rows.filter(r => r.proposal.liquidation && !isCertified(r.proposal.liquidation.status)).length;

  // What the CURRENT user has to do on a budget (null = nothing for them),
  // and whose turn it is otherwise. Rows that need this user come first.
  const statusLabel = (s?: string) => ({
    PENDING_AUDITOR: 'Pre-Audit: Auditor', PENDING_ADVISER: 'Under Review: Adviser', PENDING_DEAN: 'Under Review: Dean',
    FOR_REVISION: 'Returned for Revision', Audited: 'Audited', Rejected: 'Rejected', Closed: 'Closed'
  } as Record<string, string>)[s || ''] || s || '';
  const myAction = (r: LiquidationRow): string | null => {
    const liq = r.proposal.liquidation;
    const sameDept = !currentUser.department || currentUser.department === r.proposal.department;
    if (canPrepareLiquidation(r.proposal, currentUser)) {
      if (!liq) return 'Prepare liquidation';
      if (liq.status === 'FOR_REVISION') return 'Revise liquidation';
      if (r.statusFilter === 'PENDING_RETURN') return `Return ${peso(r.balance)}`;
    }
    if (liq?.status === 'PENDING_AUDITOR' && isAuditor(currentUser) && sameDept) return 'Pre-audit report';
    if (liq?.status === 'PENDING_ADVISER' && currentUser.role === 'csc_adviser' && sameDept) return 'Review report';
    if (liq?.status === 'PENDING_DEAN' && currentUser.role === 'dean' && sameDept) return 'Review and certify';
    return null;
  };
  const waitingOn = (r: LiquidationRow): string | null => {
    const liq = r.proposal.liquidation;
    if (r.statusFilter === 'RETURNED') return null;
    if (!liq || liq.status === 'FOR_REVISION') return `Waiting for ${r.proposal.created_by_officer || 'the Treasurer'}`;
    if (liq.status === 'PENDING_AUDITOR') return 'Waiting for the Auditor';
    if (liq.status === 'PENDING_ADVISER') return 'Waiting for the Adviser';
    if (liq.status === 'PENDING_DEAN') return 'Waiting for the Dean';
    if (r.statusFilter === 'PENDING_RETURN') return `Waiting for the return by ${r.proposal.created_by_officer || 'the Treasurer'}`;
    return null;
  };
  const myActionCount = rows.filter(r => myAction(r)).length;

  const filteredRows = rows.filter(r => {
    if (statusFilter === 'MY_ACTION') { if (!myAction(r)) return false; }
    else if (statusFilter === 'WAITING') { if (myAction(r) || r.statusFilter === 'RETURNED') return false; }
    else if (statusFilter !== 'ALL' && r.statusFilter !== statusFilter) return false;

    if (!isDepartmentRestricted && deptFilter !== 'ALL' && r.proposal.department !== deptFilter) return false;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchTitle = r.proposal.budget_title.toLowerCase().includes(q);
      const matchDept = r.proposal.department.toLowerCase().includes(q);
      if (!matchTitle && !matchDept) return false;
    }

    return true;
  });

  const getStatusBadge = (row: LiquidationRow) => {
    const liqStatus = row.proposal.liquidation?.status;
    switch (row.statusFilter) {
      case 'AWAITING_LIQUIDATION':
        return liqStatus === 'FOR_REVISION'
          ? { label: 'Returned for Revision', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: AlertCircle }
          : { label: 'Awaiting Liquidation', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock };
      case 'UNDER_REVIEW':
        return liqStatus === 'Rejected'
          ? { label: 'Liquidation Rejected', color: 'bg-rose-100 text-rose-800 border-rose-300', icon: XCircle }
          : { label: liqStatus === 'PENDING_DEAN' ? 'Under Review: Dean' : liqStatus === 'PENDING_AUDITOR' ? 'Pre-Audit: Auditor' : 'Under Review: Adviser', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: ShieldCheck };
      case 'PENDING_RETURN':
        return { label: 'Audited: Pending Fund Return', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: AlertCircle };
      case 'RETURNED':
        return { label: 'Fully Closed', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle2 };
    }
  };

  const waitingCount = rows.filter(r => !myAction(r) && r.statusFilter !== 'RETURNED').length;
  const closedCount = rows.filter(r => r.statusFilter === 'RETURNED').length;
  const statusPills: { id: LiquidationStatusFilter; label: string }[] = [
    { id: 'MY_ACTION', label: `Needs my action · ${myActionCount}` },
    { id: 'WAITING', label: `Waiting on others · ${waitingCount}` },
    { id: 'RETURNED', label: `Closed · ${closedCount}` },
    { id: 'ALL', label: `All · ${rows.length}` }
  ];

  // "+ New Liquidation Report": every approved budget, and whether this user can prepare its report now.
  const isOfficer = ['officer_treasurer', 'officer_governor', 'council_member'].includes(currentUser.role);
  const pickerRows = releasedProposals.map(p => {
    const liq = p.liquidation;
    const isPreparer = canPrepareLiquidation(p, currentUser);
    const open = !liq || liq.status === 'FOR_REVISION';
    return {
      proposal: p,
      canCreate: isPreparer && open,
      action: liq?.status === 'FOR_REVISION' ? 'Revise' : 'Create',
      reason: !open
        ? `Report already submitted (${liq!.status === 'PENDING_AUDITOR' ? 'Pre-Audit: Auditor' : liq!.status === 'PENDING_ADVISER' ? 'Under Review: Adviser' : liq!.status === 'PENDING_DEAN' ? 'Under Review: Dean' : liq!.status})`
        : !isPreparer
        ? `Only ${p.created_by_officer || 'the Treasurer who filed this request'} can prepare it`
        : ''
    };
  }).sort((a, b) => Number(b.canCreate) - Number(a.canCreate));
  const creatableCount = pickerRows.filter(r => r.canCreate).length;

  const exportCsv = () => {
    const header = [
      'Budget Title',
      'Department',
      'Total Released (PHP)',
      'Total Spent (PHP)',
      'Unspent Balance (PHP)',
      'Liquidation Status',
      'Submitted By',
      'Submitted Date',
      'Auditor Remarks',
      'Amount Returned (PHP)',
      'Date Returned',
      'Cash-in Reference'
    ];

    const dataRows = filteredRows.map(r => [
      r.proposal.budget_title,
      r.proposal.department,
      r.totalReleased.toFixed(2),
      r.totalSpent.toFixed(2),
      r.balance.toFixed(2),
      r.proposal.liquidation?.status || 'Not Submitted',
      r.proposal.liquidation?.submitted_by || 'N/A',
      r.proposal.liquidation?.submitted_date || 'N/A',
      r.proposal.liquidation?.auditor_remarks || r.proposal.liquidation?.notes || 'N/A',
      r.proposal.budget_return?.amount_returned.toFixed(2) || '0.00',
      r.proposal.budget_return?.date_returned || 'N/A',
      r.proposal.budget_return?.cash_in_reference || 'N/A'
    ]);

    downloadCsv(`NCF_Liquidation_Report_${activeSemester.school_year_label.replace(/\s+/g, '_')}.csv`, header, dataRows);
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Liquidation Report Dashboard</h2>
            {isDepartmentRestricted && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-800">
                {userDepartment} ONLY
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isDepartmentRestricted
              ? `Fund accountability audit trail for ${scopedDepartmentInfo.name} (${userDepartment}) • ${activeSemester.school_year_label}`
              : `Fund accountability audit trail across all departments • ${activeSemester.school_year_label}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportCsv}
            disabled={filteredRows.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-[#0B3D2E]/20 hover:bg-[#EEF4F0] disabled:bg-slate-50 disabled:text-slate-300 text-[#0B3D2E] transition cursor-pointer disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report (CSV)</span>
          </button>
          {isOfficer && (
            <button
              onClick={() => setPickerOpen(o => !o)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0B3D2E] hover:bg-[#072A20] text-white shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Liquidation Report{creatableCount > 0 ? ` (${creatableCount})` : ''}</span>
            </button>
          )}
        </div>
      </div>

      {/* Budget picker for a new liquidation report */}
      {isOfficer && pickerOpen && (
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">New Liquidation Report</h3>
              <p className="text-[11px] text-slate-500">Choose the approved budget to liquidate. Only the Treasurer who filed a budget request prepares its report.</p>
            </div>
            <button onClick={() => setPickerOpen(false)} className="text-slate-400 hover:text-[#072A20] cursor-pointer" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          {pickerRows.length === 0 ? (
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
              No approved budgets yet. A liquidation report can be prepared once a budget proposal is approved and its funds are released.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {pickerRows.map(r => (
                <div key={r.proposal.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      <span className={`mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-black border ${DEPARTMENTS[r.proposal.department]?.badgeBg || 'bg-slate-100'}`}>{r.proposal.department}</span>
                      {r.proposal.budget_title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {peso(r.proposal.total_budget_amount)} • {r.canCreate ? 'Ready to liquidate' : r.reason}
                    </p>
                  </div>
                  {r.canCreate ? (
                    <button
                      onClick={() => { setPickerOpen(false); onOpenLiquidationModal(r.proposal.id); }}
                      className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0B3D2E] hover:bg-[#072A20] text-white text-[11px] font-bold cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" /> {r.action} Report
                    </button>
                  ) : (
                    <button
                      onClick={() => { setPickerOpen(false); onOpenLiquidationModal(r.proposal.id); }}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-[#0B3D2E]/20 hover:bg-[#EEF4F0] text-[#0B3D2E] text-[11px] font-bold cursor-pointer"
                    >
                      View
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary Stat Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Wallet className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Funds Released</span>
          </div>
          <p className="text-lg font-black text-slate-900">{peso(summary.totalReleased)}</p>
          <p className="text-[11px] text-slate-400">{releasedProposals.length} approved proposal(s)</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Receipt className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Liquidated (Spent)</span>
          </div>
          <p className="text-lg font-black text-slate-900">{peso(summary.totalSpent)}</p>
          <p className="text-[11px] text-slate-400">
            {summary.totalReleased > 0 ? Math.round((summary.totalSpent / summary.totalReleased) * 100) : 0}% of released funds
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-emerald-600">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Returned to SAF</span>
          </div>
          <p className="text-lg font-black text-emerald-700">{peso(summary.totalReturned)}</p>
          <p className="text-[11px] text-slate-400">Cash-in double entries posted</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-amber-600">
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Needs Action</span>
          </div>
          <p className="text-lg font-black text-amber-700">
            {summary.awaitingLiquidation + summary.pendingReturnCount}
          </p>
          <p className="text-[11px] text-slate-400">
            {summary.awaitingLiquidation} to liquidate • {summary.pendingReturnCount} to return ({peso(summary.pendingReturnAmount)})
          </p>
        </div>
      </div>

      {/* Category Spend Breakdown: audited (certified) liquidations only */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#0B3D2E]" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Certified Spend by Category</h3>
              <p className="text-[11px] text-slate-500">
                From liquidation reports already audited by the Adviser and Dean
                {certifiedBudgets > 0 && ` • ${certifiedBudgets} budget${certifiedBudgets > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          {certifiedTotal > 0 && (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total certified spend</p>
              <p className="text-base font-black text-[#0B3D2E]">{peso(certifiedTotal)}</p>
            </div>
          )}
        </div>

        {categoryBreakdown.length === 0 ? (
          <p className="text-xs text-slate-500 bg-[#FBFAF4] border border-slate-200 rounded-xl p-3">
            No audited liquidation yet. Spending appears here once the Adviser and Dean audit a liquidation report.
          </p>
        ) : (
          <div className="space-y-3">
            {categoryBreakdown.map(c => {
              const share = certifiedTotal > 0 ? (c.spent / certifiedTotal) * 100 : 0;
              return (
                <div key={c.category} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-700">
                      {c.category}
                      <span className="ml-1.5 font-medium text-slate-400">
                        {c.budgets} budget{c.budgets > 1 ? 's' : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded-md bg-[#EEF4F0] text-[#0B3D2E] text-[10px] font-bold">{share.toFixed(0)}%</span>
                      <span className="font-bold text-slate-900">{peso(c.spent)}</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0B3D2E] rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(2, share)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {liquidationsInReview > 0 && (
          <p className="text-[11px] text-[#7A5A00] bg-[#FFF8E1] border border-[#F2B705]/40 rounded-lg px-3 py-2">
            {liquidationsInReview} liquidation report{liquidationsInReview > 1 ? 's are' : ' is'} still under review and not counted yet.
          </p>
        )}
      </div>

      {/* Status Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {statusPills.map(pill => (
          <button
            key={pill.id}
            onClick={() => setStatusFilter(pill.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs whitespace-nowrap cursor-pointer ${
              statusFilter === pill.id
                ? pill.id === 'MY_ACTION' ? 'bg-[#F2B705] text-[#0B3D2E] shadow-xs' : 'bg-[#0B3D2E] text-white shadow-xs'
                : pill.id === 'MY_ACTION' && myActionCount > 0
                ? 'bg-[#FFF8E1] hover:bg-[#FDEFC2] text-[#5C4300] border border-[#F2B705]'
                : 'bg-white hover:bg-[#EEF4F0] text-[#0B3D2E] border border-[#0B3D2E]/20'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Search & Department Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by proposal title or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-emerald-500"
          />
        </div>

        {isDepartmentRestricted ? (
          <div className="flex items-center gap-1.5 px-3 py-2 text-xs bg-blue-50 border border-blue-200 text-blue-900 rounded-xl font-bold">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            Dept: {userDepartment} - {scopedDepartmentInfo.name}
            <span className="text-[10px] bg-blue-200/80 text-blue-950 px-1.5 py-0.5 rounded font-black ml-1">LOCKED</span>
          </div>
        ) : (
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value as any)}
            className="px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 font-medium text-slate-700 focus:outline-emerald-500"
          >
            <option value="ALL">All 8 Departments</option>
            {Object.keys(DEPARTMENTS).map(code => (
              <option key={code} value={code}>{code} - {DEPARTMENTS[code as DepartmentCode].name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Liquidation Records: one row per budget, with the next step */}
      {filteredRows.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-2xl">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">
              {statusFilter === 'MY_ACTION' && releasedProposals.length > 0 ? 'Nothing needs your action' : 'No liquidation records found'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {releasedProposals.length === 0
                ? 'Fund accountability records appear here once a budget proposal is approved and released.'
                : statusFilter === 'MY_ACTION'
                ? 'You are all caught up. Budgets waiting on others are under "Waiting on others".'
                : 'No records match the current filters. Try clearing the search or status filter.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-[#EEF4F0] text-[#0B3D2E] text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Budget</th>
                  <th className="py-3 px-3 text-right w-[120px]">Released</th>
                  <th className="py-3 px-3 text-right w-[120px]">Liquidated</th>
                  <th className="py-3 px-3 text-right w-[120px]">Balance</th>
                  <th className="py-3 px-3 text-right w-[120px]">Returned</th>
                  <th className="py-3 px-4 text-right w-[260px]">Next step</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...filteredRows].sort((a, b) => Number(Boolean(myAction(b))) - Number(Boolean(myAction(a)))).map((r) => {
                  const liq = r.proposal.liquidation;
                  const ret = r.proposal.budget_return;
                  const action = myAction(r);
                  const waiting = action ? null : waitingOn(r);
                  const closed = r.statusFilter === 'RETURNED';
                  const context = closed
                    ? `Closed${ret?.date_returned ? ` ${ret.date_returned}` : ''}`
                    : !liq
                    ? `Released ${formatDateTime(r.proposal.updated_at)} • Not liquidated yet`
                    : liq.status === 'Audited'
                    ? 'Audited by the Adviser and the Dean'
                    : `${statusLabel(liq.status)} • Submitted ${liq.submitted_date}`;
                  const remarks = liq?.status === 'FOR_REVISION' ? (liq.auditor_remarks || liq.adviser_remarks || liq.dean_remarks) : null;
                  const dash = <span className="text-slate-300">—</span>;
                  return (
                    <tr
                      key={r.proposal.id}
                      className={`align-middle transition ${action ? 'bg-[#FFFBEA] hover:bg-[#FFF6D6]' : 'hover:bg-[#FBFAF4]'} ${closed ? 'text-slate-500' : ''}`}
                    >
                      <td className={`py-3.5 px-4 border-l-4 ${action ? 'border-[#F2B705]' : 'border-transparent'}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {!isDepartmentRestricted && (
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black border ${DEPARTMENTS[r.proposal.department]?.badgeBg || 'bg-slate-100 text-slate-800'}`}>
                              {r.proposal.department}
                            </span>
                          )}
                          <span className={`font-bold text-sm truncate ${closed ? 'text-slate-600' : 'text-slate-900'}`} title={r.proposal.budget_title}>
                            {r.proposal.budget_title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{context}</p>
                        {remarks && <p className="text-[11px] text-red-700 mt-0.5 truncate" title={remarks}>Correction needed: {remarks}</p>}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold whitespace-nowrap">{peso(r.totalReleased)}</td>
                      <td className="py-3.5 px-3 text-right font-mono whitespace-nowrap">{r.hasLiquidation ? peso(r.totalSpent) : dash}</td>
                      <td className={`py-3.5 px-3 text-right font-mono whitespace-nowrap ${!closed && r.hasLiquidation && r.balance > 0 ? 'font-bold text-amber-700' : ''}`}>
                        {closed ? peso(0) : r.hasLiquidation ? peso(r.balance) : dash}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono whitespace-nowrap">
                        {ret ? <span className="font-bold text-[#0B3D2E]">{peso(ret.amount_returned)}</span> : dash}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-2">
                          {action ? (
                            <button
                              onClick={() => onOpenLiquidationModal(r.proposal.id)}
                              className="px-3.5 py-2 rounded-xl bg-[#0B3D2E] hover:bg-[#072A20] text-white text-[11px] font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
                            >
                              {action}
                            </button>
                          ) : (
                            <>
                              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${closed ? 'text-[#0B3D2E]' : 'text-slate-600'}`}>
                                <span className={`w-2 h-2 rounded-full ${closed ? 'bg-[#0B3D2E]' : 'bg-[#F2B705]'}`} />
                                {closed ? 'Closed' : waiting}
                              </span>
                              <button
                                onClick={() => onOpenLiquidationModal(r.proposal.id)}
                                className="px-2.5 py-1 rounded-lg bg-white border border-[#0B3D2E]/20 hover:bg-[#EEF4F0] text-[#0B3D2E] text-[11px] font-bold transition cursor-pointer"
                              >
                                View
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
