import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  TransactionCategory, 
  DepartmentTransaction, 
  DepartmentCode 
} from '../types';
import { DEPARTMENTS } from '../data/mockData';
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

const REVIEWER_ROLES = ['admin', 'csc_adviser', 'dean'];

export const TransactionsView: React.FC<TransactionsViewProps> = ({ onOpenAddModal }) => {
  const {
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
    isReadOnlyStudent
  } = useApp();

  const canReview = REVIEWER_ROLES.includes(currentUser.role);

  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory>('All');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<DepartmentCode | 'ALL'>(() => {
    return isDepartmentRestricted ? userDepartment : 'ALL';
  });

  const categories: TransactionCategory[] = ['All', 'Revenue', 'Event', 'Capital', 'Operations', 'Academic'];

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

  // Escapes a value for safe CSV placement (wraps in quotes, doubles inner quotes)
  const csvEscape = (val: string | number) => {
    const s = String(val ?? '');
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
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
      ['Verified by', 'Supreme Student Council Treasury'],
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
              showArchived 
                ? 'bg-slate-800 text-white border-slate-800' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
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
                ? 'bg-[#00873E] text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
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
              {isReadOnlyStudent ? 'Nothing recorded yet for your department.' : 'Tap + to create a budget entry or transaction'}
            </p>
          </div>
          {!isReadOnlyStudent && (
            <button
              onClick={onOpenAddModal}
              className="px-4 py-2 bg-[#00873E] hover:bg-[#007033] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              + Add Transaction
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map((tx) => {
            const deptInfo = DEPARTMENTS[tx.department];
            return (
              <div
                key={tx.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden"
              >
                {/* Left vertical colored bar matching PDF screenshots */}
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: deptInfo?.color || '#00873E' }}
                />

                <div className="flex items-center gap-3 pl-2">
                  {/* Department Badge */}
                  <div className={`px-2.5 py-1.5 rounded-lg text-xs font-black border ${deptInfo?.badgeBg || 'bg-slate-100 text-slate-800'}`}>
                    {tx.department}
                  </div>

                  {/* Title & Metadata */}
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{tx.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {tx.category}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {tx.date}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                        • {tx.reference_code}
                      </span>
                      {tx.status === 'Pending' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> Pending Review
                        </span>
                      )}
                      {tx.status === 'Rejected' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 flex items-center gap-1">
                          <XCircle className="w-2.5 h-2.5" /> Rejected
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action Icons (Matching PDF: Download icon button & Edit/Trash) */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-right mr-2">
                    <span className={`text-sm font-black ${tx.type === 'INCOME' ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}₱{tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">{tx.type}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Approve / Reject — only for the reviewer roles, only on Pending rows */}
                    {canReview && tx.status === 'Pending' && (
                      <>
                        <button
                          onClick={() => reviewTransaction(tx.id, 'Completed')}
                          className="flex items-center gap-1 px-2.5 h-8 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold transition cursor-pointer"
                          title="Approve transaction"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => reviewTransaction(tx.id, 'Rejected')}
                          className="flex items-center gap-1 px-2.5 h-8 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-[11px] font-bold transition cursor-pointer"
                          title="Reject transaction"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}

                    {/* Download Receipt/Voucher */}
                    <button
                      onClick={() => exportSingleTransactionReceipt(tx)}
                      className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer"
                      title="Download Official Receipt (Spreadsheet / CSV)"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {!isReadOnlyStudent && (
                      <>
                        {/* Archive / Restore Button */}
                        <button
                          onClick={() => toggleArchiveTransaction(tx.id)}
                          className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer"
                          title={tx.is_archived ? 'Restore transaction' : 'Archive transaction'}
                        >
                          {tx.is_archived ? <RotateCcw className="w-4 h-4 text-emerald-600" /> : <Archive className="w-4 h-4" />}
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => deleteTransaction(tx.id)}
                          className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                          title="Delete record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating / Bottom Sticky Action Button matching PDF screenshots */}
      {!isReadOnlyStudent && (
        <div className="fixed bottom-6 right-6 z-30">
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#00873E] hover:bg-[#007033] text-white font-bold text-sm shadow-xl transition transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Transaction</span>
          </button>
        </div>
      )}
    </div>
  );
};
