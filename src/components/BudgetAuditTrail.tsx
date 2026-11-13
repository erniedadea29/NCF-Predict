import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BudgetProposal } from '../types';
import { downloadCsv } from '../utils/csvExport';
import { ReceiptPhotosModal } from './ReceiptPhotosModal';
import { ClipboardList, Download, Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react';

const peso = (n: number) => `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Section: React.FC<{ title: string; count: number; total?: string; children: React.ReactNode }> = ({ title, count, total, children }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-500">
      <span>{title} ({count})</span>
      {total && <span className="font-mono text-slate-700">{total}</span>}
    </div>
    {count === 0
      ? <p className="text-[11px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2">None recorded.</p>
      : <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">{children}</div>}
  </div>
);

const Row: React.FC<{ main: string; sub: string; amount: string; badge?: string; badgeClass?: string; action?: React.ReactNode }> = ({ main, sub, amount, badge, badgeClass, action }) => (
  <div className="px-3 py-2 flex items-center justify-between gap-2 text-xs bg-white">
    <div className="min-w-0">
      <p className="font-semibold text-slate-900 truncate">{main}</p>
      <p className="text-[10px] text-slate-500 truncate">{sub}</p>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      {badge && <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeClass || 'bg-slate-50 border-slate-200 text-slate-600'}`}>{badge}</span>}
      <span className="font-mono font-bold text-slate-900">{amount}</span>
      {action}
    </div>
  </div>
);

/**
 * Everything recorded under one approved budget, in one place, for audit:
 * released funds, expense transactions (with receipt photos),
 * reimbursements, the liquidation report and the budget return.
 */
