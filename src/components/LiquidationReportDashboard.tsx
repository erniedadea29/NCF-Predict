import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { DEPARTMENTS } from '../data/mockData';
import { BudgetProposal, DepartmentCode } from '../types';
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
  ShieldCheck
} from 'lucide-react';

type LiquidationStatusFilter = 'ALL' | 'AWAITING_LIQUIDATION' | 'PENDING_RETURN' | 'RETURNED';

interface LiquidationRow {
  proposal: BudgetProposal;
  totalReleased: number;
  totalSpent: number;
  balance: number;
  hasLiquidation: boolean;
  hasReturn: boolean;
  statusFilter: Exclude<LiquidationStatusFilter, 'ALL'>;
}

interface LiquidationReportDashboardProps {
  onOpenLiquidationModal: (proposalId: string) => void;
}

const peso = (n: number) =>
  `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Escapes a value for safe CSV placement (mirrors TransactionsView's exporter)
const csvEscape = (val: string | number) => {
  const s = String(val ?? '');
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

export const LiquidationReportDashboard: React.FC<LiquidationReportDashboardProps> = ({
  onOpenLiquidationModal
}) => {
  const {
    scopedProposals,
    isDepartmentRestricted,
    userDepartment,
    scopedDepartmentInfo,
    activeSemester
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<LiquidationStatusFilter>('ALL');
  const [deptFilter, setDeptFilter] = useState<DepartmentCode | 'ALL'>(() =>
    isDepartmentRestricted ? userDepartment : 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Only proposals that have reached fund release are relevant to liquidation & return
  const releasedProposals = useMemo(
    () => scopedProposals.filter(p => p.budget_status === 'APPROVED_RELEASED'),
    [scopedProposals]
  );

  const rows: LiquidationRow[] = useMemo(() => {
    return releasedProposals.map(p => {
      const totalReleased = p.cashouts.reduce((s, c) => s + c.amount_released, 0) || p.total_budget_amount;
      const totalSpent = p.expenses.reduce((s, e) => s + e.amount_spent, 0);
      const balance = Math.max(0, totalReleased - totalSpent);
      const hasLiquidation = Boolean(p.liquidation);
      const hasReturn = Boolean(p.budget_return);

      const statusForFilter: Exclude<LiquidationStatusFilter, 'ALL'> = hasReturn
        ? 'RETURNED'
        : hasLiquidation
        ? 'PENDING_RETURN'
        : 'AWAITING_LIQUIDATION';

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

  // Category spend breakdown aggregated from every certified liquidation on record
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach(r => {
      r.proposal.liquidation?.accounting_summary.forEach(c => {
        map[c.category] = (map[c.category] || 0) + c.spent;
      });
    });
    return Object.entries(map)
      .map(([category, spent]) => ({ category, spent }))
      .sort((a, b) => b.spent - a.spent);
  }, [rows]);

  const maxCategorySpend = categoryBreakdown[0]?.spent || 1;

  const filteredRows = rows.filter(r => {
    if (statusFilter !== 'ALL' && r.statusFilter !== statusFilter) return false;

    if (!isDepartmentRestricted && deptFilter !== 'ALL' && r.proposal.department !== deptFilter) return false;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchTitle = r.proposal.budget_title.toLowerCase().includes(q);
      const matchDept = r.proposal.department.toLowerCase().includes(q);
      if (!matchTitle && !matchDept) return false;
    }

    return true;
  });

  const getStatusBadge = (status: Exclude<LiquidationStatusFilter, 'ALL'>) => {
    switch (status) {
      case 'AWAITING_LIQUIDATION':
        return { label: 'Awaiting Liquidation', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock };
      case 'PENDING_RETURN':
        return { label: 'Pending Fund Return', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: AlertCircle };
      case 'RETURNED':
        return { label: 'Fully Closed & Returned', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle2 };
    }
  };

  const statusPills: { id: LiquidationStatusFilter; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'AWAITING_LIQUIDATION', label: 'Awaiting Liquidation' },
    { id: 'PENDING_RETURN', label: 'Pending Fund Return' },
    { id: 'RETURNED', label: 'Fully Closed' }
  ];

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

    const rowsOut = [header, ...dataRows];
    const csvContent = rowsOut.map(row => row.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NCF_Liquidation_Report_${activeSemester.school_year_label.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

        <button
          onClick={exportCsv}
          disabled={filteredRows.length === 0}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#00873E] hover:bg-[#007033] disabled:bg-slate-300 text-white shadow-xs transition cursor-pointer disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Report (CSV)</span>
        </button>
      </div>

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

      {/* Category Spend Breakdown */}
      {categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <PieChart className="w-4 h-4 text-slate-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Certified Spend by Category</h3>
              <p className="text-[11px] text-slate-500">Aggregated from all audited liquidation records</p>
            </div>
          </div>

          <div className="space-y-3">
            {categoryBreakdown.map(c => (
              <div key={c.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{c.category}</span>
                  <span className="font-bold text-slate-900">{peso(c.spent)}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#00873E] rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(4, Math.round((c.spent / maxCategorySpend) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {statusPills.map(pill => (
          <button
            key={pill.id}
            onClick={() => setStatusFilter(pill.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs whitespace-nowrap cursor-pointer ${
              statusFilter === pill.id
                ? 'bg-[#00873E] text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
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

      {/* Liquidation Records List */}
      {filteredRows.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-2xl">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">No liquidation records found</h3>
            <p className="text-xs text-slate-500 mt-1">
              {releasedProposals.length === 0
                ? 'Fund accountability records appear here once a budget proposal is approved and released.'
                : 'No records match the current filters. Try clearing the search or status filter.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((r) => {
            const deptInfo = DEPARTMENTS[r.proposal.department];
            const badge = getStatusBadge(r.statusFilter);
            const StatusIcon = badge.icon;
            const liq = r.proposal.liquidation;
            const ret = r.proposal.budget_return;

            return (
              <div
                key={r.proposal.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition relative overflow-hidden space-y-3"
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: deptInfo?.color || '#00873E' }}
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pl-2">
                  <div className="flex items-center gap-3">
                    <div className={`px-2.5 py-1.5 rounded-lg text-xs font-black border ${deptInfo?.badgeBg || 'bg-slate-100 text-slate-800'}`}>
                      {r.proposal.department}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{r.proposal.budget_title}</h4>
                      <p className="text-[11px] text-slate-400">Fund released {r.proposal.updated_at}</p>
                    </div>
                  </div>

                  <span className={`inline-flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 rounded-lg text-[11px] font-bold border ${badge.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {badge.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Released</span>
                    <p className="font-black text-sm text-slate-900">{peso(r.totalReleased)}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Spent</span>
                    <p className="font-black text-sm text-slate-900">{peso(r.totalSpent)}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Balance</span>
                    <p className={`font-black text-sm ${r.balance > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{peso(r.balance)}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Returned</span>
                    <p className="font-black text-sm text-emerald-700">{peso(ret?.amount_returned || 0)}</p>
                  </div>
                </div>

                {(liq?.auditor_remarks || liq?.notes || ret?.remarks) && (
                  <p className="pl-2 text-[11px] text-slate-500 italic">
                    {liq?.auditor_remarks || liq?.notes || ret?.remarks}
                  </p>
                )}

                <div className="flex items-center justify-between pl-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    {liq ? `Submitted by ${liq.submitted_by} on ${liq.submitted_date}` : 'No liquidation submitted yet'}
                    {ret ? ` • Returned ${ret.date_returned} (Ref: ${ret.cash_in_reference})` : ''}
                  </span>

                  {r.statusFilter !== 'RETURNED' && (
                    <button
                      onClick={() => onOpenLiquidationModal(r.proposal.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {r.statusFilter === 'AWAITING_LIQUIDATION' ? 'Audit Liquidation' : 'Process Fund Return'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
