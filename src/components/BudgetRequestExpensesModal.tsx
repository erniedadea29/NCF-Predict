import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Upload, Check, DollarSign, FileText, Receipt, ArrowRight } from 'lucide-react';

interface BudgetRequestExpensesModalProps {
  proposalId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BudgetRequestExpensesModal: React.FC<BudgetRequestExpensesModalProps> = ({
  proposalId,
  isOpen,
  onClose
}) => {
  const { proposals, requestCashout, addExpense, requestReimbursement } = useApp();
  const [activeTab, setActiveTab] = useState<'cashout' | 'expense' | 'reimburse'>('cashout');

  // Cashout Form State
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [cashoutPurpose, setCashoutPurpose] = useState('');
  const [proofFileName, setProofFileName] = useState('Official_Dean_Approved_Letter.pdf');
  const [proofDocType, setProofDocType] = useState('Letter');

  // Expense Form State
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Materials & Supplies');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Math.floor(10000 + Math.random() * 90000)}`);
  const [expenseReceiptName, setExpenseReceiptName] = useState('Official_Receipt_Scanned.jpg');

  if (!isOpen || !proposalId) return null;

  const targetProposal = proposals.find(p => p.id === proposalId);
  if (!targetProposal) return null;

  const categories = [
    'Materials & Supplies',
    'Honorarium / Speakers',
    'Food & Refreshments',
    'Venue & Logistics',
    'Prizes & Awards',
    'Equipment / Rentals',
    'Contingency'
  ];

  const handleCashoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(cashoutAmount);
    if (isNaN(num) || num <= 0) {
      alert('Please enter a valid release amount.');
      return;
    }

    requestCashout(targetProposal.id, num, cashoutPurpose.trim() || `Disbursal for ${targetProposal.budget_title}`, [
      {
        name: proofFileName,
        type: proofDocType,
        url: '#',
        date: new Date().toISOString().slice(0, 10)
      }
    ]);

    setCashoutAmount('');
    setCashoutPurpose('');
    onClose();
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(expenseAmount);
    if (isNaN(num) || num <= 0) {
      alert('Please enter a valid expense amount.');
      return;
    }
    if (!expenseDesc.trim()) {
      alert('Please enter expense description.');
      return;
    }

    addExpense(targetProposal.id, expenseDesc.trim(), expenseCategory, num, {
      name: expenseReceiptName,
      type: 'Invoice / Receipt',
      url: '#',
      invoice_number: invoiceNumber
    });

    setExpenseDesc('');
    setExpenseAmount('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base">Financial Execution & Disbursals</h3>
            <p className="text-xs text-slate-400">Proposal: {targetProposal.budget_title}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/20 text-slate-300 flex items-center justify-center transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            onClick={() => setActiveTab('cashout')}
            className={`flex-1 py-3 text-center border-b-2 transition cursor-pointer ${
              activeTab === 'cashout' ? 'border-[#00873E] text-[#00873E] bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Budget Request & Release (Cashout)
          </button>
          <button
            onClick={() => setActiveTab('expense')}
            className={`flex-1 py-3 text-center border-b-2 transition cursor-pointer ${
              activeTab === 'expense' ? 'border-[#00873E] text-[#00873E] bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Record Expenses & Invoices
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {activeTab === 'cashout' ? (
            <form onSubmit={handleCashoutSubmit} className="space-y-4">
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
                <p className="font-bold">Total Approved Budget: ₱{targetProposal.total_budget_amount.toLocaleString()}</p>
                <p className="text-[11px] text-emerald-700">Attach letters, billings, and approval invoices to request release of funds from treasury.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Amount to Release (₱) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 15000.00"
                  value={cashoutAmount}
                  onChange={(e) => setCashoutAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-sm rounded-xl border border-slate-200 focus:outline-emerald-500 font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Purpose / Disbursement Details *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Initial advance for venue deposit & materials"
                  value={cashoutPurpose}
                  onChange={(e) => setCashoutPurpose(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 focus:bg-white rounded-xl border border-slate-200 focus:outline-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Proof Document Type
                  </label>
                  <select
                    value={proofDocType}
                    onChange={(e) => setProofDocType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200"
                  >
                    <option value="Letter">Approval Letter / Endorsement</option>
                    <option value="Billing">Supplier Billing Statement</option>
                    <option value="Invoice">Proforma Invoice</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Attached Document Reference
                  </label>
                  <input
                    type="text"
                    value={proofFileName}
                    onChange={(e) => setProofFileName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-3 bg-[#00873E] hover:bg-[#007033] text-white text-xs font-bold rounded-2xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Release Funds & Generate Disbursement Voucher</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-200 text-xs text-blue-900 space-y-1">
                <p className="font-bold">Expense Recording & Proof Attachment</p>
                <p className="text-[11px] text-blue-700">Record all actual disbursements with receipts to prepare for liquidation audit.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Expense Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sound system rental receipt, Scantron paper purchase..."
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 focus:bg-white rounded-xl border border-slate-200 focus:outline-emerald-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Amount Spent (₱) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 focus:bg-white rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Official Receipt / Invoice #
                  </label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Proof Attachment File
                  </label>
                  <input
                    type="text"
                    value={expenseReceiptName}
                    onChange={(e) => setExpenseReceiptName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-3 bg-[#00873E] hover:bg-[#007033] text-white text-xs font-bold rounded-2xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Save Official Expense & Deduct from Budget</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
