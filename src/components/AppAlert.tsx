import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

/**
 * Styled replacement for the browser's alert() popup, in the app's colors:
 * red for errors, failures and warnings, green for everything else.
 * window.alert is replaced once at startup, so every existing alert(...)
 * call in the app shows this box instead of the browser's grey popup.
 */

type AppAlertItem = { id: number; message: string; tone: 'error' | 'success' };

const listeners = new Set<(items: AppAlertItem[]) => void>();
let queue: AppAlertItem[] = [];
let nextId = 1;

const ERROR_PATTERN = /\bnot\b|could ?n[o']t|cannot|can't|fail|error|invalid|denied|refused|not allowed|unable|missing|required|please|must|only |no remaining|already paid|violates|⚠/i;

const emit = () => listeners.forEach(l => l(queue));

export function showAppAlert(message: unknown) {
  const text = String(message ?? '');
  queue = [...queue, { id: nextId++, message: text, tone: ERROR_PATTERN.test(text) ? 'error' : 'success' }];
  emit();
}

export function installAppAlert() {
  if (typeof window === 'undefined') return;
  window.alert = (message?: unknown) => showAppAlert(message);
}

export const AppAlertHost: React.FC = () => {
  const [items, setItems] = useState<AppAlertItem[]>(queue);
  useEffect(() => {
    listeners.add(setItems);
    return () => { listeners.delete(setItems); };
  }, []);

  const current = items[0];
  if (!current) return null;

  const close = () => { queue = queue.filter(i => i.id !== current.id); emit(); };
  const isError = current.tone === 'error';

  return (
    <div
      className="fixed inset-0 z-[200] bg-[#0B3D2E]/40 backdrop-blur-xs flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-alert-title"
    >
      <div className={`bg-white w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden ${isError ? 'border-red-200' : 'border-[#0B3D2E]/15'}`}>
        <div className={`h-1.5 ${isError ? 'bg-red-600' : 'bg-[#F2B705]'}`} />
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${isError ? 'bg-red-50 text-red-600' : 'bg-[#EEF4F0] text-[#0B3D2E]'}`}>
              {isError ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="app-alert-title" className={`text-sm font-extrabold ${isError ? 'text-red-700' : 'text-[#0B3D2E]'}`}>
                {isError ? 'Something needs your attention' : 'Done'}
              </h2>
              <p className="mt-1 text-sm text-slate-700 whitespace-pre-line break-words max-h-[50vh] overflow-y-auto">{current.message}</p>
            </div>
            <button onClick={close} aria-label="Close" className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex justify-end">
            <button
              autoFocus
              onClick={close}
              className={`px-5 py-2 rounded-xl text-sm font-bold text-white cursor-pointer ${isError ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0B3D2E] hover:bg-[#072A20]'}`}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
