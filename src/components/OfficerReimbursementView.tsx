import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { DEPARTMENTS } from '../data/mockData';
import { downloadCsv } from '../utils/csvExport';
import { ReceiptPhotosModal } from './ReceiptPhotosModal';
import { expensePhotoFolder, receiptFileProblem, uploadExpensePhotos } from '../utils/receiptPhotos';
import { Receipt, Send, Clock, CheckCircle2, XCircle, Download, Search, Info, Camera, X, Plus, Image as ImageIcon } from 'lucide-react';

const peso = (n: number) => `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface ReceiptLine { key: number; desc: string; amount: string; receiptNo: string; files: File[] }
const emptyLine = (key: number): ReceiptLine => ({ key, desc: '', amount: '', receiptNo: '', files: [] });
const lineAmount = (l: ReceiptLine) => Math.round((parseFloat(l.amount) || 0) * 100) / 100;
const lineComplete = (l: ReceiptLine) => l.desc.trim() !== '' && lineAmount(l) > 0;

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-800 border-amber-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 border-rose-200'
};

/**
 * Officers' Reimbursement page, separate from Budget & Proposals: file a
 * reimbursement request for something paid out of pocket on an approved
 * budget (describing a new expense, or claiming one already recorded), and
 * track every reimbursement request of the department. Adviser/Dean review
 * these in their own Reimbursement tab (ReimbursementReviewPanel).
 */
export const OfficerReimbursementView: React.FC = () => {
  const { scopedProposals, requestReimbursement, submitReimbursementProposal, isDepartmentRestricted, userDepartment } = useApp();

  const [proposalId, setProposalId] = useState('');
  // 'new' = describe the out-of-pocket expense here; 'recorded' = claim an expense already recorded on the budget.
  const [mode, setMode] = useState<'new' | 'recorded'>('new');
  const [expenseId, setExpenseId] = useState('');
  // 'new' mode: one line per receipt. Each line is saved as its own expense +
  // reimbursement request so every receipt stays separate for audit.
  const lineKey = useRef(1);
  const [lines, setLines] = useState<ReceiptLine[]>([emptyLine(0)]);
  const [lineError, setLineError] = useState<{ key: number; text: string } | null>(null);
  const linePhotoInputRef = useRef<HTMLInputElement>(null);
  const linePhotoTarget = useRef<number | null>(null);

  const updateLine = (key: number, patch: Partial<ReceiptLine>) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));
  const addLine = () => setLines(prev => [...prev, emptyLine(lineKey.current++)]);
  const removeLine = (key: number) => setLines(prev => prev.length > 1 ? prev.filter(l => l.key !== key) : prev);
  const addLinePhotos = (files: File[]) => {
    const key = linePhotoTarget.current;
    if (linePhotoInputRef.current) linePhotoInputRef.current.value = '';
    if (key === null) return;
    const problems = files.map(receiptFileProblem).filter(Boolean) as string[];
    setLineError(problems.length > 0 ? { key, text: problems.join(' ') } : null);
    setLines(prev => prev.map(l => l.key === key ? { ...l, files: [...l.files, ...files.filter(f => !receiptFileProblem(f))] } : l));
  };

  // Receipt photos picked in the form ('recorded' mode); uploaded once the request is saved.
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photosFor, setPhotosFor] = useState<{ title: string; subtitle: string; department: string; proposalId: string; expenseId: string; legacyPath?: string } | null>(null);

  const addPhotoFiles = (files: File[]) => {
    const problems = files.map(receiptFileProblem).filter(Boolean) as string[];
    setPhotoError(problems.join(' '));
    setPhotoFiles(prev => [...prev, ...files.filter(f => !receiptFileProblem(f))]);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState('');

  // Only approved & released budgets can be reimbursed from.
  const releasedProposals = scopedProposals.filter(p => p.budget_status === 'APPROVED_RELEASED');
  const selectedProposal = releasedProposals.find(p => p.id === proposalId);

  // An expense can be claimed once, unless its earlier request was rejected.
  const eligibleExpenses = useMemo(() => {
    if (!selectedProposal) return [];
    const activeClaims = new Set(
      selectedProposal.reimbursements.filter(r => r.reimbursement_status !== 'Rejected').map(r => r.expense_id)
    );
    return selectedProposal.expenses.filter(e => !activeClaims.has(e.id));
  }, [selectedProposal]);
  const selectedExpense = eligibleExpenses.find(e => e.id === expenseId);

  const rows = useMemo(() => scopedProposals
    .flatMap(p => p.reimbursements.map(r => ({
      ...r,
      budget_title: p.budget_title,
      department: p.department,
      expense: p.expenses.find(e => e.id === r.expense_id)
    })))
    .sort((a, b) => (b.date_submitted || '').localeCompare(a.date_submitted || '')),
  [scopedProposals]);

  const term = search.trim().toLowerCase();
  const listed = term
    ? rows.filter(r => [r.budget_title, r.department, r.officer_name, r.receipt_ref, r.reimbursement_status, r.remarks, r.expense?.expense_desc]
        .some(f => (f || '').toLowerCase().includes(term)))
    : rows;

  const sum = (status: string[]) => rows.filter(r => status.includes(r.reimbursement_status)).reduce((s, r) => s + r.amount_spent, 0);
  const count = (status: string[]) => rows.filter(r => status.includes(r.reimbursement_status)).length;

  const linesTotal = lines.reduce((s, l) => s + lineAmount(l), 0);
  const canSubmit = Boolean(selectedProposal) && (mode === 'recorded'
    ? Boolean(selectedExpense)
    : lines.length > 0 && lines.every(lineComplete));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!selectedProposal) {
      setMessage({ ok: false, text: 'Choose the approved budget this expense was for.' });
      return;
    }

    if (mode === 'recorded') {
      if (!selectedExpense) { setMessage({ ok: false, text: 'Choose the expense you paid for.' }); return; }
      const amount = selectedExpense.amount_spent;
      setSubmitting(true);
      const ok = await requestReimbursement(selectedExpense.id, selectedProposal.id, amount, remarks.trim());
      if (ok && photoFiles.length > 0) {
        const errs = await uploadExpensePhotos(expensePhotoFolder(selectedProposal.department, selectedProposal.id, selectedExpense.id), photoFiles);
        if (errs.length > 0) alert(`Some receipt photos were NOT uploaded:\n\n${errs.join('\n')}\n\nYou can add them again from the request's Photos button.`);
      }
      setSubmitting(false);
      if (ok) {
        setMessage({ ok: true, text: `Reimbursement of ${peso(amount)} requested. It's now waiting for Adviser/Dean review.` });
        setExpenseId('');
        setPhotoFiles([]);
        setPhotoError('');
        setRemarks('');
      }
      return;
    }

    if (!lines.every(lineComplete)) {
      setMessage({ ok: false, text: 'Each receipt needs what you paid for and an amount greater than ₱0.' });
      return;
    }

    // One expense + reimbursement request per receipt, saved one after another.
    setSubmitting(true);
    const failed: ReceiptLine[] = [];
    let savedCount = 0;
    let savedTotal = 0;
    for (const line of lines) {
      const ok = await submitReimbursementProposal(selectedProposal.id, {
        description: line.desc.trim(), amount: lineAmount(line), receiptNo: line.receiptNo.trim(),
        remarks: remarks.trim(), proof: null, files: line.files
      });
      if (ok) { savedCount++; savedTotal += lineAmount(line); } else failed.push(line);
    }
    setSubmitting(false);

    if (failed.length === 0) {
      setMessage({ ok: true, text: `${savedCount} reimbursement request(s) totaling ${peso(savedTotal)} sent. They're now waiting for Adviser/Dean review.` });
      setLines([emptyLine(lineKey.current++)]);
      setLineError(null);
      setRemarks('');
    } else {
      // Keep only the receipts that failed so they can be retried.
      setLines(failed);
      setMessage({ ok: false, text: `${savedCount} saved (${peso(savedTotal)}), but ${failed.length} receipt(s) failed. They're still in the form; try again.` });
    }
  };

  const exportCsv = () => {
    downloadCsv('NCF_Reimbursements.csv',
      ['Budget Title', 'Department', 'Expense', 'Claimant', 'Receipt Ref', 'Date Submitted', 'Amount (PHP)', 'Status', 'Remarks'],
      listed.map(r => [r.budget_title, r.department, r.expense?.expense_desc || '', r.officer_name, r.receipt_ref || 'N/A',
        r.date_submitted, r.amount_spent.toFixed(2), r.reimbursement_status, r.remarks || '']));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            Reimbursement
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Claim back expenses you paid out of pocket for an approved budget • {isDepartmentRestricted ? `${userDepartment} only` : 'All departments'}
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={listed.length === 0}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 text-slate-700 transition cursor-pointer disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" /> Export Report (CSV)
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <span className="text-[10px] font-bold uppercase text-amber-700 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Pending Review</span>
          <p className="text-lg font-black text-slate-900">{peso(sum(['Pending']))}</p>
          <p className="text-[11px] text-slate-400">{count(['Pending'])} request(s)</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <span className="text-[10px] font-bold uppercase text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Approved / Paid</span>
          <p className="text-lg font-black text-slate-900">{peso(sum(['Approved', 'Paid']))}</p>
          <p className="text-[11px] text-slate-400">{count(['Approved', 'Paid'])} request(s)</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <span className="text-[10px] font-bold uppercase text-rose-700 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Rejected</span>
          <p className="text-lg font-black text-slate-900">{peso(sum(['Rejected']))}</p>
          <p className="text-[11px] text-slate-400">{count(['Rejected'])} request(s)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Request form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 self-start">
          <h3 className="text-sm font-black text-slate-900">New Reimbursement Request</h3>

          {releasedProposals.length === 0 ? (
            <p className="text-xs text-slate-500 flex items-start gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <Info className="w-4 h-4 shrink-0 text-slate-400" />
              Reimbursements can be requested once a budget proposal is approved and its funds are released.
            </p>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Approved Budget *</label>
                <select
                  value={proposalId}
                  onChange={(e) => { setProposalId(e.target.value); setExpenseId(''); setMessage(null); }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 font-semibold"
                >
                  <option value="">Select a budget...</option>
                  {releasedProposals.map(p => (
                    <option key={p.id} value={p.id}>{p.department} - {p.budget_title}</option>
                  ))}
                </select>
              </div>

              {selectedProposal && (
                <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-[11px] font-bold">
                  {([
                    { key: 'new', label: 'New expense' },
                    { key: 'recorded', label: `Recorded expense (${eligibleExpenses.length})` }
                  ] as const).map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => { setMode(tab.key); setMessage(null); }}
                      className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${mode === tab.key ? 'bg-white text-[#00873E] shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {selectedProposal && mode === 'new' && (
                <>
                  <p className="text-[11px] text-slate-500">
                    Amount = what you paid out of your own pocket (what should be returned to you). Each receipt is also recorded as an expense under the selected budget.
                  </p>
                  {lines.map((line, idx) => (
                    <div key={line.key} className="space-y-2 p-3 rounded-xl border border-slate-200 bg-slate-50/60">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Receipt {idx + 1}</span>
                        {lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(line.key)} className="flex items-center gap-0.5 text-[11px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer">
                            <X className="w-3.5 h-3.5" /> Remove
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">What You Paid For *</label>
                        <input
                          type="text"
                          value={line.desc}
                          onChange={(e) => updateLine(line.key, { desc: e.target.value })}
                          placeholder="e.g. Snacks for 50 participants"
                          className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Amount (₱) *</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.amount}
                            onChange={(e) => updateLine(line.key, { amount: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-3 py-2 text-xs font-mono font-bold bg-white rounded-xl border border-slate-200"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">OR / Receipt No.</label>
                          <input
                            type="text"
                            value={line.receiptNo}
                            onChange={(e) => updateLine(line.key, { receiptNo: e.target.value })}
                            placeholder="OR-00123"
                            className="w-full px-3 py-2 text-xs font-mono bg-white rounded-xl border border-slate-200"
                          />
                        </div>
                      </div>
                      {line.files.length > 0 && (
                        <div className="space-y-1">
                          {line.files.map((f, i) => (
                            <div key={`${f.name}_${i}`} className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px]">
                              <span className="flex items-center gap-1.5 min-w-0 font-semibold text-emerald-900">
                                <ImageIcon className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{f.name}</span>
                              </span>
                              <button type="button" onClick={() => updateLine(line.key, { files: line.files.filter((_, j) => j !== i) })} className="text-emerald-700 hover:text-emerald-900 cursor-pointer shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => { linePhotoTarget.current = line.key; linePhotoInputRef.current?.click(); }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-dashed border-slate-300 hover:border-[#00873E] rounded-xl text-[11px] font-bold text-slate-600 hover:text-[#00873E] transition cursor-pointer bg-white"
                      >
                        <Camera className="w-3.5 h-3.5" /> {line.files.length > 0 ? 'Add Another Photo / File' : 'Receipt Photo (optional)'}
                      </button>
                      {lineError?.key === line.key && <p className="text-[11px] text-rose-600 font-semibold">{lineError.text}</p>}
                    </div>
                  ))}
                  <input
                    ref={linePhotoInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => addLinePhotos(Array.from(e.target.files || []))}
                  />
                  <button
                    type="button"
                    onClick={addLine}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#00873E] text-[#00873E] hover:bg-emerald-50 text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Another Receipt
                  </button>
                  <div className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                    <span className="font-bold text-emerald-900">Total to reimburse ({lines.length} receipt{lines.length > 1 ? 's' : ''})</span>
                    <span className="font-black font-mono text-emerald-900">{peso(linesTotal)}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">JPG, PNG, WEBP or PDF, max 8MB each. View or add more photos later from each request's Photos button.</p>
                </>
              )}

              {selectedProposal && mode === 'recorded' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Expense You Paid For *</label>
                  {eligibleExpenses.length === 0 ? (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                      No recorded expenses left to claim on this budget. Use "New expense" instead.
                    </p>
                  ) : (
                    <select
                      value={expenseId}
                      onChange={(e) => setExpenseId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 font-semibold"
                    >
                      <option value="">Select an expense...</option>
                      {eligibleExpenses.map(e => (
                        <option key={e.id} value={e.id}>{e.expense_desc} • {peso(e.amount_spent)} ({e.date_incurred})</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {selectedProposal && mode === 'recorded' && selectedExpense && (
                <div className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <span className="font-bold text-emerald-900">Amount to reimburse</span>
                  <span className="font-black font-mono text-emerald-900">{peso(selectedExpense.amount_spent)}</span>
                </div>
              )}

              {selectedProposal && mode === 'recorded' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Receipt Photos / Scans (optional)</label>
                  {photoFiles.length > 0 && (
                    <div className="space-y-1">
                      {photoFiles.map((f, i) => (
                        <div key={`${f.name}_${i}`} className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px]">
                          <span className="flex items-center gap-1.5 min-w-0 font-semibold text-emerald-900">
                            <ImageIcon className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{f.name}</span>
                          </span>
                          <button type="button" onClick={() => setPhotoFiles(prev => prev.filter((_, j) => j !== i))} className="text-emerald-700 hover:text-emerald-900 cursor-pointer shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 border-2 border-dashed border-slate-300 hover:border-[#00873E] rounded-xl text-xs font-bold text-slate-600 hover:text-[#00873E] transition cursor-pointer"
                  >
                    <Camera className="w-4 h-4" /> {photoFiles.length > 0 ? 'Add Another Photo / File' : 'Take Photo / Choose File'}
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => addPhotoFiles(Array.from(e.target.files || []))}
                  />
                  {photoError && <p className="text-[11px] text-rose-600 font-semibold">{photoError}</p>}
                  <p className="text-[10px] text-slate-400">JPG, PNG, WEBP or PDF, max 8MB each. Saved with the request; view or add more later from its Photos button.</p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Remarks <span className="normal-case font-medium text-slate-400">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Paid by cash at the supplier on the day of the event."
                  className="w-full px-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className="w-full py-2.5 bg-[#00873E] hover:bg-[#007033] disabled:bg-slate-300 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" /> {submitting ? 'Submitting...' : mode === 'new' && lines.length > 1 ? `Request Reimbursement (${lines.length} receipts)` : 'Request Reimbursement'}
              </button>
            </>
          )}

          {message && (
            <p className={`text-xs rounded-xl px-3 py-2 border ${message.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              {message.text}
            </p>
          )}
        </form>

        {/* Requests list */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 overflow-hidden self-start">
          <div className="p-3 border-b border-slate-100 flex items-center gap-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider shrink-0">
              Requests ({term ? `${listed.length} of ${rows.length}` : rows.length})
            </h3>
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search budget, expense, status..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 rounded-lg border border-slate-200"
              />
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
            {listed.map(r => (
              <div key={r.id} className="p-3.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-900 truncate">{r.expense?.expense_desc || r.budget_title}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {r.budget_title} • {r.officer_name} • {r.date_submitted}{r.receipt_ref ? ` • ${r.receipt_ref}` : ''}
                  </p>
                  {r.remarks && <p className="text-[11px] text-slate-400 truncate">{r.remarks}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black border ${DEPARTMENTS[r.department]?.badgeBg}`}>{r.department}</span>
                    <span className="font-mono text-sm font-bold text-slate-900">{peso(r.amount_spent)}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_STYLES[r.reimbursement_status] || STATUS_STYLES.Pending}`}>
                    {r.reimbursement_status === 'Pending' ? 'Pending Review' : r.reimbursement_status}
                  </span>
                  {r.expense_id && (
                    <button
                      onClick={() => setPhotosFor({
                        title: r.expense?.expense_desc || r.budget_title,
                        subtitle: `${r.budget_title} • ${r.officer_name}${r.receipt_ref ? ` • ${r.receipt_ref}` : ''}`,
                        department: r.department, proposalId: r.budget_id, expenseId: r.expense_id,
                        legacyPath: r.expense?.proof_attach?.[0]?.url
                      })}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                    >
                      <ImageIcon className="w-3 h-3" /> Photos
                    </button>
                  )}
                </div>
              </div>
            ))}
            {listed.length === 0 && (
              <div className="p-10 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <Clock className="w-6 h-6 text-slate-300" />
                {rows.length === 0 ? 'No reimbursement requests yet.' : `No requests match "${search.trim()}".`}
              </div>
            )}
          </div>
        </div>
      </div>

      {photosFor && (
        <ReceiptPhotosModal {...photosFor} canAdd onClose={() => setPhotosFor(null)} />
      )}
    </div>
  );
};

export default OfficerReimbursementView;
