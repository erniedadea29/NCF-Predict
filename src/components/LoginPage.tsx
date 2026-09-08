import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  LogIn,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Sparkles,
  ArrowLeft
} from 'lucide-react';

interface LoginPageProps {
  onGoToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onGoToRegister }) => {
  const { loginUser, requestPasswordReset, mfaChallengePending, mfaVerifyLogin, cancelMfaChallenge } = useApp();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetSending, setResetSending] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError('Please enter your Email Address or Student/Officer ID.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    const res = await loginUser(identifier.trim(), password);
    setIsLoading(false);
    if (!res.success) {
      setError(res.message);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode.trim()) return;
    setMfaVerifying(true);
    setMfaError('');
    const res = await mfaVerifyLogin(mfaCode.trim());
    setMfaVerifying(false);
    if (!res.success) {
      setMfaError(res.message);
      setMfaCode('');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetSending(true);
    const res = await requestPasswordReset(resetEmail.trim());
    setResetSending(false);
    setResetMessage(res.message);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#00873E] via-[#03693a] to-slate-900 flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-5">
        {/* Left Branding Panel */}
        <div className="hidden lg:flex lg:col-span-2 flex-col justify-between bg-[#00873E] text-white p-8 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/10"></div>
          <div className="absolute -left-16 bottom-0 w-64 h-64 rounded-full bg-black/10"></div>
          <div className="relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-white font-black text-2xl backdrop-blur-xs shadow-inner mb-6">
              Σ
            </div>
            <h1 className="text-2xl font-black tracking-tight leading-tight">NCF PREDICT</h1>
            <p className="text-emerald-100/90 text-sm mt-1">Budget & Student Activity Fund (SAF) System</p>
          </div>
          <div className="relative z-10 space-y-3 text-xs text-emerald-50/90">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>AI-assisted budget forecasting</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>5-Stage transparent approval workflow</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span>Naga College Foundation • Supreme Student Council</span>
            </div>
          </div>
        </div>

        {/* Login Panel */}
        <div className="lg:col-span-3 p-6 sm:p-10 max-h-[92vh] overflow-y-auto">
          <div className="mb-6">
            <div className="w-11 h-11 rounded-2xl bg-[#00873E]/10 flex items-center justify-center mb-4">
              <LogIn className="w-5 h-5 text-[#00873E]" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">Log in to your account</h2>
            <p className="text-xs text-slate-500 mt-1">You must log in before you can access the system.</p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 mb-4">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mfaChallengePending ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800">
                <ShieldCheck className="w-5 h-5 text-[#00873E]" />
                <p className="text-sm font-bold">Two-Factor Verification</p>
              </div>
              <p className="text-xs text-slate-500">
                Enter the 6-digit code from your authenticator app to finish signing in.
              </p>
              {mfaError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{mfaError}</span>
                </div>
              )}
              <form onSubmit={handleVerifyMfa} className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full px-3.5 py-3 text-center text-2xl tracking-[0.5em] font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E] focus:border-[#00873E]"
                  autoFocus
                  required
                />
                <button
                  type="submit"
                  disabled={mfaVerifying || mfaCode.length < 6}
                  className="w-full py-2.5 px-4 bg-[#00873E] hover:bg-[#007033] text-white font-bold text-sm rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {mfaVerifying ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </form>
              <button
                type="button"
                onClick={() => cancelMfaChallenge()}
                className="w-full flex items-center justify-center gap-1.5 text-center text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to login
              </button>
            </div>
          ) : showForgotPassword ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Enter your account email and we'll send a password reset link.</p>
              {resetMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{resetMessage}</span>
                </div>
              )}
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="your.email@ncf.edu.ph"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E]"
                    required
                  />
                </div>
                <button
                  type="submit" disabled={resetSending}
                  className="w-full py-2.5 px-4 bg-[#00873E] hover:bg-[#007033] text-white font-bold text-sm rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {resetSending ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
              <button
                type="button"
                onClick={() => { setShowForgotPassword(false); setResetMessage(''); }}
                className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                &larr; Back to login
              </button>
            </div>
          ) : (
          <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email or Student / Officer ID
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. mbautista@gbox.ncf.edu.ph"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E] focus:border-[#00873E] transition outline-hidden"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(true); setResetEmail(identifier.includes('@') ? identifier : ''); }}
                  className="text-[11px] font-bold text-[#00873E] hover:text-[#007033] cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00873E] focus:border-[#00873E] transition outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 bottom-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-[#00873E] hover:bg-[#007033] text-white font-bold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoading ? 'Signing in...' : 'Log In'}</span>
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-slate-500">
            Don't have an account?{' '}
            <button
              onClick={onGoToRegister}
              className="font-bold text-[#00873E] hover:text-[#007033] cursor-pointer underline underline-offset-2"
            >
              Register here
            </button>
          </div>
          </>
          )}

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
