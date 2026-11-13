import React, { useState } from 'react';
import { GameSettings, GraphicsQuality, VRMovementMode, VRTurnMode } from '../game/types';
import { MobileInput } from '../game/input/InputManager';
import {
  X,
  Volume2,
  VolumeX,
  Check,
  Sliders,
  Gamepad2,
  Monitor,
  Smartphone,
  Glasses,
} from 'lucide-react';
import {
  ControlDeviceTab,
  GamepadVisual,
  KeyboardMouseVisual,
  MobileTouchVisual,
  VRVisual,
} from './ControlVisuals';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (updated: GameSettings) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onClose: () => void;
  isGamepadConnected?: boolean;
}

type MainSettingsTab = 'general' | 'controls';

const DEVICE_TABS: {
  id: ControlDeviceTab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'kbm', label: 'Keyboard + Mouse', Icon: Monitor },
  { id: 'gamepad', label: 'Gamepad', Icon: Gamepad2 },
  { id: 'mobile', label: 'Mobile', Icon: Smartphone },
  { id: 'vr', label: 'VR', Icon: Glasses },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  isMuted,
  onToggleMute,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<MainSettingsTab>('general');
  const [controlTab, setControlTab] = useState<ControlDeviceTab>('kbm');

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

  const fullKeyboardActive = settings.keyboardCameraMode !== false;

  return (
    <div className="fixed inset-0 bg-[#050811]/92 flex items-center justify-center p-3 sm:p-4 z-50 font-sans text-white ui-backdrop-enter">
      <div
        data-ui-board="true"
        className="max-w-lg sm:max-w-3xl w-full max-h-[92vh] overflow-y-auto bg-[#090d18] border border-white/15 rounded-3xl p-4 sm:p-6 shadow-2xl ui-panel-enter"
      >
        {/* Header + Tab Utama */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg sm:text-2xl font-black tracking-tight uppercase">
              PENGATURAN
            </h2>

            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wide flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'general'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Umum</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('controls')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wide flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'controls'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>Kontrol</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Pengaturan"
            className="p-2 rounded-xl bg-white/6 hover:bg-white/12 text-slate-300 hover:text-white cursor-pointer flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeTab === 'general' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {/* Audio & Feedback */}
            <div className="bg-white/4 border border-white/10 p-4 rounded-2xl space-y-3">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-400 block">
                AUDIO &amp; UMPAN BALIK
              </span>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 block">
                    SUARA GAME
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Efek laser, eliminasi, &amp; musik latar
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`px-4 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${
                    isMuted
                      ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                      : 'bg-cyan-400 text-slate-950'
                  }`}
                >
                  {isMuted ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isMuted ? 'MATI' : 'AKTIF'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/8">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 block">
                    GETARAN (HAPTIC)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Getaran tembakan pada gamepad &amp; HP
                  </span>
                </div>
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
            </div>

            {/* Grafis & Performa */}
            <div className="bg-white/4 border border-white/10 p-4 rounded-2xl space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-400 block mb-2.5">
                  TAMPILAN &amp; PERFORMA
                </span>
                <span className="font-extrabold text-slate-200 block mb-2 text-xs uppercase tracking-wider">
                  KUALITAS GRAFIS 3D
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
                      className={`h-10 rounded-xl text-xs font-extrabold border cursor-pointer transition-colors ${
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

              <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-white/8">
                Perangkat dideteksi otomatis saat bermain. Buka tab{' '}
                <span className="text-cyan-300 font-bold">Kontrol</span> untuk melihat skema
                tombol &amp; mengatur sensitivitas per perangkat.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Selector 4 Perangkat Kontrol */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-white/4 border border-white/10 p-1.5 rounded-2xl">
              {DEVICE_TABS.map(({ id, label, Icon }) => {
                const isSelected = controlTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setControlTab(id)}
                    className={`h-9 px-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:bg-white/6 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Area Skema Visual (Kiri) + Pengaturan Perangkat (Kanan) */}
            <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_0.95fr] gap-3 items-stretch">
              {controlTab === 'kbm' && (
                <>
                  <KeyboardMouseVisual fullKeyboard={fullKeyboardActive} />
                  <div className="bg-white/4 border border-white/10 p-4 rounded-2xl space-y-3.5 flex flex-col justify-between">
                    <div className="space-y-3.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-400 block">
                        PENGATURAN KEYBOARD &amp; MOUSE
                      </span>

                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1.5">
                          <span className="text-slate-200">SENSITIVITAS KAMERA</span>
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

                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/8">
                        <div>
                          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 block">
                            FULL KEYBOARD
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Kamera pakai Panah · Tembak pakai Enter
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings({
                              ...settings,
                              keyboardCameraMode: !fullKeyboardActive,
                            })
                          }
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer shrink-0 ${
                            fullKeyboardActive
                              ? 'bg-cyan-400 text-slate-950'
                              : 'bg-white/6 border border-white/10 text-slate-400'
                          }`}
                        >
                          {fullKeyboardActive ? 'AKTIF' : 'MATI'}
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-white/8">
                      Klik di area arena saat bermain untuk mengunci kursor mouse secara presisi.
                    </p>
                  </div>
                </>
              )}

              {controlTab === 'gamepad' && (
                <>
                  <GamepadVisual />
                  <div className="bg-white/4 border border-white/10 p-4 rounded-2xl space-y-3.5 flex flex-col justify-between">
                    <div className="space-y-3.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-400 block">
                        PENGATURAN GAMEPAD
                      </span>

                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1.5">
                          <span className="text-slate-200">SENSITIVITAS STICK KANAN</span>
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

                      <div className="flex items-center justify-between pt-2 border-t border-white/8">
                        <div>
                          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 block">
                            GETARAN CONTROLLER
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Rumble saat menembak &amp; kena hit
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings({
                              ...settings,
                              hapticsEnabled: !settings.hapticsEnabled,
                            })
                          }
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                            settings.hapticsEnabled
                              ? 'bg-cyan-400 text-slate-950'
                              : 'bg-white/6 border border-white/10 text-slate-400'
                          }`}
                        >
                          {settings.hapticsEnabled ? 'AKTIF' : 'MATI'}
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-white/8">
                      Tekan tombol apa saja pada controller untuk mengaktifkan mode gamepad secara
                      otomatis.
                    </p>
                  </div>
                </>
              )}

              {controlTab === 'mobile' && (
                <>
                  <MobileTouchVisual gyroEnabled={settings.mobileGyroEnabled} />
                  <div className="bg-white/4 border border-white/10 p-4 rounded-2xl space-y-3.5 flex flex-col justify-between">
                    <div className="space-y-3.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-400 block">
                        PENGATURAN MOBILE
                      </span>

                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1.5">
                          <span className="text-slate-200">SENSITIVITAS SENTUH / GYRO</span>
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

                      <div className="flex items-center justify-between pt-2 border-t border-white/8">
                        <div>
                          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 block">
                            GYROSCOPE HP
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Arahkan bidikan dengan memiringkan HP
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleToggleGyro}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                            settings.mobileGyroEnabled
                              ? 'bg-cyan-400 text-slate-950'
                              : 'bg-white/6 border border-white/10 text-slate-400'
                          }`}
                        >
                          {settings.mobileGyroEnabled ? 'AKTIF' : 'MATI'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/8">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                          GETARAN SENTUH
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings({
                              ...settings,
                              hapticsEnabled: !settings.hapticsEnabled,
                            })
                          }
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                            settings.hapticsEnabled
                              ? 'bg-cyan-400 text-slate-950'
                              : 'bg-white/6 border border-white/10 text-slate-400'
                          }`}
                        >
                          {settings.hapticsEnabled ? 'AKTIF' : 'MATI'}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {controlTab === 'vr' && (
                <>
                  <VRVisual
                    turnMode={settings.vrTurnMode}
                    movementMode={settings.vrMovementMode}
                  />
                  <div className="bg-white/4 border border-white/10 p-4 rounded-2xl space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-400 block">
                        PENGATURAN VR (META QUEST)
                      </span>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">PUTARAN VR</span>
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
                              onClick={() =>
                                onUpdateSettings({ ...settings, vrTurnMode: m.id })
                              }
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

                      <div className="flex items-center justify-between pt-2 border-t border-white/8">
                        <span className="text-xs font-bold text-slate-200">GERAK VR</span>
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

                      <div className="flex items-center justify-between pt-2 border-t border-white/8">
                        <div>
                          <span className="text-xs font-bold text-slate-200 block">
                            VIGNETTE KENYAMANAN
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Kurangi motion sickness saat bergerak
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings({
                              ...settings,
                              vrComfortVignette: !settings.vrComfortVignette,
                            })
                          }
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                            settings.vrComfortVignette
                              ? 'bg-cyan-400 text-slate-950'
                              : 'bg-white/6 border border-white/10 text-slate-400'
                          }`}
                        >
                          {settings.vrComfortVignette ? 'AKTIF' : 'MATI'}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 mt-4 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>SIMPAN</span>
        </button>
      </div>
    </div>
  );
};
