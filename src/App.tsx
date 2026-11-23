import React, { useState, useEffect, useCallback } from 'react';
import { GameShell } from './components/GameShell';
import { AdminDashboard } from './components/admin/AdminDashboard';
import {
  Lock,
  ArrowLeft,
  User,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Shield,
  UserPlus,
  LogIn,
} from 'lucide-react';
import {
  checkAdminSession,
  loginAdminUser,
  registerAdminUser,
  logoutAdminUser,
  isSupabaseConfigured,
} from './lib/supabase';

const LS_ADMIN_PIN_KEY = 'color_mission_admin_pin';
const DEFAULT_PIN = '1234';

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
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'pin'>('login');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [emergencyPin, setEmergencyPin] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [autostart] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('autostart') === '1';
    }
    return false;
  });

  // Cek apakah sudah ada sesi login aktif di Supabase saat pertama kali dimuat
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
    setAuthSuccess(null);
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

  // Handler Submit Login / Register
  const handleSubmitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (authMode === 'pin') {
      const storedPin = localStorage.getItem(LS_ADMIN_PIN_KEY) || DEFAULT_PIN;
      if (emergencyPin.trim() === storedPin) {
        setIsAdminUnlocked(true);
      } else {
        setAuthError('PIN Darurat salah. (Default: 1234)');
      }
      return;
    }

    if (!username.trim()) {
      setAuthError('Silakan masukkan username atau email.');
      return;
    }
    if (!password) {
      setAuthError('Silakan masukkan password.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (authMode === 'login') {
        const res = await loginAdminUser(username, password);
        if (res.success) {
          setIsAdminUnlocked(true);
        } else {
          setAuthError(res.error || 'Username atau password salah.');
        }
      } else {
        // Register akun baru di Supabase
        const res = await registerAdminUser(username, password);
        if (res.success) {
          if (res.needEmailConfirm) {
            setAuthSuccess('Akun berhasil didaftarkan di Supabase. Silakan login.');
            setAuthMode('login');
          } else {
            setIsAdminUnlocked(true);
          }
        } else {
          setAuthError(res.error || 'Gagal mendaftar akun di Supabase.');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logoutAdminUser();
    setIsAdminUnlocked(false);
    setUsername('');
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
             LOGIN ADMIN GURU TERHUBUNG SUPABASE (ANTI-SLOP & PADAT)
             ================================================================ */
          <div className="w-full h-full bg-[#050811] flex items-center justify-center p-4">
            <div className="max-w-sm w-full bg-[#090e1c] border border-white/12 rounded-3xl p-6 sm:p-7 shadow-2xl text-left">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight uppercase leading-tight">
                    {authMode === 'register'
                      ? 'Daftar Akun Guru'
                      : authMode === 'pin'
                      ? 'Akses PIN Darurat'
                      : 'Login Panel Guru'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {authMode === 'pin'
                      ? 'Gunakan PIN lokal jika Supabase offline'
                      : 'Terhubung langsung ke database Supabase'}
                  </p>
                </div>
              </div>

              {/* Tab Mode: Masuk vs Daftar Akun Baru */}
              {authMode !== 'pin' && (
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError(null);
                    }}
                    className={`h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      authMode === 'login'
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Masuk</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setAuthError(null);
                    }}
                    className={`h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      authMode === 'register'
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Buat Akun</span>
                  </button>
                </div>
              )}

              {/* Form Input */}
              <form onSubmit={handleSubmitAuth} className="flex flex-col gap-3">
                {authMode === 'pin' ? (
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      PIN Pengajar
                    </label>
                    <input
                      type="password"
                      maxLength={8}
                      autoFocus
                      value={emergencyPin}
                      onChange={(e) => {
                        setEmergencyPin(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      placeholder="Masukkan PIN lokal (1234)..."
                      className="w-full h-10 text-center tracking-widest font-mono text-base rounded-xl bg-[#060a14] border border-white/15 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Username / Email Guru
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          autoFocus
                          value={username}
                          onChange={(e) => {
                            setUsername(e.target.value);
                            if (authError) setAuthError(null);
                          }}
                          placeholder="contoh: guru_admin atau guru@sekolah.id"
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
                          placeholder="Minimal 6 karakter..."
                          className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#060a14] border border-white/15 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Notifikasi Error & Sukses */}
                {authError && (
                  <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                {authSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{authSuccess}</span>
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
                    className="h-10 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md flex items-center justify-center"
                  >
                    {isSubmitting ? (
                      <span className="animate-pulse">Memproses...</span>
                    ) : authMode === 'register' ? (
                      'Daftar Akun'
                    ) : authMode === 'pin' ? (
                      'Buka Panel'
                    ) : (
                      'Masuk Panel'
                    )}
                  </button>
                </div>
              </form>

              {/* Opsi Switch ke PIN Darurat / Mode Supabase */}
              <div className="mt-4 pt-3 border-t border-white/10 text-center">
                {authMode === 'pin' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError(null);
                    }}
                    className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                  >
                    Gunakan Akun Supabase (Username &amp; Password)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('pin');
                      setAuthError(null);
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-300 cursor-pointer"
                  >
                    Gunakan PIN Darurat (Offline)
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      ) : (
        <GameShell autostart={autostart} onOpenAdmin={() => navigateTo('admin')} />
      )}
    </div>
  );
}
