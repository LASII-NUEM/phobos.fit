import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { NyquistCurveIcon } from './icons/CustomIcons';
import { AUTH_CONFIG } from '../config/authConfig';

interface LoginPageProps {
  onLoginSuccess: (username: string) => void;
  isBackendOnline?: boolean | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  isBackendOnline,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const inputUser = username.trim();
    const inputPass = password.trim();

    // Check against configured credentials (case-insensitive for username, exact for password)
    const validUser = AUTH_CONFIG.CREDENTIALS.USERNAME;
    const validPass = AUTH_CONFIG.CREDENTIALS.PASSWORD;

    const isUserMatch = inputUser.toLowerCase() === validUser.toLowerCase();
    const isPassMatch = inputPass === validPass;

    setTimeout(() => {
      if (isUserMatch && isPassMatch) {
        const storage = rememberMe ? localStorage : sessionStorage;
        try {
          storage.setItem(AUTH_CONFIG.SESSION_STORAGE_KEY, validUser);
        } catch {
          // ignore storage quota errors
        }
        onLoginSuccess(validUser);
      } else {
        setErrorMessage('Invalid username or password. Please verify your credentials.');
        setIsSubmitting(false);
      }
    }, 200);
  };

  return (
    <div className="min-h-screen w-full bg-[#07090e] text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200 relative overflow-hidden">
      {/* Background ambient decorative glows */}
      <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[650px] h-[450px] bg-cyan-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[400px] bg-blue-700/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />

      {/* Top minimal header */}
      <header className="h-16 px-6 sm:px-10 flex items-center justify-between border-b border-slate-800/60 z-10 bg-[#080d17]/60 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-mono text-xl font-extrabold tracking-wider">PHOBOS</span>
          <span className="text-slate-400 font-sans font-medium text-sm">Zfit</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-full border border-slate-800">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isBackendOnline === true
                  ? 'bg-emerald-400 animate-pulse'
                  : isBackendOnline === false
                  ? 'bg-cyan-400'
                  : 'bg-slate-500 animate-pulse'
              }`}
            />
            <span className="hidden sm:inline">Render API:</span>
            <span className={isBackendOnline === true ? 'text-emerald-400' : 'text-slate-400'}>
              {isBackendOnline === true
                ? 'Online'
                : isBackendOnline === false
                ? 'Standby'
                : 'Checking'}
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-500 hidden md:block">
            LASII • NUEM • UTFPR
          </div>
        </div>
      </header>

      {/* Main Login Form Modal/Card - clean user/password space */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10">
        <div className="w-full max-w-md bg-[#0c1220]/95 border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl relative overflow-hidden">
          {/* Subtle cyan accent line at top of card */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-80" />

          {/* Card Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#131d33] border border-cyan-500/30 text-cyan-400 mb-4 shadow-inner shadow-cyan-500/10">
              <NyquistCurveIcon className="w-7 h-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              Phobos Login
            </h1>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User field */}
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
              >
                User ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="username"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. LASII"
                  className="w-full bg-[#101726] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-colors"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-300 uppercase tracking-wider"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-[#101726] border border-slate-700/80 rounded-xl pl-10 pr-11 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember session checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#101726] border-slate-700 text-cyan-500 focus:ring-cyan-500/30 accent-cyan-400 cursor-pointer"
                />
                <span className="text-xs text-slate-300">Keep me signed in</span>
              </label>

              <span className="text-[11px] text-slate-500 font-mono">
                SECURE ACCESS
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Access Workbench</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
