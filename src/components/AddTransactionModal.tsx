import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DepartmentCode, TransactionCategory } from '../types';
import { DEPARTMENTS } from '../data/mockData';
import { X, Check, Building, Tag, DollarSign, Calendar } from 'lucide-react';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ isOpen, onClose }) => {
  const { 
    addTransaction, 
    activeSemester, 
    userDepartment, 
    isDepartmentRestricted,
    scopedDepartmentInfo 
  } = useApp();

  const [department, setDepartment] = useState<DepartmentCode>(userDepartment);
  const [category, setCategory] = useState<TransactionCategory>('Event');
  const [title, setTitle] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [description, setDescription] = useState<string>('');
  const [fiscalYear, setFiscalYear] = useState<string>(activeSemester.school_year_label);

  const deptCodes: DepartmentCode[] = ['CAF', 'CAS', 'CBM', 'CCJE', 'CCS', 'COE', 'CHS', 'CTED'];
  const categories: TransactionCategory[] = ['Revenue', 'Event', 'Capital', 'Operations', 'Academic'];

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    if (!title.trim()) {
      alert('Please provide a transaction title/description.');
      return;
    }

    const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    addTransaction({
      title: title.trim(),
      department: isDepartmentRestricted ? userDepartment : department,
      category,
      date: todayStr,
      amount: numAmount,
      type,
      status: 'Completed',
      description: description.trim() || undefined
    });

    // Reset and close
    setTitle('');
    setAmount('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm">
              +
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">New Budget & Transaction Entry</h3>
              <p className="text-xs text-slate-500">Record Department Fund Disbursal or Collection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Department Selection (Matching PDF Page 19, 27, 28, 29, 31, 32, 35) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-emerald-600" />
              Department
            </label>
            {isDepartmentRestricted ? (
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl font-bold text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  <span>{userDepartment} - {scopedDepartmentInfo.name}</span>
                </div>
                <span className="text-[10px] bg-blue-200 text-blue-950 px-2 py-0.5 rounded font-black">LOCKED</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {deptCodes.map((code) => {
                    const info = DEPARTMENTS[code];
                    const isSelected = department === code;
                    return (
                      <button
                        type="button"
                        key={code}
                        onClick={() => setDepartment(code)}
                        className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#00873E] text-white border-[#00873E] shadow-xs'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {code}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 italic mt-0.5">
                  Selected: <span className="font-semibold text-slate-800">{DEPARTMENTS[department].name}</span>
                </p>
              </>
            )}
          </div>

          {/* Category Selection (Matching PDF Page 20) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              Category
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`py-1.5 px-2 text-center rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    category === cat
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction Type */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('EXPENSE')}
              className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                type === 'EXPENSE'
                  ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-400/20'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              💸 Disbursal / Expense
            </button>
            <button
              type="button"
              onClick={() => setType('INCOME')}
              className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                type === 'INCOME'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-400/20'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              💰 Revenue / SAF Cash-In
            </button>
          </div>

          {/* Title / Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Title / Activity Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Q3 Student Fee Collection, Tech Summit Venue, Lab Equipment..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-sm rounded-xl border border-slate-200 focus:outline-emerald-500 font-medium"
            />
          </div>

          {/* Amount and Fiscal Year (Matching PDF Page 23, 30, 34) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                Allocated Amount (₱)
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-sm rounded-xl border border-slate-200 focus:outline-emerald-500 font-bold text-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                Fiscal Year
              </label>
              <input
                type="text"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-100 text-sm rounded-xl border border-slate-200 text-slate-700 font-semibold"
              />
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Notes / Double-Entry Reference
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Double entry recorded to SAF treasury vault ledger..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 focus:bg-white rounded-xl border border-slate-200 focus:outline-emerald-500"
            />
          </div>

          {/* Submit Button (Matching PDF "Create Entry" button) */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-[#00873E] hover:bg-[#007033] text-white font-extrabold text-sm rounded-2xl shadow-lg transition transform active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Create Entry</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
