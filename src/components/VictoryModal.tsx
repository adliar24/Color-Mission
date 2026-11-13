import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RunSummary } from '../game/types';
import { ALL_RYB_COLORS } from '../game/rules';
import {
  Trophy,
  RotateCcw,
  Home,
} from 'lucide-react';

interface VictoryModalProps {
  summary: RunSummary;
  score: number;
  onRestart: () => void;
  onReturnToMenu: () => void;
  isGamepadConnected?: boolean;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  summary,
  score,
  onRestart,
  onReturnToMenu,
  isGamepadConnected = false,
}) => {
  useEffect(() => {
    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#EF233C', '#FFD60A', '#1D6FFF', '#FF7A00', '#16A34A', '#8B5CF6'],
      });
    } catch {}
  }, []);

  return (
    <div className="fixed inset-0 bg-[#050811]/75 flex items-center justify-center p-4 z-50 font-sans text-white ui-backdrop-enter">
      <div
        data-ui-board="true"
        className="max-w-md sm:max-w-lg w-full bg-[#090d18]/96 border border-white/15 rounded-3xl p-5 md:p-7 shadow-2xl flex flex-col items-center text-center ui-panel-enter"
      >
        <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 mb-2.5 text-emerald-400">
          <Trophy className="w-7 h-7" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mb-4">
          MISI SELESAI!
        </h2>

        {/* Skor Akhir */}
        <div className="w-full bg-white/4 border border-white/10 p-3.5 rounded-2xl mb-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
            SKOR AKHIR
          </span>
          <span className="text-3xl sm:text-4xl font-black tabular-nums text-emerald-400">
            {score.toLocaleString('id-ID')}
          </span>
        </div>

        {/* Statistik Ringkas */}
        <div className="grid grid-cols-3 gap-2.5 w-full mb-3.5">
          <div className="bg-white/4 border border-white/10 p-2.5 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">AKURASI</span>
            <span className="text-base sm:text-lg font-black tabular-nums text-emerald-400">
              {summary.accuracy}%
            </span>
          </div>

          <div className="bg-white/4 border border-white/10 p-2.5 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">KOMBO</span>
            <span className="text-base sm:text-lg font-black tabular-nums text-cyan-400">
              {summary.bestCombo}x
            </span>
          </div>

          <div className="bg-white/4 border border-white/10 p-2.5 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">TARGET</span>
            <span className="text-base sm:text-lg font-black tabular-nums text-white">
              {summary.kills}
            </span>
          </div>
        </div>

        {/* 12 Kotak Warna Polos RYB (Tanpa Teks Nama Warna) */}
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 w-full bg-white/4 border border-white/10 p-3 rounded-2xl mb-4">
          {ALL_RYB_COLORS.map((col) => (
            <div
              key={col.id}
              className="aspect-square rounded-lg border-2 border-white/90 shadow-sm"
              style={{ backgroundColor: col.hex }}
            />
          ))}
        </div>

        {/* Tombol Aksi */}
        <div className="flex flex-col sm:flex-row gap-2.5 w-full">
          <button
            type="button"
            onClick={onRestart}
            className="w-full h-11 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wide rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>MAIN LAGI</span>
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
