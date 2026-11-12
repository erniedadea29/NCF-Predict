import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LiquidationItem, LiquidationRecord } from '../types';
import { canPrepareLiquidation, liquidationItemsFromSummary, summarizeLiquidationItems } from '../utils/liquidation';
import { X, Check, FileCheck, ArrowDownLeft, ShieldCheck, Plus, Trash2, ThumbsUp, ThumbsDown, RotateCcw, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';

interface LiquidationReturnModalProps {
  proposalId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

/** An item row while it's being typed — amount stays a string so the field can be empty. */
interface DraftItem {
  description: string;
  category: string;
  amount: string;
  receipt_no: string;
}

const EXPENSE_CATEGORIES = ['Event', 'Academic', 'Operations', 'Capital'];
const emptyItem = (): DraftItem => ({ description: '', category: EXPENSE_CATEGORIES[0], amount: '', receipt_no: '' });
const peso = (n: number) => `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Read-only view of a submitted report, shown to reviewers and everyone else. */
const SubmittedReport: React.FC<{ liq: LiquidationRecord }> = ({ liq }) => {
  const items = liquidationItemsFromSummary(liq.accounting_summary);
  const total = liq.accounting_summary.reduce((s, l) => s + l.spent, 0);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase text-slate-700">Submitted Liquidation Report</h4>
        <span className="text-[11px] text-slate-500">
          {liq.submitted_by ? `By ${liq.submitted_by} • ` : ''}{liq.submitted_date}
        </span>
      </div>
      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
        <table className="w-full text-left">
          <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
            <tr>
              <th className="py-2 px-3">{items.length ? 'Expense' : 'Category'}</th>
              {items.length > 0 && <th className="py-2 px-3">Category</th>}
              <th className="py-2 px-3">{items.length ? 'OR / Receipt No.' : 'Items'}</th>
              <th className="py-2 px-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length > 0
              ? items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-1.5 px-3 font-medium text-slate-800">{item.description}</td>
                    <td className="py-1.5 px-3 text-slate-600">{item.category}</td>
                    <td className="py-1.5 px-3 font-mono text-slate-600">{item.receipt_no || '—'}</td>
                    <td className="py-1.5 px-3 text-right font-mono font-bold">{peso(item.amount)}</td>
                  </tr>
                ))
              : liq.accounting_summary.map((line, i) => (
                  <tr key={i}>
                    <td className="py-1.5 px-3 font-medium text-slate-800">{line.category}</td>
                    <td className="py-1.5 px-3 text-slate-600">{line.line_item_count}</td>
                    <td className="py-1.5 px-3 text-right font-mono font-bold">{peso(line.spent)}</td>
                  </tr>
                ))}
          </tbody>
          <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
            <tr>
              <td className="py-2 px-3" colSpan={items.length ? 3 : 2}>Total reported</td>
              <td className="py-2 px-3 text-right font-mono">{peso(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {liq.notes && (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
          <span className="font-bold block text-[10px] uppercase text-slate-500 mb-0.5">Treasurer's Certification</span>
          {liq.notes}
        </div>
      )}
    </div>
  );
};

export const LiquidationReturnModal: React.FC<LiquidationReturnModalProps> = ({
  proposalId,
  isOpen,
  onClose
}) => {
  const { proposals, submitLiquidation, recordBudgetReturn, currentUser, adviserReviewLiquidation, deanReviewLiquidation } = useApp();
  const [activeTab, setActiveTab] = useState<'liquidation' | 'return'>('liquidation');
  const [certification, setCertification] = useState('');
  const [returnRemarks, setReturnRemarks] = useState('Return of unused SAF event budget back to supreme treasury vault.');
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const targetProposal = proposals.find(p => p.id === proposalId);
  const liq = targetProposal?.liquidation;

  // Adviser -> Dean sequential review, mirroring the budget proposal workflow.
  const isAdviserPending = liq?.status === 'PENDING_ADVISER' && currentUser.role === 'csc_adviser';
  const isDeanPending = liq?.status === 'PENDING_DEAN' && currentUser.role === 'dean';
  // Only the Treasurer who filed this budget request prepares its liquidation
  // report — first submission, or a resubmission after FOR_REVISION.
  const isPreparer = targetProposal ? canPrepareLiquidation(targetProposal, currentUser) : false;
  const canEditLiquidation = isPreparer && (!liq || liq.status === 'FOR_REVISION');
  const canProcessReturn = liq?.status === 'Audited';

  // The form starts BLANK: the Treasurer authors every line. The only thing
  // ever pre-filled is their own previous submission when it was sent back
  // for revision, so they can correct it instead of retyping everything.
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('liquidation');
    setReviewRemarks('');
    if (liq?.status === 'FOR_REVISION') {
      const previous = liquidationItemsFromSummary(liq.accounting_summary);
      setItems(previous.length
        ? previous.map(i => ({ ...i, amount: String(i.amount) }))
        : [emptyItem()]);
      setCertification(liq.notes || '');
    } else {
      setItems([emptyItem()]);
      setCertification('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, proposalId]);

  if (!isOpen || !proposalId || !targetProposal) return null;

  const totalReleased = targetProposal.cashouts.reduce((s, c) => s + c.amount_released, 0) || targetProposal.total_budget_amount;
  const recordedSpent = targetProposal.expenses.reduce((s, e) => s + e.amount_spent, 0);
  const unspentBalance = Math.max(0, totalReleased - recordedSpent);

  const reportTotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const matchesRecorded = Math.abs(reportTotal - recordedSpent) < 0.005;
  const exceedsReleased = reportTotal - totalReleased > 0.005;

  const updateItem = (idx: number, updates: Partial<DraftItem>) =>
    setItems(prev => prev.map((item, i) => (i === idx ? { ...item, ...updates } : item)));
  const removeItem = (idx: number) => setItems(prev => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : [emptyItem()]));
  const addItem = () => setItems(prev => [...prev, emptyItem()]);

  const handleLiquidationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = items.filter(i => i.description.trim() || i.amount.trim() || i.receipt_no.trim());
    if (filled.length === 0) {
      alert('Add at least one expense to the liquidation report.');
      return;
    }
    const invalid = filled.findIndex(i => !i.description.trim() || !(parseFloat(i.amount) > 0));
    if (invalid !== -1) {
      alert(`Expense #${invalid + 1}: enter a description and an amount greater than 0.`);
      return;
    }
    // Certification / notes are optional: the itemized expenses are the report.
    if (exceedsReleased && !confirm(`Your report total (${peso(reportTotal)}) is MORE than the funds released (${peso(totalReleased)}). Submit anyway?`)) {
      return;
    }
    if (!matchesRecorded && !exceedsReleased && !confirm(`Your report total (${peso(reportTotal)}) does not match the expenses recorded in the system (${peso(recordedSpent)}). Submit anyway?`)) {
      return;
    }

    const finalItems: LiquidationItem[] = filled.map(i => ({
      description: i.description.trim(),
      category: i.category,
      amount: Math.round(parseFloat(i.amount) * 100) / 100,
      receipt_no: i.receipt_no.trim()
    }));

    setSubmitting(true);
    const ok = await submitLiquidation(targetProposal.id, summarizeLiquidationItems(finalItems), certification.trim());
    setSubmitting(false);
    if (ok) onClose();
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

  const preparerName = targetProposal.created_by_officer || 'the Treasurer who filed this request';

  const statusMessage = (() => {
    if (!liq) return null;
    switch (liq.status) {
      case 'PENDING_ADVISER': return { tone: 'slate', text: 'Awaiting Adviser review.' };
      case 'PENDING_DEAN': return { tone: 'slate', text: 'Endorsed by the Adviser. Awaiting Dean review.' };
      case 'FOR_REVISION': return { tone: 'orange', text: `Sent back for revision. Waiting for ${preparerName} to resubmit.` };
      case 'Audited': return { tone: 'emerald', text: 'Audited: approved by the Adviser and the Dean.' };
      case 'Rejected': return { tone: 'rose', text: 'Rejected.' };
      default: return { tone: 'slate', text: `Status: ${liq.status}` };
    }
  })();
  const toneClass: Record<string, string> = {
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    rose: 'bg-rose-50 border-rose-200 text-rose-900'
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4">
        {/* Header */}
        <div className="px-6 py-4 bg-[#00873E] text-white flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base">Liquidation Report & Budget Return</h3>
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
            1. Liquidation Report
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

        <div className="p-6 space-y-5">
          {/* Financial Overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Total Released</span>
              <p className="text-sm sm:text-base font-extrabold text-slate-800 mt-0.5">{peso(totalReleased)}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Recorded Expenses</span>
              <p className="text-sm sm:text-base font-extrabold text-slate-800 mt-0.5">{peso(recordedSpent)}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
              <span className="text-[10px] text-emerald-700 font-bold uppercase">Unspent Balance</span>
              <p className="text-sm sm:text-base font-black text-[#00873E] mt-0.5">{peso(unspentBalance)}</p>
            </div>
          </div>

          {activeTab === 'liquidation' && canEditLiquidation ? (
            /* ---------- Treasurer authoring form (blank) ---------- */
            <form onSubmit={handleLiquidationSubmit} className="space-y-4">
              {liq?.status === 'FOR_REVISION' && (liq.adviser_remarks || liq.dean_remarks) && (
                <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-900 text-xs space-y-1">
                  <p className="font-bold">Sent back for revision. Correct your report and resubmit:</p>
                  {liq.adviser_remarks && <p>Adviser: {liq.adviser_remarks}</p>}
                  {liq.dean_remarks && <p>Dean: {liq.dean_remarks}</p>}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-700">Itemized Expenses</h4>
                    <p className="text-[11px] text-slate-500">List every expense paid from this budget, with its official receipt number.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#00873E] hover:text-[#007033] cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Expense
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-x-auto text-xs">
                  <table className="w-full text-left min-w-[560px]">
                    <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-2 w-8">#</th>
                        <th className="py-2 px-2">Description</th>
                        <th className="py-2 px-2 w-28">Category</th>
                        <th className="py-2 px-2 w-32">OR / Receipt No.</th>
                        <th className="py-2 px-2 w-28 text-right">Amount (₱)</th>
                        <th className="py-2 px-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 px-2 text-slate-400 font-bold">{idx + 1}</td>
                          <td className="py-1.5 px-2">
                            <input
                              type="text"
                              placeholder="e.g. Snacks for 50 participants"
                              value={item.description}
                              onChange={(e) => updateItem(idx, { description: e.target.value })}
                              className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <select
                              value={item.category}
                              onChange={(e) => updateItem(idx, { category: e.target.value })}
                              className="w-full px-1.5 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                            >
                              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="text"
                              placeholder="OR-00123"
                              value={item.receipt_no}
                              onChange={(e) => updateItem(idx, { receipt_no: e.target.value })}
                              className="w-full px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="0.00"
                              value={item.amount}
                              onChange={(e) => updateItem(idx, { amount: e.target.value })}
                              className="w-full px-2 py-1 text-xs text-right font-mono font-bold bg-white border border-slate-200 rounded-lg"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <button type="button" onClick={() => removeItem(idx)} title="Remove" className="text-slate-400 hover:text-rose-600 cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                      <tr>
                        <td className="py-2 px-2" colSpan={4}>Total in your report</td>
                        <td className="py-2 px-2 text-right font-mono">{peso(reportTotal)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {reportTotal > 0 && (
                  <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-[11px] ${
                    exceedsReleased
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : matchesRecorded
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    {matchesRecorded && !exceedsReleased
                      ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      : <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                    <span>
                      {exceedsReleased
                        ? `Your total is ${peso(reportTotal - totalReleased)} MORE than the funds released (${peso(totalReleased)}).`
                        : matchesRecorded
                        ? 'Your total matches the expenses recorded in the system.'
                        : `Your total differs from the recorded expenses (${peso(recordedSpent)}) by ${peso(Math.abs(reportTotal - recordedSpent))}. Double-check your receipts.`}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Certification & Notes <span className="normal-case font-medium text-slate-400">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. I certify that the expenses listed above were incurred for the approved activity and are supported by the attached official receipts."
                  value={certification}
                  onChange={(e) => setCertification(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-[#00873E] hover:bg-[#007033] disabled:bg-slate-300 text-white text-xs font-bold rounded-2xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                <FileCheck className="w-4 h-4" />
                <span>{submitting ? 'Submitting...' : liq?.status === 'FOR_REVISION' ? 'Resubmit for Adviser Review' : 'Submit for Adviser Review'}</span>
              </button>
            </form>
          ) : activeTab === 'liquidation' && !liq ? (
            /* ---------- Not submitted yet, viewer isn't the preparer ---------- */
            <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1.5">
              <Lock className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">No liquidation report submitted yet.</p>
              <p className="text-[11px] text-slate-400">
                Only {preparerName} can prepare the liquidation report for this budget request.
              </p>
            </div>
          ) : activeTab === 'liquidation' && liq ? (
            /* ---------- Submitted report: review panel or read-only ---------- */
            <div className="space-y-4">
              <SubmittedReport liq={liq} />

              {(isAdviserPending || isDeanPending) ? (
                <div className={`p-4 rounded-2xl border space-y-2 ${isAdviserPending ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                  <span className={`font-bold text-xs block ${isAdviserPending ? 'text-emerald-900' : 'text-rose-900'}`}>
                    {isAdviserPending ? 'Adviser Review' : 'Dean Final Review'}
                  </span>
                  <p className={`text-xs ${isAdviserPending ? 'text-emerald-800' : 'text-rose-800'}`}>
                    {isAdviserPending
                      ? 'Check the itemized expenses and receipts above, then forward to the Dean, send back for revision, or reject.'
                      : 'This report was endorsed by the Adviser. Approve to certify it as Audited, send it back for revision, or reject it.'}
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
              ) : statusMessage && (
                <div className={`p-3 rounded-2xl border text-xs space-y-1 ${toneClass[statusMessage.tone]}`}>
                  <p className="font-bold flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> {statusMessage.text}</p>
                  {liq.adviser_remarks && <p>Adviser remarks: {liq.adviser_remarks}</p>}
                  {liq.dean_remarks && <p>Dean remarks: {liq.dean_remarks}</p>}
                </div>
              )}
            </div>
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
