import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, Calendar, CheckCircle2 } from 'lucide-react';

interface SchoolYearEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SchoolYearEditModal: React.FC<SchoolYearEditModalProps> = ({ isOpen, onClose }) => {
  const { activeSemester, updateActiveSemester } = useApp();

  const [syLabel, setSyLabel] = useState(activeSemester.school_year_label);
  const [semName, setSemName] = useState(activeSemester.semester_name);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSyLabel(activeSemester.school_year_label);
      setSemName(activeSemester.semester_name);
      setSaved(false);
    }
  }, [isOpen, activeSemester]);

  if (!isOpen) return null;

  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syLabel.trim() || !semName.trim()) return;
    setError('');
    try {
      await updateActiveSemester(syLabel.trim(), semName.trim());
      setSaved(true);
      setTimeout(() => onClose(), 600);
    } catch (err: any) {
      setError(err?.message || 'Failed to save. You may not have permission to change the school year.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-[#00873E] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            <h3 className="font-extrabold text-base">Edit School Year & Semester</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {saved && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Updated!
            </div>
          )}
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
              School Year Label
            </label>
            <input
              type="text"
              value={syLabel}
              onChange={(e) => setSyLabel(e.target.value)}
              placeholder="e.g. SY 2025-2026"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E] focus:border-[#00873E]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
              Semester
            </label>
            <select
              value={semName}
              onChange={(e) => setSemName(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E] bg-white cursor-pointer"
            >
              <option value="1st Semester">1st Semester</option>
              <option value="2nd Semester">2nd Semester</option>
              <option value="Summer">Summer</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-[#00873E] hover:bg-[#007033] text-white font-bold text-sm rounded-xl shadow-xs transition cursor-pointer"
          >
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
};

export default SchoolYearEditModal;
