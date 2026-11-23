import React, { useState, useEffect, useCallback } from 'react';
import { GameShell } from './components/GameShell';
import { AdminDashboard } from './components/admin/AdminDashboard';
import {
  ArrowLeft,
  Mail,
  KeyRound,
  AlertCircle,
  Shield,
  LogIn,
} from 'lucide-react';
import {
  checkAdminSession,
  loginAdminUser,
  logoutAdminUser,
} from './lib/supabase';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'game' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('page') === 'admin' || window.location.hash === '#/admin') {
        return 'admin';
      }
    }
    return 'game';
  });

  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [emailOrUsername, setEmailOrUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [autostart] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('autostart') === '1';
    }
    return false;
  });

  // Verifikasi otomatis jika sudah ada sesi Supabase aktif
  useEffect(() => {
    async function verifySession() {
      const hasSession = await checkAdminSession();
      if (hasSession) {
        setIsAdminUnlocked(true);
      }
    }
    verifySession();
  }, []);

  // Sinkronisasi navigasi URL
  const navigateTo = useCallback((page: 'game' | 'admin') => {
    setCurrentPage(page);
    setAuthError(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (page === 'admin') {
        url.searchParams.set('page', 'admin');
        window.history.pushState({}, '', url.toString());
      } else {
        url.searchParams.delete('page');
        if (window.location.hash === '#/admin') {
          window.location.hash = '';
        }
        window.history.pushState({}, '', url.toString());
      }
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('page') === 'admin' || window.location.hash === '#/admin') {
        setCurrentPage('admin');
      } else {
        setCurrentPage('game');
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  // Handler Submit Login ke Supabase
  const handleSubmitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const identifier = emailOrUsername.trim();
    if (!identifier) {
      setAuthError('Silakan masukkan email atau username akun Supabase.');
      return;
    }
    if (!password) {
      setAuthError('Silakan masukkan password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await loginAdminUser(identifier, password);
      if (res.success) {
        setIsAdminUnlocked(true);
      } else {
        setAuthError(res.error || 'Email/username atau password salah.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logoutAdminUser();
    setIsAdminUnlocked(false);
    setEmailOrUsername('');
    setPassword('');
  };

  return (
    <div className="w-full h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {currentPage === 'admin' ? (
        isAdminUnlocked ? (
          <div className="w-full h-full overflow-y-auto">
            <AdminDashboard
              onBackToGame={() => navigateTo('game')}
              onLogout={handleLogout}
            />
          </div>
        ) : (
          /* ================================================================
             LOGIN SUPABASE AUTH (FOKUS & BERSIH)
             ================================================================ */
          <div className="w-full h-full bg-[#050811] flex items-center justify-center p-4">
            <div className="max-w-sm w-full bg-[#090e1c] border border-white/12 rounded-3xl p-6 sm:p-7 shadow-2xl text-left">
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight uppercase leading-tight">
                    Login Panel Guru
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Gunakan akun Supabase Auth Anda
                  </p>
                </div>
              </div>

              {/* Form Input */}
              <form onSubmit={handleSubmitAuth} className="flex flex-col gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Email / Username
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      autoFocus
                      value={emailOrUsername}
                      onChange={(e) => {
                        setEmailOrUsername(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      placeholder="contoh: guru@sekolah.sch.id"
                      className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#060a14] border border-white/15 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      placeholder="Masukkan password akun..."
                      className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#060a14] border border-white/15 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {/* Notifikasi Error */}
                {authError && (
                  <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                {/* Tombol Aksi */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => navigateTo('game')}
                    className="h-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Kembali</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-10 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Memproses...' : 'Masuk Panel'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      ) : (
        <GameShell autostart={autostart} onOpenAdmin={() => navigateTo('admin')} />
      )}
    </div>
  );
}
