import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  BudgetProposal, 
  ProposalStage, 
  UserRole, 
  DepartmentCode 
} from '../types';
import { DEPARTMENTS } from '../data/mockData';
import { 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Printer, 
  ThumbsUp, 
  ThumbsDown, 
  MinusCircle, 
  MessageSquare, 
  Plus, 
  DollarSign, 
  Send, 
  ShieldCheck, 
  Lock, 
  ArrowRight,
  Upload,
  Receipt,
  FileCheck
} from 'lucide-react';
import { PrintableProposalModal } from './PrintableProposalModal';

interface BudgetProposalWorkflowProps {
  onOpenCreateProposal: () => void;
  onOpenBudgetRequestModal: (proposalId: string) => void;
  onOpenLiquidationModal: (proposalId: string) => void;
}

export const BudgetProposalWorkflow: React.FC<BudgetProposalWorkflowProps> = ({ 
  onOpenCreateProposal,
  onOpenBudgetRequestModal,
  onOpenLiquidationModal
}) => {
  const { 
    proposals, 
    scopedProposals,
    userDepartment,
    isDepartmentRestricted,
    scopedDepartmentInfo,
    currentUser,
    activeSemester,
    submitProposalForReview,
    executiveReviewProposal,
    voteOnProposal,
    addProposalNote,
    adviserApproveProposal,
    deanApproveProposal,
    isReadOnlyStudent
  } = useApp();

  // Students only ever see fully-approved-and-released budgets (Section 3)
  // — never drafts or ones still mid-review.
  const displayProposals = (isDepartmentRestricted ? scopedProposals : proposals)
    .filter(p => !isReadOnlyStudent || p.budget_status === 'APPROVED_RELEASED');

  const [selectedProposalId, setSelectedProposalId] = useState<string>(() => displayProposals[0]?.id || '');
  const [printableProposal, setPrintableProposal] = useState<BudgetProposal | null>(null);
  const [newComment, setNewComment] = useState<string>('');
  const [reviewRemarks, setReviewRemarks] = useState<string>('');

  const activeProposal = displayProposals.find(p => p.id === selectedProposalId) || displayProposals[0];

  const getStageBadge = (stage: ProposalStage) => {
    switch(stage) {
      case 'DRAFT':
        return { label: '1. Treasurer Draft', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'EXECUTIVE_REVIEW':
        return { label: '2. Governor Review', color: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'COUNCIL_VOTING':
        return { label: '3. Council Resolution & Voting', color: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'CSC_ADVISER_APPROVAL':
        return { label: '4. CSC Adviser Approval', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
      case 'DEAN_APPROVAL':
        return { label: '5. Dean Final Approval', color: 'bg-rose-100 text-rose-800 border-rose-300' };
      case 'APPROVED_RELEASED':
        return { label: 'Approved & Funds Released', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'FOR_REVISION':
        return { label: 'Needs Revision', color: 'bg-orange-100 text-orange-800 border-orange-300' };
      case 'REJECTED':
        return { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-300' };
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !activeProposal) return;
    addProposalNote(activeProposal.id, newComment.trim(), true);
    setNewComment('');
  };

  const userVoted = activeProposal?.votes?.find(v => v.council_member_id === currentUser.id);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            Budget Proposal & Reimbursement
          </h2>
          <p className="text-xs text-slate-500">
            Draft a request, submit it for Adviser review, and track it through to Dean fund release ({activeSemester.school_year_label})
          </p>
        </div>

        {!isReadOnlyStudent && (
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCreateProposal}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#00873E] hover:bg-[#007033] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Draft New Proposal</span>
            </button>
          </div>
        )}
      </div>

      {/* Active Role Perspective Bar */}
      <div className="bg-slate-900 text-white p-3 rounded-2xl flex items-center gap-2 text-xs">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span className="font-bold text-slate-300">Logged in as:</span>
        <span className="font-extrabold text-white px-2 py-0.5 bg-white/20 rounded">
          {currentUser.name} ({currentUser.officer_position || currentUser.role})
        </span>
      </div>

      {/* Main Grid: Proposal Selection List & Active Proposal Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Proposals Sidebar */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                {isDepartmentRestricted ? `${userDepartment} Proposals (${displayProposals.length})` : `All Proposals (${displayProposals.length})`}
              </h3>
              {isDepartmentRestricted && (
                <span className="text-[10px] bg-blue-100 text-blue-900 font-bold px-1.5 py-0.5 rounded">
                  {userDepartment} ONLY
                </span>
              )}
            </div>

            {displayProposals.length === 0 ? (
              <div className="text-center py-8 px-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">No proposals drafted yet for {userDepartment}.</p>
                {!isReadOnlyStudent && (
                  <button
                    onClick={onOpenCreateProposal}
                    className="px-3 py-1.5 bg-[#00873E] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer hover:bg-[#007033]"
                  >
                    + Draft {userDepartment} Proposal
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {displayProposals.map((prop) => {
                  const isSelected = prop.id === activeProposal?.id;
                  const badge = getStageBadge(prop.budget_status);
                  const dept = DEPARTMENTS[prop.department];

                  return (
                    <div
                      key={prop.id}
                      onClick={() => setSelectedProposalId(prop.id)}
                      className={`p-3.5 rounded-xl border transition cursor-pointer text-left space-y-1.5 ${
                        isSelected
                          ? 'bg-emerald-50/70 border-[#00873E] ring-2 ring-emerald-500/20 shadow-xs'
                          : 'bg-slate-50/50 hover:bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${dept?.badgeBg}`}>
                          {prop.department}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>

                      <h4 className="font-bold text-xs text-slate-900 line-clamp-1">{prop.budget_title}</h4>
                      
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
                        <span>{prop.line_items.length} Line items</span>
                        <span className="font-extrabold text-slate-900">₱{prop.total_budget_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Detailed Proposal View & Stage Actions */}
        {activeProposal ? (
          <div className="lg:col-span-8 space-y-5">
            {/* Active Proposal Card */}
            <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-xs space-y-5">
              {/* Proposal Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${DEPARTMENTS[activeProposal.department]?.badgeBg}`}>
                      {activeProposal.department} - {DEPARTMENTS[activeProposal.department]?.name}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${getStageBadge(activeProposal.budget_status).color}`}>
                      {getStageBadge(activeProposal.budget_status).label}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {activeProposal.budget_title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Proponent: <span className="font-semibold text-slate-800">{activeProposal.created_by_officer}</span> • Submitted: {activeProposal.created_at}
                  </p>
                </div>

                {/* Printable Proposal Button */}
                <button
                  onClick={() => setPrintableProposal(activeProposal)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer self-start"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>{isReadOnlyStudent ? 'View / Download PDF' : 'Print Official Proposal'}</span>
                </button>
              </div>

              {/* Description */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-1">
                <p className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Description & Justification</p>
                <p>{activeProposal.budget_description}</p>
                {activeProposal.event_title && (
                  <p className="text-[11px] text-emerald-800 font-medium pt-1">
                    📅 Linked Semester: <span className="font-bold">{activeProposal.event_title}</span>
                  </p>
                )}
              </div>

              {/* Approval Progress Tracker — Officer creates, Adviser reviews,
                  auto-forwards to Dean for final release. (Old Governor
                  Review / Council Voting stages are skipped for new
                  proposals but stay recognized here in case any legacy
                  proposal is still mid-flow in one of them.) */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Approval Workflow Progress
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {/* Stage 1: Officer Draft */}
                  <div className={`p-2.5 rounded-xl border ${
                    activeProposal.budget_status !== 'DRAFT'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-amber-50 border-amber-300 text-amber-900'
                  }`}>
                    <p className="text-[10px] font-bold uppercase opacity-75">Stage 1</p>
                    <p className="font-bold text-xs mt-0.5">Officer Draft</p>
                    <span className="text-[10px] block mt-1">✓ Line Items Set</span>
                  </div>

                  {/* Stage 2: CSC Adviser */}
                  <div className={`p-2.5 rounded-xl border ${
                    activeProposal.adviser_approval?.decision === 'APPROVED'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : (['EXECUTIVE_REVIEW', 'COUNCIL_VOTING', 'CSC_ADVISER_APPROVAL'].includes(activeProposal.budget_status)
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                          : 'bg-slate-50 border-slate-200 text-slate-400')
                  }`}>
                    <p className="text-[10px] font-bold uppercase opacity-75">Stage 2</p>
                    <p className="font-bold text-xs mt-0.5">Adviser Review</p>
                    <span className="text-[10px] block mt-1">
                      {activeProposal.adviser_approval?.decision === 'APPROVED' ? '✓ Approved' : 'Pending'}
                    </span>
                  </div>

                  {/* Stage 3: Dean */}
                  <div className={`p-2.5 rounded-xl border ${
                    activeProposal.dean_approval?.release_authorized
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : (activeProposal.budget_status === 'DEAN_APPROVAL' ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-400')
                  }`}>
                    <p className="text-[10px] font-bold uppercase opacity-75">Stage 3</p>
                    <p className="font-bold text-xs mt-0.5">Dean Approval</p>
                    <span className="text-[10px] block mt-1">
                      {activeProposal.dean_approval?.release_authorized ? '✓ Approved' : 'Pending'}
                    </span>
                  </div>

                  {/* Stage 4: Released */}
                  <div className={`p-2.5 rounded-xl border ${
                    activeProposal.budget_status === 'APPROVED_RELEASED'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    <p className="text-[10px] font-bold uppercase opacity-75">Stage 4</p>
                    <p className="font-bold text-xs mt-0.5">Funds Released</p>
                    <span className="text-[10px] block mt-1">
                      {activeProposal.budget_status === 'APPROVED_RELEASED' ? '✓ Fund Released' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Line Items Table (Requirements & Price Evaluation) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                    Requirement & Price Evaluation ({activeProposal.line_items.length} Items)
                  </h4>
                  <span className="text-xs font-bold text-emerald-800">
                    Total: ₱{activeProposal.total_budget_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit (₱)</th>
                        <th className="py-2.5 px-3 text-right">Subtotal (₱)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeProposal.line_items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            {item.item_desc}
                            {item.remarks && <span className="block text-[10px] text-slate-400">{item.remarks}</span>}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{item.category}</td>
                          <td className="py-2.5 px-3 text-center font-bold">{item.quantity}</td>
                          <td className="py-2.5 px-3 text-right font-mono">₱{item.unit_cost.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">₱{item.estimated_amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ACTION PANELS BASED ON CURRENT USER ROLE & PROPOSAL STATUS */}
              <div className="pt-2 border-t border-slate-100 space-y-4">
                {/* 1. Officer Actions (Submit Draft) */}
                {currentUser.role === 'officer_treasurer' && activeProposal.budget_status === 'DRAFT' && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>Draft ready — submit for Adviser review?</span>
                    </div>
                    <p className="text-xs text-amber-800">
                      This sends the request straight to your CSC Adviser, who forwards it to the Dean for final approval.
                    </p>
                    <button
                      onClick={() => submitProposalForReview(activeProposal.id)}
                      className="px-4 py-2 bg-[#00873E] hover:bg-[#007033] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                    >
                      Submit Request →
                    </button>
                  </div>
                )}

                {/* 2. Governor Review Actions */}
                {currentUser.role === 'officer_governor' && activeProposal.budget_status === 'EXECUTIVE_REVIEW' && (
                  <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 space-y-3">
                    <div className="flex items-center gap-2 text-purple-900 font-bold text-xs">
                      <ShieldCheck className="w-4 h-4 text-purple-600" />
                      <span>Governor / Executive Committee Review</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Enter executive review endorsement remarks..."
                      value={reviewRemarks}
                      onChange={(e) => setReviewRemarks(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-purple-200"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => executiveReviewProposal(activeProposal.id, 'APPROVED_TO_COUNCIL', reviewRemarks || 'Endorsed for Council Voting')}
                        className="px-4 py-2 bg-[#00873E] hover:bg-[#007033] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                      >
                        ✓ Endorse to Council Voting
                      </button>
                      <button
                        onClick={() => executiveReviewProposal(activeProposal.id, 'NEEDS_REVISION', reviewRemarks || 'Needs revisions on item quantities')}
                        className="px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs font-bold rounded-xl cursor-pointer"
                      >
                        Request Revision
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Council Member Voting & Resolution */}
                {currentUser.role === 'council_member' && activeProposal.budget_status === 'COUNCIL_VOTING' && (
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-blue-900">Council Member Resolution Voting</span>
                      <span className="text-[11px] text-blue-700 font-semibold">
                        Resolution: {activeProposal.council_resolution?.resolution_number || 'CSC-RES-2024'}
                      </span>
                    </div>
                    <p className="text-xs text-blue-800">
                      Cast your official vote on allocating Student Activity Funds (SAF) for this activity:
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => voteOnProposal(activeProposal.id, 'IN_FAVOR', 'Voted In Favor')}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" /> In Favor (Yay)
                      </button>
                      <button
                        onClick={() => voteOnProposal(activeProposal.id, 'AGAINST', 'Voted Against')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" /> Against (Nay)
                      </button>
                      <button
                        onClick={() => voteOnProposal(activeProposal.id, 'ABSTAIN', 'Abstained')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
                      >
                        <MinusCircle className="w-3.5 h-3.5" /> Abstain
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. CSC Adviser Approval */}
                {currentUser.role === 'csc_adviser' && activeProposal.budget_status === 'CSC_ADVISER_APPROVAL' && (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3">
                    <span className="font-bold text-xs text-emerald-900 block">Student Council Adviser Formal Approval</span>
                    <p className="text-xs text-emerald-800">
                      Council resolution passed with {activeProposal.votes.length} votes. Recommend approval to College Dean?
                    </p>
                    <button
                      onClick={() => adviserApproveProposal(activeProposal.id, 'APPROVED', 'Approved by CSC Adviser.')}
                      className="px-4 py-2 bg-[#00873E] hover:bg-[#007033] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                    >
                      ✓ Approve & Forward to Dean
                    </button>
                  </div>
                )}

                {/* 5. Dean Approval & Fund Release */}
                {currentUser.role === 'dean' && activeProposal.budget_status === 'DEAN_APPROVAL' && (
                  <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-3">
                    <span className="font-bold text-xs text-rose-900 block">Dean Executive Approval & Fund Release Authorization</span>
                    <p className="text-xs text-rose-800">
                      Authorize full disbursement of ₱{activeProposal.total_budget_amount.toLocaleString('en-US')} from Student Activity Fund (SAF)?
                    </p>
                    <button
                      onClick={() => deanApproveProposal(activeProposal.id, 'APPROVED_FUND_RELEASE', 'Executive Approval & Fund Release authorized.')}
                      className="px-5 py-2.5 bg-[#00873E] hover:bg-[#007033] text-white text-xs font-extrabold rounded-xl shadow-md cursor-pointer"
                    >
                      ✓ Approve & Authorize Fund Release
                    </button>
                  </div>
                )}

                {/* Post-Approval Financial Flow Actions (Budget Requests, Expenses, Reimbursements, Liquidation, Return) */}
                {!isReadOnlyStudent && activeProposal.budget_status === 'APPROVED_RELEASED' && (
                  <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Approved Budget Financial Execution
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Total Released: ₱{activeProposal.cashouts.reduce((s, c) => s + c.amount_released, 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        onClick={() => onOpenBudgetRequestModal(activeProposal.id)}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-left border border-slate-700 transition cursor-pointer"
                      >
                        <span className="font-bold text-xs text-white block">+ Fund Request</span>
                        <span className="text-[10px] text-slate-400">Letters/Billings</span>
                      </button>

                      <button
                        onClick={() => onOpenBudgetRequestModal(activeProposal.id)}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-left border border-slate-700 transition cursor-pointer"
                      >
                        <span className="font-bold text-xs text-white block">+ Add Expense</span>
                        <span className="text-[10px] text-slate-400">{activeProposal.expenses.length} Recorded</span>
                      </button>

                      <button
                        onClick={() => onOpenLiquidationModal(activeProposal.id)}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-left border border-slate-700 transition cursor-pointer"
                      >
                        <span className="font-bold text-xs text-white block">Audit Liquidation</span>
                        <span className="text-[10px] text-slate-400">Account Fund Spent</span>
                      </button>

                      <button
                        onClick={() => onOpenLiquidationModal(activeProposal.id)}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-left border border-slate-700 transition cursor-pointer"
                      >
                        <span className="font-bold text-xs text-white block">Budget Return</span>
                        <span className="text-[10px] text-slate-400">Cash-in Double Entry</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Collaborative Notes & Comments Section ("KUNG MAY NOTES KAMO IDAGDAG INI SA NOTES") */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-amber-500" />
                    Council Notes & Remarks ("KUNG MAY NOTES KAMO IDAGDAG INI SA NOTES")
                  </h4>
                  <span className="text-[11px] text-slate-400">{activeProposal.notes.length} Notes</span>
                </div>

                {/* Notes List */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {activeProposal.notes.map((n) => (
                    <div key={n.id} className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{n.author_name}</span>
                        <span className="text-[10px] text-slate-400">{n.created_at}</span>
                      </div>
                      <p className="text-slate-700">{n.note_content}</p>
                    </div>
                  ))}
                </div>

                {/* Add Note Form — students see the notes above read-only */}
                {!isReadOnlyStudent && (
                  <form onSubmit={handleAddNote} className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Type note or remark (e.g. KUNG MAY NOTES KAMO IDAGDAG INI SA NOTES...)"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="flex-1 px-3.5 py-2 text-xs bg-slate-50 focus:bg-white rounded-xl border border-slate-200 focus:outline-emerald-500 font-medium"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#00873E] hover:bg-[#007033] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Add Note</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 bg-white p-12 text-center rounded-3xl border border-slate-200">
            <p className="text-slate-500">No proposals available. Click + Draft New Proposal above.</p>
          </div>
        )}
      </div>

      {/* Printable Modal */}
      <PrintableProposalModal
        proposal={printableProposal}
        isOpen={Boolean(printableProposal)}
        onClose={() => setPrintableProposal(null)}
        redactSignatures={isReadOnlyStudent}
      />
    </div>
  );
};
