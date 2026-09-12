import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DEPARTMENTS } from '../data/mockData';
import { UserAccountSummary, DepartmentTransaction, BudgetProposal } from '../types';
import { Archive, Receipt, FileText, Send, Lock, Eye, Clock, ThumbsUp, ThumbsDown } from 'lucide-react';

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

// Adviser Handover: an outgoing Adviser sends (or a successor requests,
// with Admin/Dean approval) a single read-only PDF bundling the whole
// department's activity log & previous records. Rendered here (rather
// than a new nav tab) since this page already IS the continuity/handover
// screen for both Dean and Adviser.
export const AdviserHandoverSection: React.FC = () => {
  const {
    currentUser, userDepartment, handoverFiles, handoverRequests,
    sendAdviserHandoverFile, requestAdviserHandoverFile, reviewAdviserHandoverRequest,
    getSignedHandoverFileUrl
  } = useApp();

  const isAdviser = currentUser.role === 'csc_adviser';
  const isDean = currentUser.role === 'dean';

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decideRemark, setDecideRemark] = useState('');
  // Which request's remark composer is open, and which decision it's
  // composing for — Approve and Reject each open their own composer so
  // there's exactly one "Confirm" action, no ambiguous double-click.
  const [decidingThread, setDecidingThread] = useState<{ id: string; decision: 'APPROVED' | 'REJECTED' } | null>(null);

  const deptFiles = handoverFiles.filter(f => f.department_code === userDepartment);
  const deptRequests = handoverRequests.filter(r => r.department_code === userDepartment);
  const pendingRequests = deptRequests.filter(r => r.status === 'PENDING');

  const myApprovedFileIds = new Set(
    deptRequests.filter(r => r.requester_id === currentUser.id && r.status === 'APPROVED').map(r => r.file_id)
  );
  const myPendingFileIds = new Set(
    deptRequests.filter(r => r.requester_id === currentUser.id && r.status === 'PENDING').map(r => r.file_id)
  );

  const handleSend = async () => {
    setSending(true);
    setSendResult(null);
    const res = await sendAdviserHandoverFile();
    setSending(false);
    setSendResult(res);
  };

  const handleRequest = async (fileId: string) => {
    setRequestingId(fileId);
    await requestAdviserHandoverFile(fileId);
    setRequestingId(null);
  };

  const handleView = async (path: string) => {
    const url = await getSignedHandoverFileUrl(path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDecide = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    setDecidingId(requestId);
    await reviewAdviserHandoverRequest(requestId, decision, decideRemark.trim() || undefined);
    setDecidingId(null);
    setDecidingThread(null);
    setDecideRemark('');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
          <Send className="w-4 h-4 text-emerald-600" />
          Adviser Handover File
        </h3>
        <p className="text-xs text-slate-500">
          A single read-only file bundling the Adviser's complete activity log & previous records — sent directly to Admin/Dean, or requested by a new Adviser with their approval.
        </p>
      </div>

      {isAdviser && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#00873E] hover:bg-[#007033] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sending ? 'Generating & Sending...' : 'Send My Activity Log & Records'}</span>
          </button>
          {sendResult && (
            <p className={`text-xs ${sendResult.success ? 'text-emerald-700' : 'text-rose-600'}`}>{sendResult.message}</p>
          )}
          <p className="text-[11px] text-slate-400">
            Generates a PDF of your department's transactions, proposals (with liquidation & reimbursement outcomes), and events/attendance/penalty records, and notifies your department's Admin and Dean immediately.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500" />
          <h4 className="text-sm font-bold text-slate-900">Handover Files ({deptFiles.length})</h4>
        </div>
        <div className="divide-y divide-slate-100">
          {deptFiles.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-400">No handover file has been sent for {userDepartment} yet.</p>
          ) : (
            deptFiles.map(f => {
              // Admin/Dean always have access (received it directly); the
              // sender always does; a successor Adviser needs an approved
              // request first — this mirrors the storage RLS exactly, so
              // "View" here never surfaces a link the server would refuse.
              const canView = !isAdviser || f.adviser_id === currentUser.id || myApprovedFileIds.has(f.id);
              const isPending = myPendingFileIds.has(f.id);
              return (
                <div key={f.id} className="flex items-center justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{f.adviser_name || 'Adviser'}'s Handover File</p>
                    <p className="text-[11px] text-slate-500">Generated {new Date(f.generated_at).toLocaleString()}</p>
                  </div>
                  {canView ? (
                    <button
                      onClick={() => handleView(f.file_path)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold transition cursor-pointer shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" /> View (Read-Only)
                    </button>
                  ) : isPending ? (
                    <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-[11px] font-bold shrink-0">
                      <Clock className="w-3.5 h-3.5" /> Awaiting Approval
                    </span>
                  ) : (
                    <button
                      onClick={() => handleRequest(f.id)}
                      disabled={requestingId === f.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition cursor-pointer disabled:opacity-60 shrink-0"
                    >
                      <Lock className="w-3.5 h-3.5" /> {requestingId === f.id ? 'Requesting...' : 'Request Access'}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Only Admin/Dean can actually call review_adviser_handover_request
          server-side — Super Admin is deliberately excluded, matching the
          spec's "requires approval from at least one of them (Admin or
          Dean)" and the RPC's own role check. */}
      {(isDean || currentUser.role === 'admin') && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-bold text-slate-900">Pending Access Requests ({pendingRequests.length})</h4>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingRequests.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">No pending handover file requests.</p>
            ) : (
              pendingRequests.map(r => (
                <div key={r.id} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{r.requester_name || 'Adviser'} is requesting access</p>
                      <p className="text-[11px] text-slate-500">Requested {new Date(r.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { setDecidingThread({ id: r.id, decision: 'APPROVED' }); setDecideRemark(''); }}
                        disabled={decidingId === r.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#00873E] hover:bg-[#007033] text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-60"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => { setDecidingThread({ id: r.id, decision: 'REJECTED' }); setDecideRemark(''); }}
                        disabled={decidingId === r.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition cursor-pointer disabled:opacity-60"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                  {decidingThread?.id === r.id && (
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Remarks (optional)..."
                        value={decideRemark}
                        onChange={(e) => setDecideRemark(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs bg-white rounded-lg border border-slate-200"
                      />
                      <button
                        onClick={() => setDecidingThread(null)}
                        disabled={decidingId === r.id}
                        className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-bold transition cursor-pointer border border-slate-200 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDecide(r.id, decidingThread.decision)}
                        disabled={decidingId === r.id}
                        className={`px-2.5 py-1.5 rounded-lg text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-60 ${
                          decidingThread.decision === 'APPROVED' ? 'bg-[#00873E] hover:bg-[#007033]' : 'bg-rose-600 hover:bg-rose-700'
                        }`}
                      >
                        {decidingId === r.id ? 'Saving...' : decidingThread.decision === 'APPROVED' ? 'Confirm Approve' : 'Confirm Reject'}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
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

      <AdviserHandoverSection />

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
