import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  TransactionCategory, 
  DepartmentTransaction, 
  DepartmentCode 
} from '../types';
import { DEPARTMENTS } from '../data/mockData';
import { csvEscape, downloadCsv } from '../utils/csvExport';
import {
  Plus,
  Download,
  Edit3,
  Trash2,
  Archive,
  RotateCcw,
  FileText,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';

interface TransactionsViewProps {
  onOpenAddModal: () => void;
}

// Dean/Adviser's Transactions screen ("CCS Transactions") is view-only per
// spec Section 5 — no approve/reject there. Admin no longer has a
// Transactions tab in its nav at all, but is left here for completeness.
// Dean / CSC Adviser approve their department's Pending transactions (Admin has no Transactions tab).
const REVIEWER_ROLES = ['dean', 'csc_adviser', 'admin', 'super_admin'];

export const TransactionsView: React.FC<TransactionsViewProps> = ({ onOpenAddModal }) => {
  const {
    proposals,
    transactions,
    scopedTransactions,
    toggleArchiveTransaction,
    deleteTransaction,
    reviewTransaction,
    activeSemester,
    userDepartment,
    isDepartmentRestricted,
    scopedDepartmentInfo,
    currentUser,
    isReadOnlyStudent,
    isViewOnlyReviewer
  } = useApp();

  const canReview = REVIEWER_ROLES.includes(currentUser.role);
  // Dean/Adviser see this screen as "CCS Transactions" — view-only, no
  // add/archive/delete (Section 5).
  const hideWriteActions = isReadOnlyStudent || isViewOnlyReviewer;
  // Transactions are the financial record: only the Admin / Super Admin may
  // delete one. Officers can Archive (reversible) instead.
  const canDelete = currentUser.role === 'admin' || currentUser.role === 'super_admin';

  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory>('All');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<DepartmentCode | 'ALL'>(() => {
    return isDepartmentRestricted ? userDepartment : 'ALL';
  });

  const categories: TransactionCategory[] = ['All', 'Revenue', 'Event', 'Capital'];

  // Base list respects department isolation
  const baseTransactions = isDepartmentRestricted ? scopedTransactions : transactions;

  // Filter transactions
  const filteredTransactions = baseTransactions.filter(tx => {
    if (showArchived) {
      if (!tx.is_archived) return false;
    } else {
      if (tx.is_archived) return false;
    }

    if (selectedCategory !== 'All' && tx.category !== selectedCategory) {
      return false;
    }

    if (!isDepartmentRestricted && selectedDeptFilter !== 'ALL' && tx.department !== selectedDeptFilter) {
      return false;
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchTitle = tx.title.toLowerCase().includes(q);
      const matchDept = tx.department.toLowerCase().includes(q);
      const matchRef = tx.reference_code.toLowerCase().includes(q);
      if (!matchTitle && !matchDept && !matchRef) return false;
    }

    return true;
  });

  // Section 1h: bulk "Export Report (CSV)" over the currently filtered list
  // — separate from the single-receipt export below, which stays per-row.
  const exportFilteredCsv = () => {
    const header = ['Reference Code', 'Date', 'Department', 'Category', 'Title', 'Type', 'Amount (PHP)', 'Status', 'Notes'];
    const dataRows = filteredTransactions.map(tx => [
      tx.reference_code, tx.date, tx.department, tx.category, tx.title, tx.type,
      tx.amount.toFixed(2), tx.status, tx.description || 'N/A'
    ]);
    downloadCsv(`NCF_Transactions_${activeSemester.school_year_label.replace(/\s+/g, '_')}.csv`, header, dataRows);
  };

  const exportSingleTransactionReceipt = (tx: DepartmentTransaction) => {
    // Build the receipt as a clean, spreadsheet-style CSV (opens directly in
    // Excel / Google Sheets as neat rows & columns) instead of a plain text block.
    const rows: (string | number)[][] = [
      ['NAGA COLLEGE FOUNDATION (NCF)'],
      ['STUDENT COUNCIL & SAF TREASURY OFFICIAL RECEIPT'],
      [],
      ['Field', 'Value'],
      ['Reference Code', tx.reference_code],
      ['Date', tx.date],
      ['School Year', activeSemester.school_year_label],
      ['Semester', activeSemester.semester_name],
      ['Department', `${tx.department} - ${DEPARTMENTS[tx.department]?.name || ''}`],
      ['Category', tx.category],
      ['Transaction Title', tx.title],
      ['Transaction Type', tx.type],
      ['Amount (PHP)', tx.amount.toFixed(2)],
      ['Status', tx.status],
      ['Notes', tx.description || 'N/A'],
      [],
      ['Recorded in', 'NCF PREDICT Double-Entry Ledger System'],
      ['Verified by', 'College Student Council Treasury'],
      ['Generated on', new Date().toLocaleString()]
    ];

    const csvContent = rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
    // Prefix with a UTF-8 BOM so Excel renders ₱ / special characters correctly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NCF_Receipt_${tx.reference_code}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Top Header Controls matching PDF screenshots */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            {showArchived ? 'Archived Transactions' : 'Department Transactions'}
          </h2>
          <p className="text-xs text-slate-500">
            {showArchived 
              ? `${filteredTransactions.length} Archived Records` 
              : `SAF Collections, Budget Releases, & Operational Disbursals (${activeSemester.school_year_label})`}
          </p>
        </div>

        {/* Toggle Archive & Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add Transaction sits up here so it is easy to find. */}
          {!hideWriteActions && (
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-extrabold bg-[#0B3D2E] hover:bg-[#072A20] text-white shadow-md ring-2 ring-emerald-200 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Transaction</span>
            </button>
          )}
          <button
            onClick={exportFilteredCsv}
            disabled={filteredTransactions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-[#EEF4F0] border border-[#0B3D2E]/20 disabled:text-slate-300 text-[#0B3D2E] shadow-2xs transition cursor-pointer disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report (CSV)</span>
          </button>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
              showArchived
                ? 'bg-[#0B3D2E] text-white border-slate-800'
                : 'bg-slate-100 hover:bg-[#EEF4F0] text-[#0B3D2E] border-[#0B3D2E]/20'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{showArchived ? 'Active Records' : 'Archive'}</span>
          </button>
        </div>
      </div>

      {/* Category Pills (Matching PDF Page 7, 12, 13, 14, 15, 16) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs whitespace-nowrap cursor-pointer ${
              selectedCategory === cat
                ? 'bg-[#0B3D2E] text-white shadow-xs'
                : 'bg-white hover:bg-[#EEF4F0] text-[#0B3D2E] border border-[#0B3D2E]/20'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search & Department Quick Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by title, department code, or ref..."
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
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value as any)}
            className="px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 font-medium text-slate-700 focus:outline-emerald-500"
          >
            <option value="ALL">All 8 Departments</option>
            {Object.keys(DEPARTMENTS).map(code => (
              <option key={code} value={code}>{code} - {DEPARTMENTS[code as DepartmentCode].name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Transaction List Cards (Matching exact design in PDF screenshots) */}
      {filteredTransactions.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-2xl">
            📋
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">No transaction</h3>
            <p className="text-xs text-slate-500 mt-1">
              {hideWriteActions ? 'Nothing recorded yet for your department.' : 'Tap + to create a budget entry or transaction'}
            </p>
          </div>
          {!hideWriteActions && (
            <button
              onClick={onOpenAddModal}
              className="px-4 py-2 bg-[#0B3D2E] hover:bg-[#072A20] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              + Add Transaction
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="bg-[#EEF4F0] text-[#0B3D2E] text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-[96px]">Date</th>
                  <th className="py-3 px-3 w-[150px]">Reference</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3 w-[96px]">Category</th>
                  <th className="py-3 px-3 w-[110px]">Status</th>
                  <th className="py-3 px-3 w-[140px] text-right">Amount</th>
                  <th className="py-3 px-4 w-[1%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((tx) => {
                  const budgetTitle = tx.proposal_id
                    ? proposals.find(p => p.id === tx.proposal_id)?.budget_title || 'Approved budget'
                    : null;
                  const isIncome = tx.type === 'INCOME';
                  return (
                    <tr key={tx.id} className="hover:bg-[#FBFAF4] transition align-middle">
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{tx.date}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">{tx.reference_code}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {!isDepartmentRestricted && (
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black border ${DEPARTMENTS[tx.department]?.badgeBg || 'bg-slate-100 text-slate-800'}`}>
                              {tx.department}
                            </span>
                          )}
                          <span className="font-semibold text-slate-900 truncate" title={tx.title}>{tx.title}</span>
                        </div>
                        {budgetTitle && (
                          <p className="text-[10px] text-[#0B3D2E]/80 mt-0.5 truncate" title={budgetTitle}>Budget: {budgetTitle}</p>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{tx.category}</span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {tx.status === 'Pending' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF8E1] border border-[#F2B705]/50 text-[#7A5A00]">
                            <Clock className="w-2.5 h-2.5" /> Pending
                          </span>
                        ) : tx.status === 'Rejected' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">
                            <XCircle className="w-2.5 h-2.5" /> Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EEF4F0] border border-[#0B3D2E]/15 text-[#0B3D2E]">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Completed
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span className={`font-mono text-sm font-bold ${isIncome ? 'text-[#0B3D2E]' : 'text-red-700'}`}>
                          {isIncome ? '+' : '−'}₱{tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider">{isIncome ? 'Income' : 'Expense'}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {canReview && tx.status === 'Pending' && (
                            <>
                              <button
                                onClick={() => reviewTransaction(tx.id, 'Completed')}
                                className="flex items-center gap-1 px-2 h-7 rounded-lg bg-[#0B3D2E] hover:bg-[#072A20] text-white text-[11px] font-bold transition cursor-pointer"
                                title="Approve transaction"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => reviewTransaction(tx.id, 'Rejected')}
                                className="flex items-center gap-1 px-2 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold transition cursor-pointer"
                                title="Reject transaction"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => exportSingleTransactionReceipt(tx)}
                            className="w-7 h-7 rounded-lg bg-white border border-[#0B3D2E]/20 hover:bg-[#EEF4F0] text-[#0B3D2E] flex items-center justify-center transition cursor-pointer"
                            title="Download Official Receipt (Spreadsheet / CSV)"
                            aria-label="Download receipt"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {!hideWriteActions && (
                            <>
                              <button
                                onClick={() => toggleArchiveTransaction(tx.id)}
                                className="w-7 h-7 rounded-lg bg-white border border-[#0B3D2E]/20 hover:bg-[#EEF4F0] text-[#0B3D2E] flex items-center justify-center transition cursor-pointer"
                                title={tx.is_archived ? 'Restore transaction' : 'Archive transaction'}
                                aria-label={tx.is_archived ? 'Restore transaction' : 'Archive transaction'}
                              >
                                {tx.is_archived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                              </button>
                              {canDelete && (
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Delete "${tx.title}" permanently? This changes the department's funds and cannot be undone.`)) deleteTransaction(tx.id);
                                  }}
                                  className="w-7 h-7 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-600 flex items-center justify-center transition cursor-pointer"
                                  title="Delete record"
                                  aria-label="Delete record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
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