export const BudgetAuditTrail: React.FC<{ proposal: BudgetProposal }> = ({ proposal }) => {
  const { transactions } = useApp();
  const [open, setOpen] = useState(true);
  const [photosFor, setPhotosFor] = useState<{ title: string; subtitle: string; department: string; proposalId: string; expenseId: string; legacyPath?: string } | null>(null);

  const released = proposal.cashouts.reduce((s, c) => s + c.amount_released, 0);
  const spent = proposal.expenses.reduce((s, e) => s + e.amount_spent, 0);
  const reimbursed = proposal.reimbursements.filter(r => r.reimbursement_status !== 'Rejected').reduce((s, r) => s + r.amount_spent, 0);
  const returned = proposal.budget_return?.amount_returned || 0;
  const balance = (released || proposal.total_budget_amount) - spent - returned;
  const txById = new Map(transactions.map(t => [t.id, t]));

  const exportCsv = () => {
    const rows: (string | number)[][] = [];
    proposal.cashouts.forEach(c => rows.push(['Fund Release', c.date_released, c.voucher_no || c.id, c.purpose, c.cashout_status, c.amount_released.toFixed(2)]));
    proposal.expenses.forEach(e => {
      const tx = txById.get(e.id);
      rows.push(['Expense', e.date_incurred, tx?.reference_code || e.id, e.expense_desc, tx?.status || '', e.amount_spent.toFixed(2)]);
    });
    proposal.reimbursements.forEach(r => rows.push(['Reimbursement', r.date_submitted, r.receipt_ref, `${r.officer_name}: ${r.remarks}`, r.reimbursement_status, r.amount_spent.toFixed(2)]));
    if (proposal.liquidation) {
      const l = proposal.liquidation;
      rows.push(['Liquidation', l.submitted_date, l.id, `Released ${l.total_released.toFixed(2)} / Spent ${l.total_spent.toFixed(2)} / Balance ${l.balance.toFixed(2)}`, l.status, l.total_spent.toFixed(2)]);
    }
    if (proposal.budget_return) {
      const b = proposal.budget_return;
      rows.push(['Budget Return', b.date_returned, b.cash_in_reference, b.remarks, 'Returned', b.amount_returned.toFixed(2)]);
    }
    downloadCsv(`NCF_Audit_${proposal.department}_${proposal.budget_title.replace(/[^a-zA-Z0-9]+/g, '_')}.csv`,
      ['Type', 'Date', 'Reference', 'Details', 'Status', 'Amount (PHP)'], rows);
  };

  return (
    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider text-slate-800 cursor-pointer">
          <ClipboardList className="w-4 h-4 text-emerald-600" />
          Audit Trail: everything under this budget
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <button onClick={exportCsv} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer">
          <Download className="w-3.5 h-3.5" /> Export (CSV)
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
        {[
          ['Approved', peso(proposal.total_budget_amount)],
          ['Released', peso(released)],
          ['Spent', peso(spent)],
          ['Reimbursed', peso(reimbursed)],
          ['Balance', peso(balance)]
        ].map(([label, value]) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 px-2.5 py-2">
            <p className="font-bold uppercase text-slate-400 text-[10px]">{label}</p>
            <p className={`font-mono font-black ${label === 'Balance' && balance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{value}</p>
          </div>
        ))}
      </div>

      {open && (
        <div className="space-y-3">
          <Section title="Funds Released" count={proposal.cashouts.length} total={peso(released)}>
            {proposal.cashouts.map(c => (
              <Row key={c.id} main={c.purpose || 'Fund release'} sub={`${c.date_released}${c.voucher_no ? ` • ${c.voucher_no}` : ''}`}
                amount={peso(c.amount_released)} badge={c.cashout_status} />
            ))}
          </Section>

          <Section title="Expense Transactions" count={proposal.expenses.length} total={peso(spent)}>
            {proposal.expenses.map(e => {
              const tx = txById.get(e.id);
              return (
                <Row key={e.id} main={e.expense_desc} sub={`${e.date_incurred} • ${tx?.reference_code || e.category}`}
                  amount={peso(e.amount_spent)}
                  badge={tx?.status === 'Pending' ? 'Pending Review' : (e.reimbursement_status !== 'None' ? `Reimb. ${e.reimbursement_status}` : undefined)}
                  badgeClass={tx?.status === 'Pending' ? 'bg-amber-50 border-amber-200 text-amber-800' : undefined}
                  action={
                    <button
                      onClick={() => setPhotosFor({
                        title: e.expense_desc, subtitle: `${proposal.budget_title} • ${e.date_incurred}`,
                        department: proposal.department, proposalId: proposal.id, expenseId: e.id,
                        legacyPath: e.proof_attach?.[0]?.url
                      })}
                      className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer" title="Receipt photos"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                    </button>
                  } />
              );
            })}
          </Section>

          <Section title="Reimbursements" count={proposal.reimbursements.length} total={peso(reimbursed)}>
            {proposal.reimbursements.map(r => (
              <Row key={r.id} main={`${r.officer_name}${r.remarks ? `: ${r.remarks}` : ''}`} sub={`${r.date_submitted} • ${r.receipt_ref || 'No receipt no.'}`}
                amount={peso(r.amount_spent)} badge={r.reimbursement_status}
                badgeClass={r.reimbursement_status === 'Rejected' ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : r.reimbursement_status === 'Pending' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-700'} />
            ))}
          </Section>

          <Section title="Liquidation Report" count={proposal.liquidation ? 1 : 0}>
            {proposal.liquidation && (
              <Row main={`Submitted by ${proposal.liquidation.submitted_by || 'officer'}`}
                sub={`${proposal.liquidation.submitted_date} • Released ${peso(proposal.liquidation.total_released)} • Balance ${peso(proposal.liquidation.balance)}`}
                amount={peso(proposal.liquidation.total_spent)} badge={proposal.liquidation.status} />
            )}
          </Section>

          <Section title="Budget Return" count={proposal.budget_return ? 1 : 0}>
            {proposal.budget_return && (
              <Row main={proposal.budget_return.remarks || 'Unspent budget returned'}
                sub={`${proposal.budget_return.date_returned} • ${proposal.budget_return.cash_in_reference}`}
                amount={peso(proposal.budget_return.amount_returned)} badge="Returned" />
            )}
          </Section>
        </div>
      )}

      {photosFor && <ReceiptPhotosModal {...photosFor} canAdd={false} onClose={() => setPhotosFor(null)} />}
    </div>
  );
};

export default BudgetAuditTrail;
