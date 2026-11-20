import React from 'react';
import { Receipt, X, Lock, Image as ImageIcon } from 'lucide-react';

const peso = (n: number) => `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-800 border-amber-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 border-rose-200'
};

export interface ReimbursementDetailRow {
  amount_spent: number;
  date_submitted: string;
  reimbursement_status: string;
  remarks: string;
  officer_name: string;
  receipt_ref: string;
  expense_id: string;
  budget_title: string;
  department: string;
  expense?: { expense_desc?: string };
}

/** Read-only details of one reimbursement request (Officer and Adviser/Dean views). */
export const ReimbursementDetailModal: React.FC<{
  row: ReimbursementDetailRow;
  onClose: () => void;
  onOpenPhotos?: () => void;
  /** Small locked note under the details (e.g. "View only"). */
  note?: string;
  /** Extra buttons shown before Close (e.g. Approve / Reject). */
  actions?: React.ReactNode;
}> = ({ row, onClose, onOpenPhotos, note, actions }) => (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0B3D2E]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl border-t-4 border-t-[#F2B705] border border-slate-200 w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
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
            <p className="font-extrabold text-slate-900">{row.expense?.expense_desc || row.budget_title}</p>
            <p className="text-[11px] text-slate-500">{row.budget_title}</p>
          </div>
          <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_STYLES[row.reimbursement_status] || STATUS_STYLES.Pending}`}>
            {row.reimbursement_status === 'Pending' ? 'Pending Review' : row.reimbursement_status}
          </span>
        </div>
        <div className="rounded-xl bg-[#EEF4F0] border border-[#0B3D2E]/15 px-4 py-3 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B3D2E]/70">Amount to reimburse</span>
          <span className="font-mono text-lg font-black text-[#0B3D2E]">{peso(row.amount_spent)}</span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
          <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Department</dt><dd className="font-semibold text-slate-800">{row.department}</dd></div>
          <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filed by</dt><dd className="font-semibold text-slate-800">{row.officer_name || '-'}</dd></div>
          <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date submitted</dt><dd className="font-semibold text-slate-800">{row.date_submitted}</dd></div>
          <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">OR / Receipt No.</dt><dd className="font-semibold text-slate-800">{row.receipt_ref || '-'}</dd></div>
          <div className="col-span-2"><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Remarks</dt><dd className="text-slate-700 whitespace-pre-wrap">{row.remarks || '-'}</dd></div>
        </dl>
        {note && (
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Lock className="w-3.5 h-3.5 shrink-0" /> {note}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {onOpenPhotos && row.expense_id && (
            <button
              onClick={onOpenPhotos}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-white border border-[#0B3D2E]/20 hover:bg-[#EEF4F0] text-[#0B3D2E] transition cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5" /> Receipt Photos
            </button>
          )}
          {actions}
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#0B3D2E] hover:bg-[#072A20] text-white transition cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default ReimbursementDetailModal;
