import React from 'react';
import { RunSummary } from '../game/types';
import {
  RotateCcw,
  Skull,
  Home,
} from 'lucide-react';

interface GameOverModalProps {
  summary: RunSummary;
  score: number;
  onRestart: () => void;
  onReturnToMenu: () => void;
  isGamepadConnected?: boolean;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  summary,
  score,
  onRestart,
  onReturnToMenu,
  isGamepadConnected = false,
}) => {
  return (
    <div className="fixed inset-0 bg-[#050811]/55 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans text-white ui-backdrop-enter">
      <div data-ui-board="true" className="max-w-md w-full bg-[#090d18]/92 border border-white/15 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md flex flex-col items-center text-center ui-panel-enter">
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 mb-3 text-rose-400">
          <Skull className="w-8 h-8" />
        </div>

        <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-5">
          MISI GAGAL
        </h2>

        {/* Skor Akhir */}
        <div className="w-full bg-white/4 border border-white/10 p-4 rounded-2xl mb-4">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
            SKOR AKHIR
          </span>
          <span className="text-4xl font-black tabular-nums text-rose-400">
            {score.toLocaleString('id-ID')}
          </span>
        </div>

        {/* Statistik Ringkas */}
        <div className="grid grid-cols-3 gap-2.5 w-full mb-6">
          <div className="bg-white/4 border border-white/10 p-3 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">STAGE</span>
            <span className="text-lg font-black tabular-nums text-white">
              {summary.stagesCleared}/3
            </span>
          </div>

          <div className="bg-white/4 border border-white/10 p-3 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">KOMBO</span>
            <span className="text-lg font-black tabular-nums text-cyan-400">
              {summary.bestCombo}x
            </span>
          </div>

          <div className="bg-white/4 border border-white/10 p-3 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">AKURASI</span>
            <span className="text-lg font-black tabular-nums text-white">
              {summary.accuracy}%
            </span>
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="flex flex-col gap-2.5 w-full">
          <button
            type="button"
            onClick={onRestart}
            className="w-full h-12 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black uppercase tracking-wide rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>COBA LAGI</span>
          </button>

          <button
            type="button"
            onClick={onReturnToMenu}
            className="w-full h-11 bg-white/6 hover:bg-white/12 text-white border border-white/12 font-bold text-xs uppercase tracking-wide rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4 text-slate-300" />
            <span>MENU UTAMA</span>
          </button>
        </div>
      </div>
    </div>
  );
};
