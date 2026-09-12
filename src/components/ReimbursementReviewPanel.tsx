import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DEPARTMENTS } from '../data/mockData';
import { downloadCsv } from '../utils/csvExport';
import { Receipt, CheckCircle2, XCircle, Clock, ShieldCheck, Download } from 'lucide-react';

// Dean/Adviser's course-scoped Budget tab is Reimbursement-only per spec —
// no "Draft CCS Proposal" / general Budget & Proposals sections here, just
// a review queue over the reimbursement requests already raised by Officers
// against their department's approved-and-released proposals.
export const ReimbursementReviewPanel: React.FC = () => {
  const { scopedProposals, proposals, isDepartmentRestricted, userDepartment, approveReimbursement, currentUser } = useApp();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectRemark, setRejectRemark] = useState('');

  const displayProposals = isDepartmentRestricted ? scopedProposals : proposals;

  const handleReject = (id: string) => {
    approveReimbursement(id, 'Rejected', rejectRemark.trim() || 'Rejected — see officer for details.');
    setRejectingId(null);
    setRejectRemark('');
  };

  const rows = displayProposals.flatMap(p =>
    p.reimbursements.map(r => ({ ...r, budget_title: p.budget_title, department: p.department }))
  ).sort((a, b) => (a.reimbursement_status === 'Pending' ? -1 : 1));

  const pendingCount = rows.filter(r => r.reimbursement_status === 'Pending').length;

  // Section 1h: bulk "Export Report (CSV)" over the currently visible reimbursement rows.
  const exportReimbursementsCsv = () => {
    const header = ['Budget Title', 'Department', 'Officer', 'Receipt Ref', 'Date Submitted', 'Amount (PHP)', 'Status', 'Remarks'];
    const dataRows = rows.map(r => [
      r.budget_title, r.department, r.officer_name, r.receipt_ref || 'N/A', r.date_submitted,
      r.amount_spent.toFixed(2), r.reimbursement_status, r.remarks || ''
    ]);
    downloadCsv('NCF_Reimbursements.csv', header, dataRows);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            Reimbursement Review
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isDepartmentRestricted ? `${userDepartment} reimbursement requests` : 'All reimbursement requests'} — {pendingCount} pending
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportReimbursementsCsv}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#00873E] hover:bg-[#007033] disabled:bg-slate-300 text-white shadow-xs transition cursor-pointer disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report (CSV)</span>
          </button>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            {currentUser.officer_position || currentUser.role}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {rows.map(r => (
            <div key={r.id} className="p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-slate-900 truncate">{r.budget_title}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {r.officer_name} • Receipt {r.receipt_ref || 'N/A'} • {r.date_submitted}
                  </p>
                  {r.remarks && <p className="text-[11px] text-slate-400 truncate">{r.remarks}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${DEPARTMENTS[r.department]?.badgeBg}`}>
                    {r.department}
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-900">₱{r.amount_spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  {r.reimbursement_status === 'Pending' ? (
                    <>
                      <button
                        onClick={() => approveReimbursement(r.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#00873E] hover:bg-[#007033] text-white text-[11px] font-bold transition cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => { setRejectingId(r.id); setRejectRemark(''); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </>
                  ) : (
                    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                      r.reimbursement_status === 'Rejected' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {r.reimbursement_status === 'Rejected' ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />} {r.reimbursement_status}
                    </span>
                  )}
                </div>
              </div>

              {rejectingId === r.id && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Reason for rejection..."
                    value={rejectRemark}
                    onChange={(e) => setRejectRemark(e.target.value)}
                    className="flex-1 px-2 py-1 text-xs bg-white rounded-lg border border-rose-200"
                  />
                  <button
                    onClick={() => setRejectingId(null)}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-bold transition cursor-pointer border border-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleReject(r.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition cursor-pointer"
                  >
                    Confirm Reject
                  </button>
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && (
            <div className="p-10 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <Clock className="w-6 h-6 text-slate-300" />
              No reimbursement requests yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReimbursementReviewPanel;
