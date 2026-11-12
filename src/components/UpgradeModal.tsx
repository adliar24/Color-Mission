import React from 'react';
import { CyberUpgrade } from '../game/types';
import {
  Zap,
  HeartPulse,
  Shield,
  Target,
  Cpu,
  Flame,
  Activity,
  ShieldAlert,
  FastForward,
} from 'lucide-react';
import { sound } from '../game/audio';

interface UpgradeModalProps {
  upgrades: CyberUpgrade[];
  onSelectUpgrade: (upgrade: CyberUpgrade) => void;
  stageNumber: number;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Zap: <Zap className="w-6 h-6" />,
  HeartPulse: <HeartPulse className="w-6 h-6" />,
  Shield: <Shield className="w-6 h-6" />,
  Target: <Target className="w-6 h-6" />,
  Cpu: <Cpu className="w-6 h-6" />,
  Flame: <Flame className="w-6 h-6" />,
  Activity: <Activity className="w-6 h-6" />,
  ShieldAlert: <ShieldAlert className="w-6 h-6" />,
  FastForward: <FastForward className="w-6 h-6" />,
};

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  upgrades,
  onSelectUpgrade,
}) => {
  return (
    <div className="fixed inset-0 bg-[#050811]/88 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans text-white">
      <div className="max-w-3xl w-full flex flex-col items-center">
        <h2 className="text-2xl md:text-3xl font-black tracking-tight uppercase mb-6">
          PILIH UPGRADE
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {upgrades.map((upg) => (
            <button
              key={upg.id}
              type="button"
              onClick={() => {
                sound.playWaveFanfare();
                onSelectUpgrade(upg);
              }}
              className="group text-left bg-[#090d18] border border-white/15 hover:border-cyan-400 rounded-3xl p-6 flex flex-col justify-between transition-all duration-150 hover:-translate-y-1 cursor-pointer shadow-2xl"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-cyan-400/15 border border-cyan-400/30 text-cyan-400 flex items-center justify-center mb-4">
                  {ICON_MAP[upg.icon] || <Cpu className="w-6 h-6" />}
                </div>

                <h3 className="text-lg font-extrabold text-white mb-1.5">
                  {upg.name}
                </h3>

                <p className="text-xs font-medium text-slate-300 leading-relaxed mb-5">
                  {upg.description}
                </p>
              </div>

              <div className="w-full h-10 rounded-xl bg-white/8 group-hover:bg-cyan-400 group-hover:text-slate-950 flex items-center justify-center text-xs font-black uppercase tracking-wide text-white transition-colors">
                PILIH
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
