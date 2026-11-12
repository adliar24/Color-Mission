import React from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Sliders, Home } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onReturnToMenu: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onOpenSettings,
  onReturnToMenu,
  onToggleMute,
  isMuted,
}) => {
  return (
    <div className="fixed inset-0 bg-[#050811]/88 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans text-white">
      <div className="max-w-sm w-full bg-[#090d18] border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
        <h2 className="text-2xl font-black tracking-tight uppercase mb-6">JEDA</h2>

        <div className="flex flex-col gap-2.5 w-full">
          <button
            type="button"
            onClick={onResume}
            className="w-full h-12 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black uppercase tracking-wide rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>LANJUTKAN</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full h-11 bg-white/6 hover:bg-white/12 border border-white/10 text-white font-bold text-sm uppercase tracking-wide rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>PENGATURAN</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="w-full h-11 bg-white/6 hover:bg-white/12 border border-white/10 text-white font-bold text-sm uppercase tracking-wide rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
            <span>{isMuted ? 'SUARA: MATI' : 'SUARA: AKTIF'}</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full h-11 bg-white/6 hover:bg-white/12 border border-white/10 text-white font-bold text-sm uppercase tracking-wide rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>ULANGI MISI</span>
          </button>

          <button
            type="button"
            onClick={onReturnToMenu}
            className="w-full h-11 bg-transparent hover:bg-white/6 border border-white/10 text-slate-300 hover:text-white font-bold text-sm uppercase tracking-wide rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer mt-1"
          >
            <Home className="w-4 h-4" />
            <span>MENU UTAMA</span>
          </button>
        </div>
      </div>
    </div>
  );
};
