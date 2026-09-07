import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, UserCog, CheckCircle2 } from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, updateOwnProfile } = useApp();

  const [name, setName] = useState(currentUser.name);
  const [contactNumber, setContactNumber] = useState(currentUser.contact_number || '');
  const [course, setCourse] = useState(currentUser.course || '');
  const [yearLevel, setYearLevel] = useState(currentUser.year_level || '');
  const [section, setSection] = useState(currentUser.section || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name);
      setContactNumber(currentUser.contact_number || '');
      setCourse(currentUser.course || '');
      setYearLevel(currentUser.year_level || '');
      setSection(currentUser.section || '');
      setSaved(false);
      setError('');
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const isStudent = currentUser.role === 'student';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    const res = await updateOwnProfile({
      name: name.trim(),
      contact_number: contactNumber,
      ...(isStudent ? { course, year_level: yearLevel, section } : {})
    });
    setSaving(false);
    if (!res.success) {
      setError(res.message);
      return;
    }
    setSaved(true);
    setTimeout(() => onClose(), 700);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-[#00873E] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5" />
            <h3 className="font-extrabold text-base">Edit Profile</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {saved && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Profile updated!
            </div>
          )}
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Full Name</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E] focus:border-[#00873E]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Contact Number</label>
            <input
              type="tel" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)}
              placeholder="e.g. 0917-123-4567"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E] focus:border-[#00873E]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Email</label>
            <input
              type="email" value={currentUser.email} disabled
              className="w-full px-3 py-2.5 text-sm border border-slate-200 bg-slate-50 text-slate-400 rounded-xl cursor-not-allowed"
            />
            <p className="text-[10px] text-slate-400 mt-1">Email can't be changed here — contact an admin if needed.</p>
          </div>

          {isStudent && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Course</label>
                <input
                  type="text" value={course} onChange={(e) => setCourse(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E] focus:border-[#00873E]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Year Level</label>
                  <input
                    type="text" value={yearLevel} onChange={(e) => setYearLevel(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E] focus:border-[#00873E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Section</label>
                  <input
                    type="text" value={section} onChange={(e) => setSection(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E] focus:border-[#00873E]"
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 bg-[#00873E] hover:bg-[#007033] text-white font-bold text-sm rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;
