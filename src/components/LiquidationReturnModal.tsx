import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, Check, DollarSign, FileCheck, ArrowDownLeft, ShieldCheck, Plus, Trash2, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react';

interface LiquidationReturnModalProps {
  proposalId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface SummaryLine {
  category: string;
  spent: number;
  line_item_count: number;
}

const CATEGORY_OPTIONS = ['Revenue', 'Event', 'Capital'];

export const LiquidationReturnModal: React.FC<LiquidationReturnModalProps> = ({
  proposalId,
  isOpen,
  onClose
}) => {
  const { proposals, submitLiquidation, recordBudgetReturn, currentUser, adviserReviewLiquidation, deanReviewLiquidation } = useApp();
  const [activeTab, setActiveTab] = useState<'liquidation' | 'return'>('liquidation');
  const [liquidationNotes, setLiquidationNotes] = useState('All supplier invoices, physical cash vouchers, and attendance sheets verified for audit compliance.');
  const [returnRemarks, setReturnRemarks] = useState('Return of unused SAF event budget back to supreme treasury vault.');
  const [summaryLines, setSummaryLines] = useState<SummaryLine[]>([]);
  const [reviewRemarks, setReviewRemarks] = useState('');

  const targetProposal = proposals.find(p => p.id === proposalId);
  const liq = targetProposal?.liquidation;

  // Adviser -> Dean sequential review, mirroring the budget proposal
  // workflow. The Officer's submit form is only shown for a first
  // submission or when the report was sent back FOR_REVISION (submitting
  // again there updates the same row rather than creating a duplicate).
  const isAdviserPending = liq?.status === 'PENDING_ADVISER' && currentUser.role === 'csc_adviser';
  const isDeanPending = liq?.status === 'PENDING_DEAN' && currentUser.role === 'dean';
  const isAwaitingOtherReviewer = liq && (liq.status === 'PENDING_ADVISER' || liq.status === 'PENDING_DEAN') && !isAdviserPending && !isDeanPending;
  // Only Officers submit/edit liquidation reports — Dean/Adviser only ever
  // see the review panel or a waiting/closed status message above.
  const isOfficerRole = ['officer_treasurer', 'officer_governor', 'council_member'].includes(currentUser.role);
  const canEditLiquidation = isOfficerRole && (!liq || liq.status === 'FOR_REVISION');
  // Audited/Rejected/Closed (and legacy Draft/Submitted rows) are terminal
  // or otherwise not directly editable/reviewable here.
  const isClosedOrTerminal = Boolean(liq) && !canEditLiquidation && !isAdviserPending && !isDeanPending && !isAwaitingOtherReviewer;
  const canProcessReturn = liq?.status === 'Audited';

  // Seed the editable accounting summary from actual recorded expenses
  // whenever the modal opens for a proposal — the user can still adjust or
  // add lines before submitting; this is now an authored report, not a
  // fixed auto-derived one.
  useEffect(() => {
    if (!isOpen || !targetProposal) return;
    const summaryMap: Record<string, { spent: number; count: number }> = {};
    targetProposal.expenses.forEach(exp => {
      if (!summaryMap[exp.category]) summaryMap[exp.category] = { spent: 0, count: 0 };
      summaryMap[exp.category].spent += exp.amount_spent;
      summaryMap[exp.category].count += 1;
    });
    setSummaryLines(Object.keys(summaryMap).map(cat => ({
      category: cat, spent: summaryMap[cat].spent, line_item_count: summaryMap[cat].count
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, proposalId]);

  if (!isOpen || !proposalId || !targetProposal) return null;

  const totalReleased = targetProposal.cashouts.reduce((s, c) => s + c.amount_released, 0) || targetProposal.total_budget_amount;
  const totalSpent = targetProposal.expenses.reduce((s, e) => s + e.amount_spent, 0);
  const unspentBalance = Math.max(0, totalReleased - totalSpent);

  const updateLine = (idx: number, updates: Partial<SummaryLine>) => {
    setSummaryLines(prev => prev.map((line, i) => i === idx ? { ...line, ...updates } : line));
  };
  const removeLine = (idx: number) => setSummaryLines(prev => prev.filter((_, i) => i !== idx));
  const addLine = () => setSummaryLines(prev => [...prev, { category: CATEGORY_OPTIONS[0], spent: 0, line_item_count: 1 }]);

  const handleLiquidationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (summaryLines.length === 0) {
      alert('Add at least one accounting summary line before submitting.');
      return;
    }
    submitLiquidation(targetProposal.id, summaryLines, liquidationNotes);
    onClose();
  };

  const handleBudgetReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (unspentBalance <= 0) {
      alert('There is no remaining unspent balance to return.');
      return;
    }

    recordBudgetReturn(targetProposal.id, unspentBalance, returnRemarks);
    onClose();
  };

  const handleAdviserDecision = async (decision: 'APPROVED' | 'REVISION' | 'REJECTED') => {
    if (!liq) return;
    await adviserReviewLiquidation(liq.id, decision, reviewRemarks || undefined);
    setReviewRemarks('');
    onClose();
  };

  const handleDeanDecision = async (decision: 'APPROVED' | 'REVISION' | 'REJECTED') => {
    if (!liq) return;
    await deanReviewLiquidation(liq.id, decision, reviewRemarks || undefined);
    setReviewRemarks('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4">
        {/* Header */}
        <div className="px-6 py-4 bg-[#00873E] text-white flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base">Liquidation Audit & Budget Return</h3>
            <p className="text-xs text-emerald-100">{targetProposal.budget_title}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            onClick={() => setActiveTab('liquidation')}
            className={`flex-1 py-3 text-center border-b-2 transition cursor-pointer ${
              activeTab === 'liquidation' ? 'border-[#00873E] text-[#00873E] bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Liquidation Accounting Audit
          </button>
          <button
            onClick={() => canProcessReturn && setActiveTab('return')}
            disabled={!canProcessReturn}
            title={canProcessReturn ? undefined : 'Available once the liquidation report is fully Audited (Adviser + Dean approved)'}
            className={`flex-1 py-3 text-center border-b-2 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
              activeTab === 'return' ? 'border-[#00873E] text-[#00873E] bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Budget Return (Double-Entry Cash-In)
          </button>
        </div>

        {/* Financial Overview Metrics */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Total Released</span>
              <p className="text-sm sm:text-base font-extrabold text-slate-800 mt-0.5">
                ₱{totalReleased.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Total Spent</span>
              <p className="text-sm sm:text-base font-extrabold text-slate-800 mt-0.5">
                ₱{totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
              <span className="text-[10px] text-emerald-700 font-bold uppercase">Unspent Balance</span>
              <p className="text-sm sm:text-base font-black text-[#00873E] mt-0.5">
                ₱{unspentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {activeTab === 'liquidation' && liq && (isAdviserPending || isDeanPending) ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-2xl border space-y-2 ${isAdviserPending ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                <span className={`font-bold text-xs block ${isAdviserPending ? 'text-emerald-900' : 'text-rose-900'}`}>
                  {isAdviserPending ? 'Adviser Review' : 'Dean Final Review'}
                </span>
                <p className={`text-xs ${isAdviserPending ? 'text-emerald-800' : 'text-rose-800'}`}>
                  {isAdviserPending
                    ? 'Review the accounting summary above and either forward this liquidation report to the Dean, send it back for revision, or reject it.'
                    : 'This liquidation report was endorsed by the Adviser. Approve to certify it as Audited, send it back for revision, or reject it.'}
                </p>
                <textarea
                  rows={2}
                  placeholder="Remarks (optional)..."
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => (isAdviserPending ? handleAdviserDecision('APPROVED') : handleDeanDecision('APPROVED'))}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#00873E] hover:bg-[#007033] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" /> {isAdviserPending ? 'Approve & Forward to Dean' : 'Approve & Certify Audited'}
                  </button>
                  <button
                    onClick={() => (isAdviserPending ? handleAdviserDecision('REVISION') : handleDeanDecision('REVISION'))}
                    className="flex items-center gap-1.5 px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Request Revision
                  </button>
                  <button
                    onClick={() => (isAdviserPending ? handleAdviserDecision('REJECTED') : handleDeanDecision('REJECTED'))}
                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === 'liquidation' && isAwaitingOtherReviewer ? (
            <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1.5">
              <ShieldCheck className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">
                Awaiting {liq?.status === 'PENDING_ADVISER' ? 'Adviser' : 'Dean'} review.
              </p>
              <p className="text-[11px] text-slate-400">You'll be able to edit and resubmit if it's returned for revision.</p>
            </div>
          ) : activeTab === 'liquidation' && isClosedOrTerminal ? (
            <div className={`p-4 rounded-2xl border space-y-1.5 text-xs ${
              liq?.status === 'Audited' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <p className="font-bold">Liquidation status: {liq?.status}</p>
              {liq?.dean_remarks && <p>Dean remarks: {liq.dean_remarks}</p>}
              {liq?.adviser_remarks && <p>Adviser remarks: {liq.adviser_remarks}</p>}
            </div>
          ) : activeTab === 'liquidation' && !canEditLiquidation ? (
            <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1.5">
              <FileCheck className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">No liquidation report submitted yet.</p>
              <p className="text-[11px] text-slate-400">Only the Officer who owns this proposal can submit one.</p>
            </div>
          ) : activeTab === 'liquidation' ? (
            <form onSubmit={handleLiquidationSubmit} className="space-y-4">
              {liq?.status === 'FOR_REVISION' && (liq.adviser_remarks || liq.dean_remarks) && (
                <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-900 text-xs space-y-1">
                  <p className="font-bold">Sent back for revision:</p>
                  {liq.adviser_remarks && <p>Adviser: {liq.adviser_remarks}</p>}
                  {liq.dean_remarks && <p>Dean: {liq.dean_remarks}</p>}
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-slate-700">Accounting Summary (editable)</h4>
                  <button
                    type="button"
                    onClick={addLine}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#00873E] hover:text-[#007033] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Category Line
                  </button>
                </div>
                {targetProposal.expenses.length === 0 && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    No expenses recorded yet — you can still author summary lines manually below.
                  </p>
                )}
                {summaryLines.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No summary lines yet. Click "Add Category Line" to start.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Category</th>
                          <th className="py-2 px-3 text-right">Items</th>
                          <th className="py-2 px-3 text-right">Amount Spent (₱)</th>
                          <th className="py-2 px-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {summaryLines.map((line, idx) => (
                          <tr key={idx}>
                            <td className="py-1.5 px-2">
                              <select
                                value={line.category}
                                onChange={(e) => updateLine(idx, { category: e.target.value })}
                                className="w-full px-1.5 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                              >
                                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="number" min={0} value={line.line_item_count}
                                onChange={(e) => updateLine(idx, { line_item_count: parseInt(e.target.value, 10) || 0 })}
                                className="w-16 px-1.5 py-1 text-xs text-right bg-white border border-slate-200 rounded-lg"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="number" min={0} step="0.01" value={line.spent}
                                onChange={(e) => updateLine(idx, { spent: parseFloat(e.target.value) || 0 })}
                                className="w-24 px-1.5 py-1 text-xs text-right font-mono font-bold bg-white border border-slate-200 rounded-lg"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <button type="button" onClick={() => removeLine(idx)} className="text-slate-400 hover:text-rose-600 cursor-pointer">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Liquidation Auditor Notes & Certification
                </label>
                <textarea
                  rows={2}
                  value={liquidationNotes}
                  onChange={(e) => setLiquidationNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#00873E] hover:bg-[#007033] text-white text-xs font-bold rounded-2xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                <FileCheck className="w-4 h-4" />
                <span>{liq?.status === 'FOR_REVISION' ? 'Resubmit for Adviser Review' : 'Submit for Adviser Review'}</span>
              </button>
            </form>
          ) : !canProcessReturn ? (
            <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1.5">
              <ArrowDownLeft className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">Budget return isn't available yet.</p>
              <p className="text-[11px] text-slate-400">The liquidation report must be fully Audited (Adviser + Dean approved) first.</p>
            </div>
          ) : (
            <form onSubmit={handleBudgetReturnSubmit} className="space-y-4">
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs space-y-2 text-amber-900">
                <div className="flex items-center gap-2 font-bold">
                  <ArrowDownLeft className="w-4 h-4 text-amber-700" />
                  <span>Double-Entry Cash-In Budget Return</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-amber-300 font-mono text-[11px] space-y-1 text-slate-800">
                  <p><strong>DEBIT:</strong> Cash on Hand (SAF Treasury Vault) ₱{unspentBalance.toFixed(2)}</p>
                  <p><strong>CREDIT:</strong> Unspent Event Budget Return Account ₱{unspentBalance.toFixed(2)}</p>
                </div>
                <p className="text-[11px] text-amber-800">
                  This transaction will automatically redeposit the ₱{unspentBalance.toLocaleString()} unspent balance back into the Student Activity Fund ledger.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Remarks / Return Notes
                </label>
                <textarea
                  rows={2}
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200"
                />
              </div>

              <button
                type="submit"
                disabled={unspentBalance <= 0}
                className="w-full py-3 bg-[#00873E] hover:bg-[#007033] disabled:bg-slate-300 text-white text-xs font-bold rounded-2xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Execute Cash-in Budget Return Double Entry</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
