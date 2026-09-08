import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, UserCog, CheckCircle2, ShieldCheck, ShieldOff, KeyRound } from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Self-contained Two-Factor Authentication (TOTP) enroll/manage panel —
// separate from the profile-save form above it so its own multi-step
// enroll/verify/disable actions don't interact with that form's submit.
const TwoFactorAuthSection: React.FC = () => {
  const { mfaFactors, mfaEnrollStart, mfaEnrollConfirm, mfaUnenroll } = useApp();

  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeFactor = mfaFactors.find(f => f.status === 'verified');

  const startEnroll = async () => {
    setBusy(true);
    setMessage(null);
    const res = await mfaEnrollStart();
    setBusy(false);
    if (!res.success || !res.qrCode || !res.factorId) {
      setMessage({ type: 'error', text: res.message || 'Failed to start 2FA setup.' });
      return;
    }
    setQrCode(res.qrCode);
    setSecret(res.secret || '');
    setFactorId(res.factorId);
    setEnrolling(true);
  };

  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !factorId) return;
    setBusy(true);
    setMessage(null);
    const res = await mfaEnrollConfirm(factorId, code.trim());
    setBusy(false);
    if (!res.success) {
      setMessage({ type: 'error', text: res.message });
      return;
    }
    setMessage({ type: 'success', text: res.message });
    setEnrolling(false);
    setCode('');
    setQrCode('');
    setSecret('');
  };

  const cancelEnroll = () => {
    setEnrolling(false);
    setCode('');
    setQrCode('');
    setSecret('');
    setMessage(null);
  };

  const disable2fa = async () => {
    if (!activeFactor) return;
    setBusy(true);
    setMessage(null);
    const res = await mfaUnenroll(activeFactor.id);
    setBusy(false);
    setMessage({ type: res.success ? 'success' : 'error', text: res.message });
  };

  return (
    <div className="border-t border-slate-100 pt-4 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-[#00873E]" />
        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Two-Factor Authentication</h4>
      </div>

      {message && (
        <div className={`p-2.5 rounded-xl text-xs border ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {message.text}
        </div>
      )}

      {enrolling ? (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500">
            Scan this QR code with an authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code it shows.
          </p>
          {qrCode && (
            <div className="flex justify-center p-3 bg-white border border-slate-200 rounded-xl">
              <img src={qrCode} alt="2FA QR code" className="w-40 h-40" />
            </div>
          )}
          {secret && (
            <p className="text-[10px] text-slate-400 text-center break-all">
              Can't scan? Enter this key manually: <span className="font-mono font-bold text-slate-600">{secret}</span>
            </p>
          )}
          <form onSubmit={confirmEnroll} className="space-y-2">
            <input
              type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full px-3 py-2 text-center text-lg tracking-[0.4em] font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E]"
              required
            />
            <div className="flex gap-2">
              <button type="button" onClick={cancelEnroll}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={busy || code.length < 6}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#00873E] hover:bg-[#007033] text-white transition cursor-pointer disabled:opacity-50">
                {busy ? 'Verifying...' : 'Verify & Enable'}
              </button>
            </div>
          </form>
        </div>
      ) : activeFactor ? (
        <div className="flex items-center justify-between gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
            <ShieldCheck className="w-4 h-4" /> Enabled
          </span>
          <button onClick={disable2fa} disabled={busy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition cursor-pointer disabled:opacity-50">
            <ShieldOff className="w-3.5 h-3.5" /> Disable
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-xs text-slate-500">Not set up — add an extra layer of security to your account.</span>
          <button type="button" onClick={startEnroll} disabled={busy}
            className="shrink-0 px-2.5 py-1.5 rounded-lg bg-[#00873E] hover:bg-[#007033] text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50">
            {busy ? 'Loading...' : 'Set Up'}
          </button>
        </div>
      )}
    </div>
  );
};

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

        <div className="px-5 pb-5">
          <TwoFactorAuthSection />
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;
