import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { DEPARTMENTS } from '../data/mockData';
import { formatDateTime } from '../utils/roleLabels';
import { Wallet, Receipt, ArrowDownLeft, PieChart, Eye } from 'lucide-react';

const peso = (n: number) => `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Students' Expenses tab: the department's APPROVED budgets, summarized
 * (approved, spent and returned totals, plus the approved amount per
 * category). Only approved & released budgets are shown; no line items,
 * names, transaction ledger, or downloads.
 */
export const StudentExpensesView: React.FC = () => {
  const { scopedProposals, userDepartment, activeSemester } = useApp();

  const budgets = useMemo(() => scopedProposals
    .filter(p => p.budget_status === 'APPROVED_RELEASED')
    .map(p => {
      const byCategory: Record<string, number> = {};
      p.line_items.forEach(li => {
        byCategory[li.category] = (byCategory[li.category] || 0) + (li.estimated_amount || 0);
      });
      const categories = Object.entries(byCategory)
        .map(([category, amount]) => ({ category, amount }))
        .filter(c => c.amount > 0)
        .sort((a, b) => b.amount - a.amount);
      // Spent = what was liquidated once a report exists, otherwise recorded expenses.
      const spent = p.liquidation
        ? p.liquidation.accounting_summary.reduce((s, l) => s + l.spent, 0)
        : p.expenses.reduce((s, e) => s + e.amount_spent, 0);
      return {
        id: p.id,
        title: p.budget_title,
        approvedOn: p.dean_approval?.date || p.updated_at,
        approved: p.total_budget_amount,
        spent,
        returned: p.budget_return?.amount_returned || 0,
        categories
      };
    })
    .sort((a, b) => (b.approvedOn || '').localeCompare(a.approvedOn || '')),
  [scopedProposals]);

  const totals = budgets.reduce(
    (t, b) => ({ approved: t.approved + b.approved, spent: t.spent + b.spent, returned: t.returned + b.returned }),
    { approved: 0, spent: 0, returned: 0 }
  );

  return (
    <div className="space-y-5">
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Receipt className="w-5 h-5 text-emerald-600" />
          Expenses
        </h2>
        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
          <Eye className="w-3.5 h-3.5" />
          View only • Approved budgets of {DEPARTMENTS[userDepartment]?.name || userDepartment} ({userDepartment}), summarized • {activeSemester.school_year_label}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Total Approved</span>
          <p className="text-lg font-black text-slate-900">{peso(totals.approved)}</p>
          <p className="text-[11px] text-slate-400">{budgets.length} approved budget(s)</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> Total Spent</span>
          <p className="text-lg font-black text-slate-900">{peso(totals.spent)}</p>
          <p className="text-[11px] text-slate-400">
            {totals.approved > 0 ? Math.round((totals.spent / totals.approved) * 100) : 0}% of approved funds
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1"><ArrowDownLeft className="w-3.5 h-3.5" /> Returned to SAF</span>
          <p className="text-lg font-black text-emerald-700">{peso(totals.returned)}</p>
          <p className="text-[11px] text-slate-400">Unused funds given back</p>
        </div>
      </div>

      {budgets.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-xs text-slate-500">
          No approved budgets yet for {userDepartment}.
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map(b => {
            const usedPct = b.approved > 0 ? Math.min(100, Math.round((b.spent / b.approved) * 100)) : 0;
            return (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{b.title}</h3>
                    <p className="text-[11px] text-slate-400">Approved {formatDateTime(b.approvedOn)}</p>
                  </div>
                  <span className="self-start sm:self-auto px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-emerald-100 text-emerald-800 border-emerald-300">
                    Approved &amp; Funds Released
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Approved</span>
                    <p className="font-black text-sm text-slate-900">{peso(b.approved)}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Spent</span>
                    <p className="font-black text-sm text-slate-900">{peso(b.spent)}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Returned</span>
                    <p className="font-black text-sm text-emerald-700">{peso(b.returned)}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Used</span>
                    <span className="font-bold">{usedPct}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#00873E] rounded-full" style={{ width: `${usedPct}%` }} />
                  </div>
                </div>

                {b.categories.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                      <PieChart className="w-3.5 h-3.5" /> Approved budget by category
                    </p>
                    {b.categories.map(c => (
                      <div key={c.category} className="flex items-center gap-2 text-xs">
                        <span className="w-44 shrink-0 truncate text-slate-700">{c.category}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${b.approved > 0 ? (c.amount / b.approved) * 100 : 0}%` }} />
                        </div>
                        <span className="w-28 text-right font-mono font-semibold text-slate-800">{peso(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentExpensesView;
