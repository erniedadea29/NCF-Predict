import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, FileText, Loader2, X, AlertCircle, ImageOff } from 'lucide-react';
import { expensePhotoFolder, listExpensePhotos, uploadExpensePhotos, ReceiptPhoto } from '../utils/receiptPhotos';

interface ReceiptPhotosModalProps {
  title: string;
  subtitle?: string;
  department: string;
  proposalId: string;
  expenseId: string;
  legacyPath?: string | null;
  /** Officers can add more photos; reviewers only view. */
  canAdd: boolean;
  onClose: () => void;
}

/** Shows every receipt photo of a reimbursement / expense, and lets officers add more. */
export const ReceiptPhotosModal: React.FC<ReceiptPhotosModalProps> = ({
  title, subtitle, department, proposalId, expenseId, legacyPath, canAdd, onClose
}) => {
  const folder = expensePhotoFolder(department, proposalId, expenseId);
  const [photos, setPhotos] = useState<ReceiptPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [viewing, setViewing] = useState<ReceiptPhoto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setPhotos(await listExpensePhotos(folder, legacyPath));
    setLoading(false);
  }, [folder, legacyPath]);

  useEffect(() => { load(); }, [load]);

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setErrors(await uploadExpensePhotos(folder, files));
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
    load();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-sm truncate">Receipt Photos: {title}</h3>
            {subtitle && <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-10 flex justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : photos.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <ImageOff className="w-7 h-7 text-slate-300" />
              No receipt photo attached yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map(p => (
                <button
                  key={p.path}
                  type="button"
                  onClick={() => p.isPdf ? (p.url && window.open(p.url, '_blank', 'noopener,noreferrer')) : setViewing(p)}
                  className="group rounded-xl border border-slate-200 overflow-hidden bg-slate-50 hover:border-[#00873E] transition cursor-pointer text-left"
                >
                  <div className="aspect-square flex items-center justify-center bg-slate-100">
                    {p.isPdf || !p.url
                      ? <FileText className="w-10 h-10 text-slate-400" />
                      : <img src={p.url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />}
                  </div>
                  <p className="px-2 py-1.5 text-[10px] font-semibold text-slate-600 truncate">{p.name}</p>
                </button>
              ))}
            </div>
          )}

          {errors.length > 0 && (
            <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5 space-y-0.5">
              {errors.map(e => <p key={e} className="flex items-start gap-1"><AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />{e}</p>)}
            </div>
          )}

          {canAdd && (
            <div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 border-2 border-dashed border-slate-300 hover:border-[#00873E] rounded-xl text-xs font-bold text-slate-600 hover:text-[#00873E] transition cursor-pointer disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {uploading ? 'Uploading...' : 'Add Photo / File'}
              </button>
              <p className="text-[10px] text-slate-400 mt-1">JPG, PNG, WEBP or PDF, max 8MB each. You can pick several at once.</p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => addFiles(Array.from(e.target.files || []))}
              />
            </div>
          )}
        </div>
      </div>

      {viewing && viewing.url && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4" onClick={e => { e.stopPropagation(); setViewing(null); }}>
          <img src={viewing.url} alt={viewing.name} className="max-w-full max-h-full rounded-xl shadow-2xl" />
          <button className="absolute top-4 right-4 text-white/80 hover:text-white p-2 cursor-pointer"><X className="w-6 h-6" /></button>
        </div>
      )}
    </div>
  );
};

export default ReceiptPhotosModal;
