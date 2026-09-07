import React, { useRef, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { Camera, FileUp, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface UploadedReceipt {
  name: string;
  type: string;
  url: string; // Storage object path (not a signed URL — see AppContext.getSignedReceiptUrl)
}

interface ReceiptUploadFieldProps {
  label?: string;
  pathPrefix: string; // e.g. `${department}/${proposalId}`
  value: UploadedReceipt | null;
  onChange: (receipt: UploadedReceipt | null) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 8 * 1024 * 1024;

export const ReceiptUploadField: React.FC<ReceiptUploadFieldProps> = ({ label = 'Receipt / Proof Document', pathPrefix, value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    setError('');
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPG, PNG, WEBP, or PDF files are allowed.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('File is too large (max 8MB).');
      return;
    }

    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${pathPrefix}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await getSupabase().storage.from('receipts').upload(path, file, {
      contentType: file.type,
      upsert: false
    });
    setUploading(false);

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      return;
    }

    onChange({ name: file.name, type: file.type, url: path });
  };

  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>

      {value ? (
        <div className="flex items-center justify-between gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate font-semibold text-emerald-900">{value.name}</span>
          </div>
          <button
            type="button"
            onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ''; }}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 border-2 border-dashed border-slate-300 hover:border-[#00873E] rounded-xl text-xs font-bold text-slate-600 hover:text-[#00873E] transition cursor-pointer disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            <span>{uploading ? 'Uploading...' : 'Take Photo / Choose File'}</span>
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {error && (
        <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
      <p className="text-[10px] text-slate-400 mt-1">JPG, PNG, WEBP, or PDF — max 8MB.</p>
    </div>
  );
};

export default ReceiptUploadField;
