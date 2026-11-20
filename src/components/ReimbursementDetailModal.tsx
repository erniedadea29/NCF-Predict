import React from 'react';
import { Receipt, X, Lock, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

export const peso = (n: number) => `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-800 border-amber-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  Partial: 'bg-sky-50 text-sky-800 border-sky-200'
};

export const statusLabel = (s: string) =>
  s === 'Pending' ? 'Pending Review' : s === 'Partial' ? 'Partly Approved' : s;

export interface ReimbursementDetailRow {
  id: string;
  amount_spent: number;
  date_submitted: string;
  reimbursement_status: string;
  remarks: string;
  officer_name: string;
  receipt_ref: string;
  expense_id: string;
  budget_id: string;
  budget_title: string;
  department: string;
  expense?: { expense_desc?: string };
}

/** Receipts filed together: same budget, same officer, same day. */
export interface ReimbursementGroup<T extends ReimbursementDetailRow> {
  key: string;
  budget_id: string;
  budget_title: string;
  department: string;
  officer_name: string;
  date_submitted: string;
  items: T[];
  total: number;
  pendingCount: number;
  /** Pending if any receipt still waits; otherwise Approved, Rejected or Partial. */
  status: 'Pending' | 'Approved' | 'Rejected' | 'Partial';
}

const isApproved = (s: string) => s === 'Approved' || s === 'Paid';

/**
 * Groups reimbursement receipts into one request per budget + officer + day,
 * so receipts filed in one submission are reviewed and approved together.
 */
export function groupReimbursements<T extends ReimbursementDetailRow>(rows: T[]): ReimbursementGroup<T>[] {
  const map = new Map<string, ReimbursementGroup<T>>();
  for (const r of rows) {
    const key = `${r.budget_id}|${r.officer_name}|${r.date_submitted}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key, budget_id: r.budget_id, budget_title: r.budget_title, department: r.department,
        officer_name: r.officer_name, date_submitted: r.date_submitted,
        items: [], total: 0, pendingCount: 0, status: 'Pending'
      };
      map.set(key, g);
    }
    g.items.push(r);
    g.total += r.amount_spent;
    if (r.reimbursement_status === 'Pending') g.pendingCount += 1;
  }
  for (const g of map.values()) {
    const approved = g.items.filter(i => isApproved(i.reimbursement_status)).length;
    g.status = g.pendingCount > 0 ? 'Pending'
      : approved === g.items.length ? 'Approved'
      : approved === 0 ? 'Rejected'
      : 'Partial';
  }
  return [...map.values()].sort((a, b) =>
    (a.status === 'Pending' ? 0 : 1) - (b.status === 'Pending' ? 0 : 1)
    || (b.date_submitted || '').localeCompare(a.date_submitted || ''));
}

/** Read-only details of one reimbursement request and all its receipts (Officer and Adviser/Dean views). */
export function ReimbursementGroupModal<T extends ReimbursementDetailRow>({
  group, onClose, onOpenPhotos, photosViewed, note, actions
}: {
  group: ReimbursementGroup<T>;
  onClose: () => void;
  onOpenPhotos?: (row: T) => void;
  /** Receipt ids whose photos were opened (shows a check next to them). */
  photosViewed?: Set<string>;
  /** Small locked note under the details (e.g. "View only"). */
  note?: string;
  /** Extra controls shown before Close (e.g. Approve / Reject). */
  actions?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0B3D2E]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border-t-4 border-t-[#F2B705] border border-slate-200 w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#0B3D2E] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Receipt className="w-5 h-5 shrink-0" />
            <h3 className="font-extrabold text-base truncate">Reimbursement Request</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-extrabold text-slate-900">{group.budget_title}</p>
              <p className="text-[11px] text-slate-500">
                {group.department} • Filed by {group.officer_name || '-'} • {group.date_submitted}
              </p>
            </div>
            <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_STYLES[group.status]}`}>
              {statusLabel(group.status)}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#F5F3EC] text-slate-700 text-left">
                  <th className="px-3 py-2 font-bold">Receipt</th>
                  <th className="px-3 py-2 font-bold">OR No.</th>
                  <th className="px-3 py-2 font-bold text-right">Amount</th>
                  {onOpenPhotos && <th className="px-3 py-2 font-bold text-center">Photo</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {group.items.map(r => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-900">{r.expense?.expense_desc || r.remarks || '-'}</p>
                      {group.items.length > 1 && r.reimbursement_status !== group.status && (
                        <span className={`inline-block mt-0.5 px-1.5 rounded-full border text-[9px] font-bold ${STATUS_STYLES[r.reimbursement_status] || STATUS_STYLES.Pending}`}>
                          {statusLabel(r.reimbursement_status)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600 whitespace-nowrap">{r.receipt_ref || '-'}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{peso(r.amount_spent)}</td>
                    {onOpenPhotos && (
                      <td className="px-3 py-2 text-center">
                        {r.expense_id ? (
                          <button
                            onClick={() => onOpenPhotos(r)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                              photosViewed?.has(r.id)
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                : 'bg-white border border-[#0B3D2E]/20 hover:bg-[#EEF4F0] text-[#0B3D2E]'
                            }`}
                          >
                            {photosViewed?.has(r.id) ? <CheckCircle2 className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />} View
                          </button>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#EEF4F0] border-t border-[#0B3D2E]/15">
                  <td className="px-3 py-2.5 font-bold text-[#0B3D2E]" colSpan={2}>
                    Total to reimburse ({group.items.length} receipt{group.items.length === 1 ? '' : 's'})
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-sm font-black text-[#0B3D2E] whitespace-nowrap">{peso(group.total)}</td>
                  {onOpenPhotos && <td />}
                </tr>
              </tfoot>
            </table>
          </div>

          {note && (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Lock className="w-3.5 h-3.5 shrink-0" /> {note}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {actions}
            <button onClick={onClose} className="flex-1 py-2 rounded-xl text-xs font-bold bg-white border border-[#0B3D2E]/20 hover:bg-[#EEF4F0] text-[#0B3D2E] transition cursor-pointer">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
