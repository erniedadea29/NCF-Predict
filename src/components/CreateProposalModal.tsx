import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DepartmentCode, BudgetLineItem } from '../types';
import { DEPARTMENTS } from '../data/mockData';
import { X, Plus, Trash2, Check, FileText, Calculator, Layers, AlertCircle } from 'lucide-react';

interface CreateProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateProposalModal: React.FC<CreateProposalModalProps> = ({ isOpen, onClose }) => {
  const { 
    createProposal,
    activeSemester,
    currentUser,
    userDepartment,
    isDepartmentRestricted,
    scopedDepartmentInfo
  } = useApp();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState<DepartmentCode>(userDepartment);
  const [linkedSemester, setLinkedSemester] = useState<string>('');
  const [treasurerNotes, setTreasurerNotes] = useState('KUNG MAY NOTES KAMO IDAGDAG INI SA NOTES: Verified unit costs against campus supplier price quotations.');

  // Line items for requirements & price evaluation
  const [lineItems, setLineItems] = useState<BudgetLineItem[]>([
    {
      id: `li_${Date.now()}_1`,
      item_desc: 'Materials, Badges, & Program Printing',
      category: 'Materials & Supplies',
      quantity: 50,
      unit_cost: 45.00,
      estimated_amount: 2250.00,
      remarks: 'Official participant badges and program leaflets'
    },
    {
      id: `li_${Date.now()}_2`,
      item_desc: 'Speaker Honorarium / Resource Person',
      category: 'Honorarium / Speakers',
      quantity: 2,
      unit_cost: 2500.00,
      estimated_amount: 5000.00,
      remarks: 'Keynote and technical workshop facilitator'
    }
  ]);

  if (!isOpen) return null;

  const categories = [
    'Materials & Supplies',
    'Honorarium / Speakers',
    'Food & Refreshments',
    'Venue & Logistics',
    'Prizes & Awards',
    'Equipment / Rentals',
    'Contingency'
  ];

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      {
        id: `li_${Date.now()}`,
        item_desc: '',
        category: 'Materials & Supplies',
        quantity: 1,
        unit_cost: 0,
        estimated_amount: 0,
        remarks: ''
      }
    ]);
  };

  const updateLineItem = (id: string, updates: Partial<BudgetLineItem>) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...updates };
        // Recalculate estimated_amount
        if (updates.quantity !== undefined || updates.unit_cost !== undefined) {
          updated.estimated_amount = (updated.quantity || 0) * (updated.unit_cost || 0);
        }
        return updated;
      }
      return item;
    }));
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) {
      alert('A budget proposal must have at least one line item.');
      return;
    }
    setLineItems(prev => prev.filter(i => i.id !== id));
  };

  const totalCalculatedBudget = lineItems.reduce((sum, i) => sum + (i.estimated_amount || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a budget proposal title.');
      return;
    }
    if (totalCalculatedBudget <= 0) {
      alert('Please configure at least one line item with valid pricing.');
      return;
    }

    await createProposal({
      budget_title: title.trim(),
      budget_description: description.trim() || 'No additional description provided.',
      department,
      event_id: undefined,
      event_title: linkedSemester || undefined,
      total_budget_amount: totalCalculatedBudget,
      budget_status: 'DRAFT',
      activesem_id: activeSemester.id,
      school_year: activeSemester.school_year_label,
      created_by_officer: `${currentUser.name} (${currentUser.officer_position || 'Treasurer'})`,
      treasurer_notes: treasurerNotes,
      line_items: lineItems
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-[#00873E] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 text-white font-bold flex items-center justify-center text-sm">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">New Budget Proposal (Treasurer Draft)</h3>
              <p className="text-xs text-emerald-100">Step 1: Define Requirements, Evaluate Pricing, Structure Proposal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Basic Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Budget Proposal Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 2024 College Tech Summit & Coding Olympiad"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-sm rounded-xl border border-slate-200 focus:outline-emerald-500 font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Department / College
              </label>
              {isDepartmentRestricted ? (
                <div className="w-full px-3.5 py-2.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl font-bold text-xs flex items-center justify-between">
                  <span>{userDepartment} - {scopedDepartmentInfo.name}</span>
                  <span className="text-[10px] bg-blue-200 text-blue-950 px-1.5 py-0.5 rounded font-black">LOCKED</span>
                </div>
              ) : (
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as DepartmentCode)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-xs rounded-xl border border-slate-200 font-medium"
                >
                  {Object.keys(DEPARTMENTS).map(code => (
                    <option key={code} value={code}>
                      {code} - {DEPARTMENTS[code as DepartmentCode].name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Link Semester (Optional)
              </label>
              <select
                value={linkedSemester}
                onChange={(e) => setLinkedSemester(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-xs rounded-xl border border-slate-200 font-medium"
              >
                <option value="">-- Not linked to a specific semester --</option>
                <option value="1st Semester">1st Semester</option>
                <option value="2nd Semester">2nd Semester</option>
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Description & Justification of Need
              </label>
              <textarea
                rows={2}
                placeholder="Provide event overview, educational objectives, and target beneficiaries..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 focus:bg-white rounded-xl border border-slate-200 focus:outline-emerald-500"
              />
            </div>
          </div>

          {/* Line Items & Price Evaluation (Core Feature Requirement) */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  Line Items & Pricing Evaluation Breakdown
                </h4>
                <p className="text-xs text-slate-500">Define requirements, quantity, and verified unit costs</p>
              </div>
              <button
                type="button"
                onClick={addLineItem}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>

            <div className="space-y-2.5">
              {lineItems.map((item, idx) => (
                <div 
                  key={item.id}
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-slate-500">#{idx + 1}</span>
                    <select
                      value={item.category}
                      onChange={(e) => updateLineItem(item.id, { category: e.target.value })}
                      className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 font-semibold text-slate-700 text-xs"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <button
                      type="button"
                      onClick={() => removeLineItem(item.id)}
                      className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        required
                        placeholder="Item requirement description..."
                        value={item.item_desc}
                        onChange={(e) => updateLineItem(item.id, { item_desc: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-200 font-medium"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                          className="w-full px-2 py-1.5 bg-white rounded-lg border border-slate-200 font-bold text-center"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Unit: ₱</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={item.unit_cost}
                          onChange={(e) => updateLineItem(item.id, { unit_cost: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 bg-white rounded-lg border border-slate-200 font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                    <input
                      type="text"
                      placeholder="Remarks / Quotation reference..."
                      value={item.remarks}
                      onChange={(e) => updateLineItem(item.id, { remarks: e.target.value })}
                      className="w-2/3 px-2 py-1 bg-white rounded border border-slate-200 text-[11px]"
                    />
                    <div className="font-extrabold text-slate-900 text-xs">
                      Subtotal: ₱{item.estimated_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Summary */}
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Evaluated Budget</p>
                <p className="text-[11px] text-emerald-600">Calculated from {lineItems.length} line items</p>
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#00873E]">
                ₱{totalCalculatedBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Collaborative Notes Section ("KUNG MAY NOTES KAMO IDAGDAG INI SA NOTES") */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px]">NOTES</span>
              Initial Officer Notes ("KUNG MAY NOTES KAMO IDAGDAG INI SA NOTES")
            </label>
            <textarea
              rows={2}
              value={treasurerNotes}
              onChange={(e) => setTreasurerNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 focus:bg-white rounded-xl border border-slate-200 font-medium"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#00873E] hover:bg-[#007033] text-white text-xs font-bold shadow-md transition transform active:scale-98 cursor-pointer flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Save & Save as Draft</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
