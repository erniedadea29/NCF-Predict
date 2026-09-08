import React from 'react';
import { useApp } from '../context/AppContext';
import { DEPARTMENTS } from '../data/mockData';
import { Receipt, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';

// Dean/Adviser's course-scoped Budget tab is Reimbursement-only per spec —
// no "Draft CCS Proposal" / general Budget & Proposals sections here, just
// a review queue over the reimbursement requests already raised by Officers
// against their department's approved-and-released proposals.
export const ReimbursementReviewPanel: React.FC = () => {
  const { scopedProposals, proposals, isDepartmentRestricted, userDepartment, approveReimbursement, currentUser } = useApp();

  const displayProposals = isDepartmentRestricted ? scopedProposals : proposals;

  const rows = displayProposals.flatMap(p =>
    p.reimbursements.map(r => ({ ...r, budget_title: p.budget_title, department: p.department }))
  ).sort((a, b) => (a.reimbursement_status === 'Pending' ? -1 : 1));

  const pendingCount = rows.filter(r => r.reimbursement_status === 'Pending').length;

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
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          {currentUser.officer_position || currentUser.role}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-3.5">
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
                  <button
                    onClick={() => approveReimbursement(r.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#00873E] hover:bg-[#007033] text-white text-[11px] font-bold transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </button>
                ) : (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {r.reimbursement_status}
                  </span>
                )}
              </div>
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
