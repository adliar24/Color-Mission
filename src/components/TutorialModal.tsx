import React from 'react';
import { Play, X } from 'lucide-react';
import { getColorsByCategory } from '../game/rules';
import { PlatformMode } from '../game/types';

interface TutorialModalProps {
  platformMode?: PlatformMode;
  onClose: () => void;
  onStartMission: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({
  platformMode = 'desktop',
  onClose,
  onStartMission,
}) => {
  const primerColors = getColorsByCategory('primer');
  const sekunderColors = getColorsByCategory('sekunder');
  const tersierColors = getColorsByCategory('tersier');

  return (
    <div className="fixed inset-0 bg-[#050811]/88 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans text-white">
      <div className="max-w-xl w-full bg-[#090d18] border border-white/15 rounded-3xl p-6 md:p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black tracking-tight uppercase">CARA BERMAIN</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/6 hover:bg-white/12 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visual Mekanik Warna (Kotak Polos Berwarna Tanpa Teks Panjang) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {/* Stage 1 */}
          <div className="bg-white/4 border border-white/10 p-4 rounded-2xl flex flex-col items-center text-center gap-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400">
              STAGE 1 · TARGET LANGSUNG
            </span>
            <div className="w-12 h-12 rounded-xl bg-[#EF233C] border-2 border-white shadow-md" />
            <span className="text-xs font-semibold text-slate-300">
              Tembak robot dengan warna yang sama.
            </span>
          </div>

          {/* Stage 2 & 3 */}
          <div className="bg-white/4 border border-white/10 p-4 rounded-2xl flex flex-col items-center text-center gap-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400">
              STAGE 2 & 3 · CAMPURAN WARNA
            </span>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-[#EF233C] border-2 border-white" />
              <span className="text-lg font-black text-cyan-400">+</span>
              <div className="w-10 h-10 rounded-xl bg-[#FFD60A] border-2 border-white" />
              <span className="text-lg font-black text-slate-400">=</span>
              <div className="w-10 h-10 rounded-xl bg-[#FF7A00] border-2 border-white" />
            </div>
            <span className="text-xs font-semibold text-slate-300">
              Tebak hasil campuran & tembak robotnya.
            </span>
          </div>
        </div>

        {/* Baris Spektrum Kotak Polos (3 Stage) */}
        <div className="bg-white/4 border border-white/10 p-4 rounded-2xl mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-300">STAGE 1</span>
            <div className="flex gap-2">
              {primerColors.map((c) => (
                <div
                  key={c.id}
                  className="w-7 h-7 rounded-lg border-2 border-white/90"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/8 pt-2.5">
            <span className="text-xs font-extrabold text-slate-300">STAGE 2</span>
            <div className="flex gap-2">
              {sekunderColors.map((c) => (
                <div
                  key={c.id}
                  className="w-7 h-7 rounded-lg border-2 border-white/90"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/8 pt-2.5">
            <span className="text-xs font-extrabold text-slate-300">STAGE 3</span>
            <div className="flex gap-1.5">
              {tersierColors.map((c) => (
                <div
                  key={c.id}
                  className="w-7 h-7 rounded-lg border-2 border-white/90"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Kontrol Singkat (Otomatis Menyesuaikan Perangkat) */}
        <div className="bg-white/4 border border-white/10 px-4 py-3.5 rounded-2xl text-xs font-bold text-slate-200 text-center mb-6">
          {platformMode === 'desktop' && (
            <span>
              WASD / Stik Kiri Gerak · Mouse / Stik Kanan Bidik · Klik Kiri / RT Tembak · R / X
              Reload · Shift / B Dash
            </span>
          )}
          {platformMode === 'mobile' && (
            <span>
              Joystick Kiri Gerak · Geser Layar Kanan Bidik · Tombol Kanan Tembak & Skill
            </span>
          )}
          {platformMode === 'vr' && (
            <span>
              Analog Kiri Gerak · Trigger Kanan Tembak · Grip Kanan Reload · Grip Kiri Dash
            </span>
          )}
        </div>

        {/* Tombol Bawah */}
        <button
          type="button"
          onClick={onStartMission}
          className="w-full h-12 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-sm font-black uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>MULAI MISI</span>
        </button>
      </div>
    </div>
  );
};
