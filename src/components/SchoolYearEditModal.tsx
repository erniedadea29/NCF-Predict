import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { X, Calendar, CheckCircle2, Loader2 } from 'lucide-react';

interface SchoolYearEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export const SchoolYearEditModal: React.FC<SchoolYearEditModalProps> = ({ isOpen, onClose }) => {
  const { activeSemester, updateActiveSemester } = useApp();

  const [syLabel, setSyLabel] = useState(activeSemester.school_year_label);
  const [semName, setSemName] = useState(activeSemester.semester_name);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isOpen) {
      setSyLabel(activeSemester.school_year_label);
      setSemName(activeSemester.semester_name);
      setSaveState('idle');
      setError('');
      isFirstRender.current = true;
    }
  }, [isOpen, activeSemester]);

  // Auto-save (Section 11) — debounced, no manual Save button. Every field
  // change quietly persists a moment after the user stops typing/selecting.
  useEffect(() => {
    if (!isOpen) return;
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!syLabel.trim() || !semName.trim()) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState('saving');
    debounceRef.current = setTimeout(async () => {
      try {
        await updateActiveSemester(syLabel.trim(), semName.trim());
        setSaveState('saved');
        setError('');
      } catch (err: any) {
        setSaveState('error');
        setError(err?.message || 'Failed to save. You may not have permission to change the school year.');
      }
    }, 700);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syLabel, semName, isOpen]);

  if (!isOpen) return null;

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

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold h-5">
            {saveState === 'saving' && (
              <span className="flex items-center gap-1.5 text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
              </span>
            )}
            {saveState === 'saved' && (
              <span className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> All changes saved
              </span>
            )}
            {saveState === 'error' && (
              <span className="text-rose-600">{error}</span>
            )}
          </div>

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
            </select>
          </div>

          <p className="text-[11px] text-slate-400">Changes save automatically — just close this dialog when you're done.</p>
        </div>
      </div>
    </div>
  );
};

export default SchoolYearEditModal;
