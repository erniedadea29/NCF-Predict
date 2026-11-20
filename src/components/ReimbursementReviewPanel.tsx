import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DEPARTMENTS } from '../data/mockData';
import { downloadCsv } from '../utils/csvExport';
import { Receipt, CheckCircle2, XCircle, Clock, ShieldCheck, Download, Eye, Search, ClipboardCheck } from 'lucide-react';
import { ReceiptPhotosModal } from './ReceiptPhotosModal';
import { ReimbursementGroupModal, groupReimbursements, statusLabel, STATUS_STYLES, peso } from './ReimbursementDetailModal';

// Dean/Adviser's course-scoped Budget tab is Reimbursement-only per spec —
// no "Draft CCS Proposal" / general Budget & Proposals sections here, just
// a review queue over the reimbursement requests already raised by Officers
// against their department's approved-and-released proposals.
export const ReimbursementReviewPanel: React.FC = () => {
  const { scopedProposals, proposals, isDepartmentRestricted, userDepartment, approveReimbursement, currentUser } = useApp();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectRemark, setRejectRemark] = useState('');
  // The reviewer must open a request's receipt photos before approving it.
  const [viewedPhotos, setViewedPhotos] = useState<Set<string>>(new Set());
  const [photosFor, setPhotosFor] = useState<{ title: string; subtitle: string; department: string; proposalId: string; expenseId: string; legacyPath?: string } | null>(null);

  const [viewing, setViewing] = useState<string | null>(null);
  type Filter = 'Pending' | 'Approved' | 'Rejected' | 'All';
  const [filter, setFilter] = useState<Filter | null>(null);
  const [search, setSearch] = useState('');

  const displayProposals = isDepartmentRestricted ? scopedProposals : proposals;

  const rows = displayProposals.flatMap(p =>
    p.reimbursements.map(r => ({ ...r, budget_title: p.budget_title, department: p.department, expense: p.expenses.find(e => e.id === r.expense_id) }))
  );
  // Receipts filed together (same budget, officer and day) are one request,
  // reviewed and approved together.
  const groups = groupReimbursements(rows);
  type Group = typeof groups[number];

  const viewed = viewing ? groups.find(g => g.key === viewing) : undefined;
  const openPhotos = (r: typeof rows[number]) => {
    setViewedPhotos(prev => new Set(prev).add(r.id));
    setPhotosFor({
      title: r.expense?.expense_desc || r.budget_title,
      subtitle: `${r.budget_title} • ${r.officer_name}${r.receipt_ref ? ` • ${r.receipt_ref}` : ''}`,
      department: r.department, proposalId: r.budget_id, expenseId: r.expense_id,
      legacyPath: r.expense?.proof_attach?.[0]?.url
    });
  };
  const pendingItems = (g: Group) => g.items.filter(r => r.reimbursement_status === 'Pending');
  // Every pending receipt with a photo must be opened before approving.
  const unchecked = (g: Group) => pendingItems(g).filter(r => r.expense_id && !viewedPhotos.has(r.id)).length;

  const approveGroup = (g: Group) => {
    pendingItems(g).forEach(r => approveReimbursement(r.id));
    setViewing(null);
  };
  const rejectGroup = (g: Group) => {
    const reason = rejectRemark.trim() || 'Rejected — see officer for details.';
    pendingItems(g).forEach(r => approveReimbursement(r.id, 'Rejected', reason));
    setRejectingId(null);
    setRejectRemark('');
    setViewing(null);
  };

  const pendingCount = groups.filter(g => g.status === 'Pending').length;
  const inFilter = (g: Group, f: Filter) =>
    f === 'All' || (f === 'Approved' ? g.status === 'Approved' || g.status === 'Partial' : g.status === f);
  const counts: Record<Filter, number> = {
    Pending: pendingCount,
    Approved: groups.filter(g => inFilter(g, 'Approved')).length,
    Rejected: groups.filter(g => inFilter(g, 'Rejected')).length,
    All: groups.length
  };
  // Opens on "Needs review" while anything is waiting, otherwise on All.
  const activeFilter: Filter = filter ?? (pendingCount > 0 ? 'Pending' : 'All');
  const term = search.trim().toLowerCase();
  const listed = groups
    .filter(g => inFilter(g, activeFilter))
    .filter(g => !term || [g.budget_title, g.officer_name, g.department, ...g.items.flatMap(r => [r.receipt_ref, r.remarks, r.expense?.expense_desc])]
      .some(f => (f || '').toLowerCase().includes(term)));
  const closeReview = () => { setViewing(null); setRejectingId(null); setRejectRemark(''); };

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
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0B3D2E] hover:bg-[#072A20] disabled:bg-[#0B3D2E]/35 text-white shadow-xs transition cursor-pointer disabled:cursor-not-allowed"
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
        <div className="p-3 border-b border-slate-200 bg-[#EEF4F0]/60 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {([
              ['Pending', 'Needs review'],
              ['Approved', 'Approved'],
              ['Rejected', 'Rejected'],
              ['All', 'All']
            ] as [Filter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  activeFilter === key
                    ? 'bg-[#0B3D2E] text-white'
                    : 'bg-white border border-[#0B3D2E]/20 text-[#0B3D2E] hover:bg-[#EEF4F0]'
                }`}
              >
                {label}
                <span className={`px-1.5 rounded-full text-[10px] ${
                  activeFilter === key ? 'bg-white/20' : key === 'Pending' && counts.Pending > 0 ? 'bg-[#F2B705] text-[#0B3D2E]' : 'bg-slate-100 text-slate-500'
                }`}>{counts[key]}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search expense, officer, OR no..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-lg border border-slate-200"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F5F3EC] text-slate-700 text-left">
                <th className="px-4 py-2.5 font-bold">Date</th>
                <th className="px-4 py-2.5 font-bold">Request</th>
                <th className="px-4 py-2.5 font-bold">Filed by</th>
                <th className="px-4 py-2.5 font-bold text-center">Receipts</th>
                <th className="px-4 py-2.5 font-bold text-right">Amount (₱)</th>
                <th className="px-4 py-2.5 font-bold text-center">Status</th>
                <th className="px-4 py-2.5 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listed.map(g => {
                const pending = g.status === 'Pending';
                return (
                  <tr key={g.key} className={pending ? 'bg-[#FFFBEB] hover:bg-[#FEF3C7]/60' : 'hover:bg-[#FBFAF4]'}>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{g.date_submitted}</td>
                    <td className="px-4 py-3 min-w-[240px]">
                      <p className="font-bold text-slate-900">
                        {!isDepartmentRestricted && <span className={`mr-1 px-1 py-px rounded text-[9px] font-black border ${DEPARTMENTS[g.department]?.badgeBg}`}>{g.department}</span>}
                        {g.budget_title}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {g.items.map(r => r.expense?.expense_desc || r.remarks).filter(Boolean).join(', ')}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{g.officer_name || '-'}</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-700">{g.items.length}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-mono font-bold text-slate-900">{peso(g.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap ${STATUS_STYLES[g.status]}`}>
                        {pending ? <Clock className="w-3 h-3" /> : g.status === 'Rejected' ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        {statusLabel(g.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {pending ? (
                        <button
                          onClick={() => setViewing(g.key)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0B3D2E] hover:bg-[#072A20] text-white text-[11px] font-bold transition cursor-pointer whitespace-nowrap"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" /> Review
                        </button>
                      ) : (
                        <button
                          onClick={() => setViewing(g.key)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-[#0B3D2E]/20 hover:bg-[#EEF4F0] text-[#0B3D2E] text-[11px] font-bold transition cursor-pointer whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {listed.length === 0 && (
            <div className="p-10 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <Clock className="w-6 h-6 text-slate-300" />
              {rows.length === 0 ? 'No reimbursement requests yet.'
                : term ? `No requests match "${search.trim()}".`
                : activeFilter === 'Pending' ? 'Nothing to review. All requests have been decided.'
                : 'No requests in this list.'}
            </div>
          )}
        </div>
      </div>

      {viewed && (() => {
        const left = unchecked(viewed);
        const pending = viewed.status === 'Pending';
        const pendingTotal = pendingItems(viewed).reduce((t, r) => t + r.amount_spent, 0);
        return (
          <ReimbursementGroupModal
            group={viewed}
            onClose={closeReview}
            onOpenPhotos={openPhotos}
            photosViewed={viewedPhotos}
            actions={pending ? (
              <>
                <p className={`w-full text-[11px] rounded-xl px-3 py-2 border ${left === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                  {left === 0
                    ? 'All receipts checked. You can now approve or reject this request.'
                    : `Step 1: click View on each receipt to check its photo (${left} left). Step 2: Approve or Reject the whole request.`}
                </p>
                {rejectingId === viewed.key ? (
                  <div className="w-full space-y-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-rose-800">Reason for rejection</label>
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. Receipt is unreadable, please re-upload."
                      value={rejectRemark}
                      onChange={(e) => setRejectRemark(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white rounded-lg border border-rose-200"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRejectingId(null)}
                        className="flex-1 py-1.5 rounded-lg bg-white hover:bg-[#EEF4F0] text-[#0B3D2E] text-[11px] font-bold transition cursor-pointer border border-[#0B3D2E]/20"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => rejectGroup(viewed)}
                        className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold transition cursor-pointer"
                      >
                        Confirm Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => approveGroup(viewed)}
                      disabled={left > 0}
                      title={left > 0 ? 'Check every receipt photo first.' : undefined}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-[#0B3D2E] hover:bg-[#072A20] disabled:bg-[#0B3D2E]/35 disabled:cursor-not-allowed text-white transition cursor-pointer whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve {peso(pendingTotal)}
                    </button>
                    <button
                      onClick={() => { setRejectingId(viewed.key); setRejectRemark(''); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </>
                )}
              </>
            ) : undefined}
          />
        );
      })()}
      {photosFor && (
        <ReceiptPhotosModal {...photosFor} canAdd={false} onClose={() => setPhotosFor(null)} />
      )}
    </div>
  );
};

export default ReimbursementReviewPanel;
