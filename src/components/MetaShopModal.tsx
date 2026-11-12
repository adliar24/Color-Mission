import React from 'react';
import { META_PERKS_CATALOG } from '../game/rules';
import { MetaProgressionState } from '../game/types';
import { Disc, X, Check, Shield, Heart, Zap, FastForward } from 'lucide-react';
import { sound } from '../game/audio';

interface MetaShopModalProps {
  metaState: MetaProgressionState;
  onUpgradePerk: (perkId: string) => void;
  onClose: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  meta_hp: <Heart className="w-5 h-5 text-rose-400" />,
  meta_shield: <Shield className="w-5 h-5 text-cyan-400" />,
  meta_damage: <Zap className="w-5 h-5 text-amber-400" />,
  meta_dash: <FastForward className="w-5 h-5 text-cyan-300" />,
};

export const MetaShopModal: React.FC<MetaShopModalProps> = ({
  metaState,
  onUpgradePerk,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-[#050811]/88 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans text-white">
      <div className="max-w-lg w-full bg-[#090d18] border border-white/15 rounded-3xl p-6 md:p-7 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black tracking-tight uppercase">UPGRADE</h2>
            <div className="flex items-center gap-1.5 bg-white/6 border border-white/10 px-3 py-1 rounded-xl">
              <Disc className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-black tabular-nums text-white">
                {metaState.bankedDataCores}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/6 hover:bg-white/12 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Daftar Perk Ringkas */}
        <div className="flex flex-col gap-2.5 mb-6">
          {META_PERKS_CATALOG.map((perk) => {
            const currentLvl = metaState.perks[perk.id] || 0;
            const isMaxed = currentLvl >= perk.maxLevel;
            const nextCost = perk.costPerLevel * (currentLvl + 1);
            const canAfford = metaState.bankedDataCores >= nextCost && !isMaxed;

            return (
              <div
                key={perk.id}
                className="bg-white/4 border border-white/10 p-3.5 rounded-2xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    {ICON_MAP[perk.id]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-white">{perk.name}</h3>
                      <span className="text-xs font-bold text-cyan-400 tabular-nums">
                        Lv.{currentLvl}/{perk.maxLevel}
                      </span>
                    </div>
                    <div className="flex gap-1.5 mt-1.5">
                      {Array.from({ length: perk.maxLevel }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 w-6 rounded-full ${
                            i < currentLvl ? 'bg-cyan-400' : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={() => {
                    sound.playHitmarker(true);
                    onUpgradePerk(perk.id);
                  }}
                  className={`h-10 px-4 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shrink-0 transition-colors ${
                    isMaxed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                      : canAfford
                      ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 cursor-pointer'
                      : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
                  }`}
                >
                  {isMaxed ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>MAKS</span>
                    </>
                  ) : (
                    <>
                      <Disc className="w-3.5 h-3.5" />
                      <span className="tabular-nums">{nextCost}</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-2xl bg-white/8 hover:bg-white/12 text-xs font-black uppercase tracking-wide text-white cursor-pointer"
        >
          SELESAI
        </button>
      </div>
    </div>
  );
};
