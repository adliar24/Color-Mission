import React, { useState, useEffect, useCallback } from 'react';
import { GameShell } from './components/GameShell';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { Lock, ArrowLeft, KeyRound, AlertCircle } from 'lucide-react';

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
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [autostart] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('autostart') === '1';
    }
    return false;
  });

  // Sinkronisasi navigasi URL
  const navigateTo = useCallback((page: 'game' | 'admin') => {
    setCurrentPage(page);
    setPinError(null);
    setEnteredPin('');
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

  const handleVerifyPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const storedPin = localStorage.getItem(LS_ADMIN_PIN_KEY) || DEFAULT_PIN;
    if (enteredPin.trim() === storedPin) {
      setIsAdminUnlocked(true);
      setPinError(null);
    } else {
      setPinError('PIN salah. Silakan coba lagi (Default: 1234).');
      setEnteredPin('');
    }
  };

  return (
    <div className="w-full h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {currentPage === 'admin' ? (
        isAdminUnlocked ? (
          <div className="w-full h-full overflow-y-auto">
            <AdminDashboard onBackToGame={() => navigateTo('game')} />
          </div>
        ) : (
          /* ================================================================
             PROMPT PIN AKSES GURU (RINGKAS & BERSIH)
             ================================================================ */
          <div className="w-full h-full bg-[#050811] flex items-center justify-center p-4">
            <div className="max-w-sm w-full bg-[#090e1c] border border-white/12 rounded-3xl p-6 shadow-2xl text-center">
              <div className="w-12 h-12 mx-auto mb-3.5 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Lock className="w-5 h-5" />
              </div>

              <h2 className="text-lg font-bold text-white tracking-tight uppercase">
                Akses Panel Guru
              </h2>
              <p className="text-xs text-slate-400 mt-1 mb-5">
                Masukkan 4 digit PIN pengajar untuk membuka rekap data siswa.
              </p>

              <form onSubmit={handleVerifyPin} className="flex flex-col gap-3">
                <div>
                  <input
                    type="password"
                    maxLength={8}
                    autoFocus
                    value={enteredPin}
                    onChange={(e) => {
                      setEnteredPin(e.target.value);
                      if (pinError) setPinError(null);
                    }}
                    placeholder="Masukkan PIN..."
                    className="w-full h-11 text-center text-lg tracking-widest font-mono rounded-xl bg-[#060a14] border border-white/15 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                  />
                  {pinError && (
                    <div className="mt-2 text-xs text-red-400 flex items-center justify-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{pinError}</span>
                    </div>
                  )}
                </div>

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
                    className="h-10 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md"
                  >
                    Buka Panel
                  </button>
                </div>
              </form>

              <p className="text-[11px] text-slate-500 mt-5">
                PIN Bawaan: <code className="text-slate-400 font-mono">1234</code>
              </p>
            </div>
          </div>
        )
      ) : (
        <GameShell autostart={autostart} onOpenAdmin={() => navigateTo('admin')} />
      )}
    </div>
  );
}
