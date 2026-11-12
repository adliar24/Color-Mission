import React from 'react';
import { STAGE_DEFINITIONS, getColorsByCategory, getColorDef } from '../game/rules';
import { ArrowRight } from 'lucide-react';

interface StageTransitionModalProps {
  clearedStageNumber: 1 | 2;
  stageScoreBonus: number;
  onContinue: () => void;
}

export const StageTransitionModal: React.FC<StageTransitionModalProps> = ({
  clearedStageNumber,
  stageScoreBonus,
  onContinue,
}) => {
  const nextStageNumber = (clearedStageNumber + 1) as 2 | 3;
  const nextStage = STAGE_DEFINITIONS[nextStageNumber];
  const nextColors = getColorsByCategory(nextStage.category);

  return (
    <div className="fixed inset-0 bg-[#050811]/88 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans text-white">
      <div className="max-w-lg w-full bg-[#090d18] border border-white/15 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center text-center">
        <span className="text-xs font-extrabold tracking-widest uppercase text-cyan-400">
          STAGE {clearedStageNumber} SELESAI · +{stageScoreBonus.toLocaleString('id-ID')}
        </span>

        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white mt-1 mb-6">
          BERIKUTNYA: STAGE {nextStageNumber}
        </h2>

        {/* Rumus Pencampuran Visual Tersusun Rapi ke Bawah (3 Kolom Warna per Baris) */}
        <div className="w-full flex flex-col gap-2.5 mb-7 max-h-[58vh] overflow-y-auto pr-0.5">
          {nextColors.map((col) => {
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

        <button
          type="button"
          onClick={onContinue}
          className="w-full h-12 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <span>LANJUTKAN</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
