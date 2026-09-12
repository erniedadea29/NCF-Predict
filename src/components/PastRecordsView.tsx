import React from 'react';
import { useApp } from '../context/AppContext';
import { DEPARTMENTS } from '../data/mockData';
import { UserAccountSummary, DepartmentTransaction, BudgetProposal } from '../types';
import { Archive, Receipt, FileText } from 'lucide-react';

const OFFICER_ROLES = ['officer_treasurer', 'officer_governor', 'council_member'];

// Section 3b: the Dean's "Historical Audit File" must cover BOTH past
// Advisers and past Officers in their department, not just the tier
// directly below them — a Dean handing over to a new Adviser needs the
// whole chain's history, not half of it. An Adviser still only ever sees
// past Officers (the tier below them).
interface AuditGroup {
  key: string;
  label: string;
  holders: UserAccountSummary[];
}

// One self-contained section (holder chips + transactions + proposals) for
// a single deactivated role group — reused for both Advisers and Officers
// so the Dean's combined view doesn't duplicate markup.
const AuditGroupSection: React.FC<{
  group: AuditGroup;
  transactions: DepartmentTransaction[];
  proposals: BudgetProposal[];
}> = ({ group, transactions, proposals }) => {
  const holderIds = new Set(group.holders.map(h => h.id));
  const groupTransactions = transactions.filter(t => t.created_by && holderIds.has(t.created_by));
  const groupProposals = proposals.filter(p => p.requested_by && holderIds.has(p.requested_by));

  if (group.holders.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200 text-xs text-slate-400">
        No deactivated {group.label} on record yet — this fills in automatically once one is deactivated.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Deactivated {group.label}</p>
        <div className="flex flex-wrap gap-2">
          {group.holders.map(h => (
            <span key={h.id} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
              {h.full_name} <span className="text-slate-400">({h.email})</span>
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900">Transactions ({groupTransactions.length})</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {groupTransactions.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-400">No transactions from a deactivated {group.label} yet.</p>
          ) : (
            groupTransactions.map(tx => (
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
          <h3 className="text-sm font-bold text-slate-900">Budget Proposals ({groupProposals.length})</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {groupProposals.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-400">No proposals from a deactivated {group.label} yet.</p>
          ) : (
            groupProposals.map(p => (
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
    </div>
  );
};

export const PastRecordsView: React.FC = () => {
  const { currentUser, userAccounts, userDepartment, scopedTransactions, scopedProposals } = useApp();

  const isDean = currentUser.role === 'dean';

  const pastAdvisers = userAccounts.filter(u => !u.is_active && u.department === userDepartment && u.role === 'csc_adviser');
  const pastOfficers = userAccounts.filter(u => !u.is_active && u.department === userDepartment && OFFICER_ROLES.includes(u.role));

  // Dean gets the full handover chain (Adviser + Officer history); Adviser
  // only ever sees the tier directly below them (Officer history).
  const groups: AuditGroup[] = isDean
    ? [
        { key: 'adviser', label: 'Advisers', holders: pastAdvisers },
        { key: 'officer', label: 'Officers', holders: pastOfficers }
      ]
    : [{ key: 'officer', label: 'Officers', holders: pastOfficers }];

  const totalHolders = groups.reduce((sum, g) => sum + g.holders.length, 0);
  const dept = DEPARTMENTS[userDepartment];

  return (
    <div className="space-y-5">
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Archive className="w-5 h-5 text-slate-500" />
          Historical Audit File
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Read-only history from {totalHolders} deactivated {isDean ? 'Adviser(s)/Officer(s)' : 'Officer(s)'} in {userDepartment} — {dept?.name}, for continuity & handover reference.
        </p>
      </div>

      {groups.map(group => (
        <div key={group.key} className="space-y-3">
          {groups.length > 1 && (
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider px-1">Past {group.label}</h3>
          )}
          <AuditGroupSection group={group} transactions={scopedTransactions} proposals={scopedProposals} />
        </div>
      ))}
    </div>
  );
};

export default PastRecordsView;
