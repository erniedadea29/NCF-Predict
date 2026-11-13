import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldAlert, Smartphone, Loader2 } from 'lucide-react';

/** Full screen shown on a NEW device while the device using the account decides. */
export const DeviceWaitingScreen: React.FC = () => {
  const { cancelDeviceLogin, deviceGate } = useApp();
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#00873E] via-[#03693a] to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 text-center space-y-4">
        {deviceGate === 'pending' ? (
          <>
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Smartphone className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-black text-slate-900">Waiting for approval</h2>
            <p className="text-sm text-slate-600">
              Your account is being used on another device. We asked that device to confirm that this sign-in is you.
              Open the system there and press <strong>Yes, it's me</strong>.
            </p>
            <p className="text-xs text-slate-400">
              If the other device is closed or offline, you will be let in automatically within about 3 minutes.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Waiting...
            </div>
            <button
              onClick={cancelDeviceLogin}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold cursor-pointer"
            >
              Cancel and log out
            </button>
          </>
        ) : (
          <div className="py-6 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00873E]" />
          </div>
        )}
      </div>
    </div>
  );
};

/** "Is this you?" prompt on the device currently using the account. */
export const DeviceRequestPrompt: React.FC = () => {
  const { incomingDeviceRequest, answerDeviceRequest } = useApp();
  if (!incomingDeviceRequest) return null;
  const when = new Date(incomingDeviceRequest.created_at).toLocaleString();
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 shrink-0 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Is this you?</h2>
            <p className="text-sm text-slate-600 mt-1">
              Someone is trying to sign in to your account on <strong>{incomingDeviceRequest.device}</strong> ({when}).
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
          Only one device can use an account at a time. If you allow it, <strong>you will be logged out here</strong> and the other device will continue.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => answerDeviceRequest(true)}
            className="py-2.5 rounded-xl bg-[#00873E] hover:bg-[#007033] text-white text-sm font-bold cursor-pointer"
          >
            Yes, it's me (allow)
          </button>
          <button
            onClick={() => answerDeviceRequest(false)}
            className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold cursor-pointer"
          >
            No, block it
          </button>
        </div>
      </div>
    </div>
  );
};
