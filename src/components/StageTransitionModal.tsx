import React from 'react';
import { STAGE_DEFINITIONS, getColorsByCategory, getColorDef } from '../game/rules';
import { ArrowRight, CheckCircle2, Plus, Shield, Crosshair } from 'lucide-react';
import { GamepadBadge } from './GamepadBadge';

interface StageTransitionModalProps {
  mode: 'stage_clear' | 'stage_intro';
  stageNumber: 1 | 2 | 3;
  stageScoreBonus: number;
  onContinue: () => void;
  isGamepadConnected?: boolean;
}

export const StageTransitionModal: React.FC<StageTransitionModalProps> = ({
  mode,
  stageNumber,
  stageScoreBonus,
  onContinue,
  isGamepadConnected = false,
}) => {
  const stageDef = STAGE_DEFINITIONS[stageNumber];
  const stageColors = getColorsByCategory(stageDef.category);

  if (mode === 'stage_clear') {
    const nextStageNum = (stageNumber + 1) as 2 | 3;
    return (
      <div className="fixed inset-0 bg-[#050811]/88 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans text-white ui-backdrop-enter">
        <div
          data-ui-board="true"
          className="max-w-md w-full bg-[#090d18] border border-emerald-400/30 rounded-3xl p-7 md:p-8 shadow-2xl flex flex-col items-center text-center ui-panel-enter"
        >
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 mb-4 text-emerald-400">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <span className="text-xs font-extrabold tracking-widest uppercase text-emerald-400">
            BONUS +{stageScoreBonus.toLocaleString('id-ID')} SKOR
          </span>

          <h2 className="text-3xl font-black uppercase tracking-tight text-white mt-1 mb-2">
            STAGE {stageNumber} BERHASIL!
          </h2>

          <p className="text-sm text-slate-300 mb-7">
            Seluruh target pada Stage {stageNumber} berhasil dieliminasi. Siap lanjut ke Stage{' '}
            {nextStageNum}?
          </p>

          <button
            type="button"
            onClick={onContinue}
            className="w-full h-12 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>LANJUT KE STAGE {nextStageNum}</span>
            <ArrowRight className="w-4 h-4" />
            <GamepadBadge button="A" visible={isGamepadConnected} size="sm" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#050811]/88 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans text-white ui-backdrop-enter">
      <div
        data-ui-board="true"
        className="max-w-lg w-full bg-[#090d18] border border-white/15 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center text-center ui-panel-enter"
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
            <div className="w-full flex flex-col gap-2.5 max-h-[42vh] overflow-y-auto pr-0.5">
              {stageColors.map((col) => {
                const ing1 = col.ingredients ? getColorDef(col.ingredients[0]) : null;
                const ing2 = col.ingredients ? getColorDef(col.ingredients[1]) : null;
                return (
                  <div
                    key={col.id}
                    className="w-full bg-white/5 border border-white/10 px-5 py-3 rounded-2xl flex items-center justify-center gap-4"
                  >
                    {ing1 && ing2 && (
                      <>
                        <div
                          className="w-11 h-11 rounded-xl border-2 border-white shrink-0 shadow-md"
                          style={{ backgroundColor: ing1.hex }}
                        />
                        <span className="text-lg font-black text-cyan-400">+</span>
                        <div
                          className="w-11 h-11 rounded-xl border-2 border-white shrink-0 shadow-md"
                          style={{ backgroundColor: ing2.hex }}
                        />
                        <span className="text-lg font-black text-slate-400">=</span>
                        <div
                          className="w-11 h-11 rounded-xl border-2 border-white shrink-0 shadow-md"
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
          <GamepadBadge button="A" visible={isGamepadConnected} size="sm" />
        </button>
      </div>
    </div>
  );
};
