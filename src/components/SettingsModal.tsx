import React from 'react';
import { GameSettings, GraphicsQuality, VRMovementMode, VRTurnMode } from '../game/types';
import { MobileInput } from '../game/input/InputManager';
import { X, Volume2, VolumeX, Check } from 'lucide-react';
import { GamepadBadge } from './GamepadBadge';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (updated: GameSettings) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onClose: () => void;
  isGamepadConnected?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  isMuted,
  onToggleMute,
  onClose,
  isGamepadConnected = false,
}) => {
  const handleToggleGyro = async () => {
    const nextState = !settings.mobileGyroEnabled;
    if (nextState) {
      await MobileInput.requestGyroPermission();
    }
    onUpdateSettings({
      ...settings,
      mobileGyroEnabled: nextState,
    });
  };

  return (
    <div className="fixed inset-0 bg-[#050811]/88 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans text-white ui-backdrop-enter">
      <div data-ui-board="true" className="max-w-md w-full bg-[#090d18] border border-white/15 rounded-3xl p-6 md:p-7 shadow-2xl max-h-[92vh] overflow-y-auto ui-panel-enter">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-black tracking-tight uppercase">PENGATURAN</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/6 hover:bg-white/12 text-slate-300 hover:text-white cursor-pointer flex items-center gap-1.5"
          >
            <GamepadBadge button="B" visible={isGamepadConnected} size="sm" />
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3.5 text-sm">
          {/* Audio, Getaran & Grafis */}
          <div className="bg-white/4 border border-white/10 p-4 rounded-2xl space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                SUARA
              </span>
              <button
                type="button"
                onClick={onToggleMute}
                className={`px-4 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${
                  isMuted
                    ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                    : 'bg-cyan-400 text-slate-950'
                }`}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>{isMuted ? 'MATI' : 'AKTIF'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                GETARAN (HAPTIC)
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    hapticsEnabled: !settings.hapticsEnabled,
                  })
                }
                className={`px-4 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                  settings.hapticsEnabled
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-white/6 border border-white/10 text-slate-400'
                }`}
              >
                {settings.hapticsEnabled ? 'AKTIF' : 'MATI'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                GYRO HP (MOBILE)
              </span>
              <button
                type="button"
                onClick={handleToggleGyro}
                className={`px-4 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                  settings.mobileGyroEnabled
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-white/6 border border-white/10 text-slate-400'
                }`}
              >
                {settings.mobileGyroEnabled ? 'AKTIF' : 'MATI'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 block">
                  FULL KEYBOARD (TANPA MOUSE)
                </span>
                <span className="text-[11px] text-slate-400">
                  Gerak: WASD · Kamera: Panah · Tembak: Enter
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    keyboardCameraMode: settings.keyboardCameraMode === false,
                  })
                }
                className={`px-4 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer shrink-0 ${
                  settings.keyboardCameraMode !== false
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-white/6 border border-white/10 text-slate-400'
                }`}
              >
                {settings.keyboardCameraMode !== false ? 'AKTIF' : 'MATI'}
              </button>
            </div>

            <div>
              <span className="font-extrabold text-slate-200 block mb-2 text-xs uppercase tracking-wider">
                KUALITAS GRAFIS
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'low', label: 'RENDAH' },
                    { id: 'medium', label: 'SEDANG' },
                    { id: 'high', label: 'TINGGI' },
                  ] as { id: GraphicsQuality; label: string }[]
                ).map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ ...settings, graphicsQuality: q.id })
                    }
                    className={`h-9 rounded-xl text-xs font-extrabold border cursor-pointer ${
                      settings.graphicsQuality === q.id
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sensitivitas */}
          <div className="bg-white/4 border border-white/10 p-4 rounded-2xl space-y-3">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-300">SENSITIVITAS MOUSE / GAMEPAD</span>
                <span className="text-cyan-400 tabular-nums">
                  {Math.round(settings.mouseSensitivity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.4"
                max="2.2"
                step="0.1"
                value={settings.mouseSensitivity}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    mouseSensitivity: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-300">SENSITIVITAS SENTUH / GYRO</span>
                <span className="text-cyan-400 tabular-nums">
                  {Math.round(settings.touchSensitivity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.4"
                max="2.2"
                step="0.1"
                value={settings.touchSensitivity}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    touchSensitivity: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

          {/* VR Meta Quest */}
          <div className="bg-white/4 border border-white/10 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">PUTARAN VR</span>
              <div className="flex gap-1.5">
                {(
                  [
                    { id: 'snap', label: 'SNAP' },
                    { id: 'smooth', label: 'HALUS' },
                  ] as { id: VRTurnMode; label: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, vrTurnMode: m.id })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                      settings.vrTurnMode === m.id
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                        : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">GERAK VR</span>
              <div className="flex gap-1.5">
                {(
                  [
                    { id: 'smooth', label: 'HALUS' },
                    { id: 'teleport', label: 'TELEPORT' },
                  ] as { id: VRMovementMode; label: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ ...settings, vrMovementMode: m.id })
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                      settings.vrMovementMode === m.id
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                        : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 mt-5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>SIMPAN</span>
        </button>
      </div>
    </div>
  );
};
