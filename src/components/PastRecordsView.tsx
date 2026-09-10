import React from 'react';
import { useApp } from '../context/AppContext';
import { DEPARTMENTS } from '../data/mockData';
import { Archive, Receipt, FileText } from 'lucide-react';

const OFFICER_ROLES = ['officer_treasurer', 'officer_governor', 'council_member'];

// Section 4: when a Dean's Adviser (or an Adviser's Officer) goes inactive,
// their past transactions/proposals don't disappear — they surface here,
// read-only, under the role one level up. Reassignment itself needs no
// extra code (Phase 0's DB trigger frees the role_slots seat the instant
// "Deactivate" is clicked in Manage Users); this view is purely about not
// losing the history that person created.
export const PastRecordsView: React.FC = () => {
  const { currentUser, userAccounts, userDepartment, scopedTransactions, scopedProposals } = useApp();

  const isDean = currentUser.role === 'dean';
  const label = isDean ? 'Past Adviser' : 'Past Officer';

  // Everyone in the viewer's own department, one role level below them,
  // who is no longer active — their records are what this tab surfaces.
  const pastHolders = userAccounts.filter(u =>
    !u.is_active &&
    u.department === userDepartment &&
    (isDean ? u.role === 'csc_adviser' : OFFICER_ROLES.includes(u.role))
  );
  const pastHolderIds = new Set(pastHolders.map(u => u.id));

  const pastTransactions = scopedTransactions.filter(t => t.created_by && pastHolderIds.has(t.created_by));
  const pastProposals = scopedProposals.filter(p => p.requested_by && pastHolderIds.has(p.requested_by));

  const dept = DEPARTMENTS[userDepartment];

  return (
    <div className="space-y-5">
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Archive className="w-5 h-5 text-slate-500" />
          {label}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Read-only history from {pastHolders.length} deactivated {isDean ? 'Adviser' : 'Officer'}{pastHolders.length === 1 ? '' : 's'} in {userDepartment} — {dept?.name}.
        </p>
      </div>

      {pastHolders.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-slate-200 text-xs text-slate-400">
          No deactivated {isDean ? 'Adviser' : 'Officer'} on record for {userDepartment} yet — this fills in automatically once one is deactivated.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Deactivated {isDean ? 'Advisers' : 'Officers'}</p>
            <div className="flex flex-wrap gap-2">
              {pastHolders.map(h => (
                <span key={h.id} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                  {h.full_name} <span className="text-slate-400">({h.email})</span>
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900">Transactions ({pastTransactions.length})</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {pastTransactions.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-400">No transactions from a deactivated {isDean ? 'Adviser' : 'Officer'} yet.</p>
              ) : (
                pastTransactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{tx.title}</p>
                      <p className="text-[11px] text-slate-500">{tx.category} • {tx.date} • {tx.reference_code}</p>
                    </div>
                    <span className={`shrink-0 text-sm font-black ${tx.type === 'INCOME' ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}₱{tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900">Budget Proposals ({pastProposals.length})</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {pastProposals.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-400">No proposals from a deactivated {isDean ? 'Adviser' : 'Officer'} yet.</p>
              ) : (
                pastProposals.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{p.budget_title}</p>
                      <p className="text-[11px] text-slate-500">{p.created_by_officer} • {p.budget_status.replace(/_/g, ' ')}</p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-slate-900">
                      ₱{p.total_budget_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PastRecordsView;
