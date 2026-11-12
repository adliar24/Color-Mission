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
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  summary,
  score,
  onRestart,
  onReturnToMenu,
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
    <div className="fixed inset-0 bg-[#050811]/55 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans text-white">
      <div className="max-w-md w-full bg-[#090d18]/92 border border-white/15 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md flex flex-col items-center text-center">
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 mb-3 text-emerald-400">
          <Trophy className="w-8 h-8" />
        </div>

        <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-5">
          MISI SELESAI!
        </h2>

        {/* Skor Akhir */}
        <div className="w-full bg-white/4 border border-white/10 p-4 rounded-2xl mb-4">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
            SKOR AKHIR
          </span>
          <span className="text-4xl font-black tabular-nums text-emerald-400">
            {score.toLocaleString('id-ID')}
          </span>
        </div>

        {/* Statistik Ringkas */}
        <div className="grid grid-cols-3 gap-2.5 w-full mb-5">
          <div className="bg-white/4 border border-white/10 p-3 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">AKURASI</span>
            <span className="text-lg font-black tabular-nums text-emerald-400">
              {summary.accuracy}%
            </span>
          </div>

          <div className="bg-white/4 border border-white/10 p-3 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">KOMBO</span>
            <span className="text-lg font-black tabular-nums text-cyan-400">
              {summary.bestCombo}x
            </span>
          </div>

          <div className="bg-white/4 border border-white/10 p-3 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">TARGET</span>
            <span className="text-lg font-black tabular-nums text-white">
              {summary.kills}
            </span>
          </div>
        </div>

        {/* 12 Kotak Warna Polos RYB (Tanpa Teks Nama Warna) */}
        <div className="grid grid-cols-6 gap-2 w-full bg-white/4 border border-white/10 p-3.5 rounded-2xl mb-6">
          {ALL_RYB_COLORS.map((col) => (
            <div
              key={col.id}
              className="aspect-square rounded-xl border-2 border-white/90 shadow-sm"
              style={{ backgroundColor: col.hex }}
            />
          ))}
        </div>

        {/* Tombol Aksi */}
        <div className="flex flex-col gap-2.5 w-full">
          <button
            type="button"
            onClick={onRestart}
            className="w-full h-12 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black uppercase tracking-wide rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
