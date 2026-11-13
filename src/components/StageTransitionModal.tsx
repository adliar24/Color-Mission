import React from 'react';
import {
  STAGE_DEFINITIONS,
  WEAPON_REGISTRY,
  getColorsByCategory,
  getColorDef,
} from '../game/rules';
import { ArrowRight, CheckCircle2, Plus, Shield, Crosshair } from 'lucide-react';
import { GamepadBadge } from './GamepadBadge';
import { WeaponType } from '../game/types';

const WeaponPreviewArt: React.FC<{ weaponId: WeaponType }> = ({ weaponId }) => {
  if (weaponId === 'cyber_shotgun') {
    return (
      <svg viewBox="0 0 120 64" className="w-full h-full" aria-label="Ilustrasi Cyber Shotgun">
        <defs>
          <linearGradient id="sgAccent" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff0055" />
            <stop offset="100%" stopColor="#ff6b9d" />
          </linearGradient>
        </defs>
        {/* Popor & Grip */}
        <path d="M12 30 L34 26 L36 39 L14 44 Z" fill="#1e1b2e" stroke="#475569" strokeWidth="1.5" />
        <path d="M38 38 L46 38 L42 54 L33 54 Z" fill="#111827" stroke="#475569" strokeWidth="1.5" />
        {/* Badan Utama */}
        <rect x="32" y="21" width="44" height="18" rx="3" fill="#271738" stroke="#64748b" strokeWidth="1.5" />
        {/* Laras Ganda & Pump */}
        <rect x="74" y="21" width="34" height="6.5" rx="2" fill="url(#sgAccent)" />
        <rect x="74" y="30" width="30" height="6.5" rx="2" fill="#e11d48" />
        <rect x="64" y="39" width="24" height="6" rx="2" fill="#0f172a" stroke="#ff0055" strokeWidth="1.2" />
        {/* Inti Energi */}
        <rect x="40" y="26" width="22" height="5" rx="1.5" fill="#ff0055" />
        <circle cx="109" cy="24" r="3" fill="#fda4af" opacity="0.85" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 64" className="w-full h-full" aria-label="Ilustrasi Chroma Railgun">
      <defs>
        <linearGradient id="rgAccent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#e879f9" />
        </linearGradient>
      </defs>
      {/* Popor & Grip */}
      <path d="M10 31 L30 27 L32 39 L12 43 Z" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
      <path d="M36 39 L44 39 L40 54 L32 54 Z" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
      {/* Badan & Optik */}
      <rect x="28" y="22" width="36" height="17" rx="3" fill="#1e1b4b" stroke="#818cf8" strokeWidth="1.4" />
      <rect x="36" y="15" width="18" height="5" rx="1.5" fill="#312e81" stroke="#c084fc" strokeWidth="1.2" />
      {/* Rel Panjang */}
      <rect x="64" y="22" width="46" height="4.5" rx="1.5" fill="#e2e8f0" />
      <rect x="64" y="33" width="46" height="4.5" rx="1.5" fill="#e2e8f0" />
      {/* Kumparan Energi */}
      <rect x="64" y="27.5" width="42" height="4.5" rx="1.5" fill="url(#rgAccent)" />
      <rect x="70" y="20" width="4" height="19" rx="1" fill="#bf00ff" />
      <rect x="82" y="20" width="4" height="19" rx="1" fill="#bf00ff" />
      <rect x="94" y="20" width="4" height="19" rx="1" fill="#bf00ff" />
      <circle cx="111" cy="30" r="3" fill="#f0abfc" opacity="0.9" />
    </svg>
  );
};

interface StageTransitionModalProps {
  mode: 'stage_clear' | 'stage_intro';
  stageNumber: 1 | 2 | 3;
  stageScoreBonus: number;
  stageScore?: number;
  onContinue: () => void;
  isGamepadConnected?: boolean;
}

export const StageTransitionModal: React.FC<StageTransitionModalProps> = ({
  mode,
  stageNumber,
  stageScoreBonus,
  stageScore = 0,
  onContinue,
  isGamepadConnected = false,
}) => {
  const stageDef = STAGE_DEFINITIONS[stageNumber];
  const stageColors = getColorsByCategory(stageDef.category);

  if (mode === 'stage_clear') {
    const nextStageNum = (stageNumber + 1) as 2 | 3;
    const unlockedWeaponId = nextStageNum === 2 ? 'cyber_shotgun' : 'railgun';
    const unlockedWeapon = WEAPON_REGISTRY[unlockedWeaponId];

    return (
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50 font-sans text-white">
        <div
          key={`${mode}-${stageNumber}`}
          data-ui-board="true"
          className="max-w-md w-full bg-[#090d18] border border-emerald-400/30 rounded-3xl p-7 md:p-8 shadow-2xl flex flex-col items-center text-center ui-panel-enter"
        >
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 mb-4 text-emerald-400">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-1.5">
            STAGE {stageNumber} BERHASIL!
          </h2>

          <p className="text-sm text-slate-300 mb-5">
            Seluruh target pada Stage {stageNumber} berhasil dieliminasi.
          </p>

          {/* Skor Stage & Bonus */}
          <div className="grid grid-cols-2 gap-2.5 w-full mb-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                SKOR STAGE {stageNumber}
              </span>
              <span className="text-xl font-black tabular-nums text-white mt-0.5">
                {stageScore.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-400/25 rounded-2xl p-3 flex flex-col items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                BONUS STAGE
              </span>
              <span className="text-xl font-black tabular-nums text-emerald-400 mt-0.5">
                +{stageScoreBonus.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Hadiah Senjata Baru */}
          <div className="w-full bg-cyan-500/10 border border-cyan-400/30 rounded-2xl p-3.5 mb-6 flex items-center gap-3.5 text-left">
            <div className="w-22 h-14 rounded-xl bg-[#0b1122] border border-white/15 p-1.5 flex items-center justify-center shrink-0 shadow-inner">
              <WeaponPreviewArt weaponId={unlockedWeaponId} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-300 block">
                HADIAH SENJATA BARU TERBUKA
              </span>
              <div className="text-sm font-black text-white truncate">
                {unlockedWeapon.name}
              </div>
              <div className="text-[11px] font-semibold text-slate-300">
                Damage {unlockedWeapon.damage}
                {(unlockedWeapon.pellets ?? 1) > 1 ? ` × ${unlockedWeapon.pellets}` : ''} ·{' '}
                {unlockedWeapon.magSize} Peluru Awal
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onContinue}
            className="w-full h-12 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>LANJUT KE STAGE {nextStageNum}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50 font-sans text-white">
      <div
        key={`${mode}-${stageNumber}`}
        data-ui-board="true"
        className={`w-full bg-[#090d18] border border-white/15 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center text-center ui-panel-enter ${
          stageNumber === 1 ? 'max-w-lg' : 'max-w-lg sm:max-w-2xl'
        }`}
      >
        <span className="text-xs font-extrabold tracking-widest uppercase text-cyan-400">
          STAGE {stageNumber} · {stageDef.targetEliminations} ELIMINASI
          {stageDef.hasBossAtEnd ? ' + BOSS' : ''}
        </span>

        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white mt-1 mb-5">
          {stageDef.subtitle}
        </h2>

        {/* Hint Warna untuk Stage Baru */}
        <div className="w-full mb-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2.5">
            {stageNumber === 1 ? 'HINT WARNA PRIMER' : 'HINT CAMPURAN WARNA'}
          </span>

          {stageNumber === 1 ? (
            <div className="grid grid-cols-3 gap-2.5">
              {stageColors.map((col) => (
                <div
                  key={col.id}
                  className="bg-white/5 border border-white/10 py-3 px-2 rounded-2xl flex flex-col items-center gap-2"
                >
                  <div
                    className="w-11 h-11 rounded-xl border-2 border-white shadow-md"
                    style={{ backgroundColor: col.hex }}
                  />
                  <span className="text-xs font-extrabold uppercase text-slate-200">
                    {col.nameId}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {stageColors.map((col) => {
                const ing1 = col.ingredients ? getColorDef(col.ingredients[0]) : null;
                const ing2 = col.ingredients ? getColorDef(col.ingredients[1]) : null;
                return (
                  <div
                    key={col.id}
                    className="w-full bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl flex items-center justify-center gap-3"
                  >
                    {ing1 && ing2 && (
                      <>
                        <div
                          className="w-9 h-9 rounded-xl border-2 border-white shrink-0 shadow-md"
                          style={{ backgroundColor: ing1.hex }}
                        />
                        <span className="text-base font-black text-cyan-400">+</span>
                        <div
                          className="w-9 h-9 rounded-xl border-2 border-white shrink-0 shadow-md"
                          style={{ backgroundColor: ing2.hex }}
                        />
                        <span className="text-base font-black text-slate-400">=</span>
                        <div
                          className="w-9 h-9 rounded-xl border-2 border-white shrink-0 shadow-md"
                          style={{ backgroundColor: col.hex }}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Petunjuk 3 Item Khusus di Stage 1 */}
        {stageNumber === 1 && (
          <div className="w-full mb-6">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2.5">
              PETUNJUK ITEM ARENA
            </span>
            <div className="grid grid-cols-3 gap-2.5 text-left">
              <div className="bg-emerald-500/10 border border-emerald-400/25 p-3 rounded-2xl flex flex-col items-center text-center gap-1.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Plus className="w-5 h-5 stroke-[3]" />
                </div>
                <span className="text-xs font-black text-emerald-300 uppercase">DARAH</span>
                <span className="text-[11px] text-slate-300 leading-tight">
                  Hijau (+) · Pulihkan HP
                </span>
              </div>

              <div className="bg-blue-500/10 border border-blue-400/25 p-3 rounded-2xl flex flex-col items-center text-center gap-1.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <Shield className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-blue-300 uppercase">PERISAI</span>
                <span className="text-[11px] text-slate-300 leading-tight">
                  Biru · Tambah Shield
                </span>
              </div>

              <div className="bg-slate-400/10 border border-slate-400/25 p-3 rounded-2xl flex flex-col items-center text-center gap-1.5">
                <div className="w-8 h-8 rounded-xl bg-slate-400/20 flex items-center justify-center text-slate-300">
                  <Crosshair className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-slate-200 uppercase">PELURU</span>
                <span className="text-[11px] text-slate-300 leading-tight">
                  Abu · Isi Ulang Amunisi
                </span>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onContinue}
          className="w-full h-12 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <span>MULAI STAGE {stageNumber}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
