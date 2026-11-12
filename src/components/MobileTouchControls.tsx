import React, { useRef, useState, useEffect } from 'react';
import { MobileInput } from '../game/input/InputManager';
import { WeaponType } from '../game/types';
import { Crosshair, RotateCw, Zap, Sparkles, ArrowUp, Smartphone } from 'lucide-react';

interface MobileTouchControlsProps {
  mobileInput: MobileInput;
  currentWeapon: WeaponType;
  onSwitchWeapon: (w: WeaponType) => void;
  isReloading: boolean;
  dashCooldown: number;
  empCooldown: number;
  overdriveCooldown: number;
}

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  mobileInput,
  currentWeapon,
  onSwitchWeapon,
  isReloading,
  dashCooldown,
  empCooldown,
  overdriveCooldown,
}) => {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const activeJoystickTouchId = useRef<number | null>(null);
  const activeLookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPortrait, setIsPortrait] = useState<boolean>(false);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 768);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  const maxRadius = 46;

  const handleJoystickStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.changedTouches[0];
    if (!touch) return;
    activeJoystickTouchId.current = touch.identifier;
    updateJoystickFromTouch(touch.clientX, touch.clientY);
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeJoystickTouchId.current) {
        updateJoystickFromTouch(touch.clientX, touch.clientY);
      }
    }
  };

  const handleJoystickEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeJoystickTouchId.current) {
        activeJoystickTouchId.current = null;
        setKnobOffset({ x: 0, y: 0 });
        mobileInput.setJoystick(0, 0);
      }
    }
  };

  const updateJoystickFromTouch = (clientX: number, clientY: number) => {
    const el = joystickBaseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    setKnobOffset({ x: dx, y: dy });
    mobileInput.setJoystick(dx / maxRadius, dy / maxRadius);
  };

  const handleLookStart = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    if (!touch) return;
    activeLookTouchId.current = touch.identifier;
    lastLookPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeLookTouchId.current) {
        const dx = touch.clientX - lastLookPos.current.x;
        const dy = touch.clientY - lastLookPos.current.y;
        lastLookPos.current = { x: touch.clientX, y: touch.clientY };
        mobileInput.addLookDelta(dx, dy);
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeLookTouchId.current) {
        activeLookTouchId.current = null;
      }
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-20 select-none touch-none">
      {/* Petunjuk Orientasi Landscape bila layar Portrait */}
      {isPortrait && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-amber-950/95 border border-amber-500/60 text-amber-200 px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-mono shadow-lg pointer-events-auto z-40">
          <Smartphone className="w-4 h-4 rotate-90 text-amber-400 shrink-0" />
          <span>Putar perangkat ke posisi mendatar (Landscape) untuk pengalaman terbaik.</span>
        </div>
      )}

      {/* Area Sentuh Kanan untuk Mengarahkan Kamera (tidak mengganggu tombol) */}
      <div
        className="absolute top-16 right-0 bottom-0 w-3/5 pointer-events-auto"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
      />

      {/* KIRI BAWAH: Virtual Joystick untuk Bergerak */}
      <div
        ref={joystickBaseRef}
        data-ui="true"
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        onTouchCancel={handleJoystickEnd}
        className="absolute bottom-7 left-7 w-32 h-32 rounded-full bg-slate-900/65 border-2 border-cyan-500/40 flex items-center justify-center pointer-events-auto shadow-lg backdrop-blur-xs"
      >
        <div className="w-20 h-20 rounded-full border border-slate-700/60 flex items-center justify-center">
          <span className="text-[9px] font-mono text-slate-400 uppercase">Gerak</span>
        </div>
        <div
          className="absolute w-13 h-13 rounded-full bg-cyan-400/80 border-2 border-white shadow-[0_0_15px_#00f0ff]"
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* KANAN BAWAH: Gugus Tombol Aksi Ibu Jari */}
      <div
        data-ui="true"
        className="absolute bottom-6 right-6 flex flex-col items-end gap-3 pointer-events-auto"
      >
        {/* Baris Pilihan Cepat Senjata */}
        <div className="flex gap-1.5 bg-slate-950/85 p-1 rounded-xl border border-slate-700/80">
          {(['laser_rifle', 'cyber_shotgun', 'railgun', 'plasma_smg'] as WeaponType[]).map(
            (wId, idx) => (
              <button
                key={wId}
                type="button"
                onTouchStart={(e) => {
                  e.stopPropagation();
                  onSwitchWeapon(wId);
                }}
                onClick={() => onSwitchWeapon(wId)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold ${
                  currentWeapon === wId
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300'
                }`}
              >
                S{idx + 1}
              </button>
            )
          )}
        </div>

        {/* Tombol Kemampuan & Aksi Pendukung */}
        <div className="flex items-center gap-2.5">
          {/* Lompat */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              mobileInput.triggerJump();
            }}
            onClick={() => mobileInput.triggerJump()}
            className="w-13 h-13 rounded-2xl bg-slate-900/90 border border-slate-600 text-slate-200 flex flex-col items-center justify-center active:scale-95"
          >
            <ArrowUp className="w-4 h-4 text-cyan-400" />
            <span className="text-[9px] font-mono font-bold mt-0.5">Lompat</span>
          </button>

          {/* Dash */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              mobileInput.triggerDash();
            }}
            onClick={() => mobileInput.triggerDash()}
            className="w-13 h-13 rounded-2xl bg-slate-900/90 border border-cyan-500/50 text-cyan-300 flex flex-col items-center justify-center active:scale-95"
          >
            <Zap className="w-4 h-4" />
            <span className="text-[9px] font-mono font-bold mt-0.5">
              {dashCooldown > 0 ? `${dashCooldown.toFixed(0)}d` : 'Dash'}
            </span>
          </button>

          {/* EMP */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              mobileInput.triggerEmp();
            }}
            onClick={() => mobileInput.triggerEmp()}
            className="w-13 h-13 rounded-2xl bg-slate-900/90 border border-purple-500/50 text-purple-300 flex flex-col items-center justify-center active:scale-95"
          >
            <Zap className="w-4 h-4" />
            <span className="text-[9px] font-mono font-bold mt-0.5">
              {empCooldown > 0 ? `${empCooldown.toFixed(0)}d` : 'EMP'}
            </span>
          </button>

          {/* Overdrive */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              mobileInput.triggerOverdrive();
            }}
            onClick={() => mobileInput.triggerOverdrive()}
            className="w-13 h-13 rounded-2xl bg-slate-900/90 border border-amber-500/50 text-amber-300 flex flex-col items-center justify-center active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-[9px] font-mono font-bold mt-0.5">
              {overdriveCooldown > 0 ? `${overdriveCooldown.toFixed(0)}d` : 'Turbo'}
            </span>
          </button>
        </div>

        {/* Baris Utama: Isi Ulang & Tombol Tembak Besar */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              mobileInput.triggerReload();
            }}
            onClick={() => mobileInput.triggerReload()}
            className={`w-16 h-16 rounded-2xl border flex flex-col items-center justify-center active:scale-95 ${
              isReloading
                ? 'bg-amber-950/90 border-amber-400 text-amber-300'
                : 'bg-slate-900/90 border-slate-600 text-slate-200'
            }`}
          >
            <RotateCw className={`w-5 h-5 ${isReloading ? 'animate-spin' : ''}`} />
            <span className="text-[10px] font-mono font-bold mt-1">Isi Ulang</span>
          </button>

          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              mobileInput.setShooting(true);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              mobileInput.setShooting(false);
            }}
            onTouchCancel={(e) => {
              e.stopPropagation();
              mobileInput.setShooting(false);
            }}
            onMouseDown={() => mobileInput.setShooting(true)}
            onMouseUp={() => mobileInput.setShooting(false)}
            className="w-24 h-24 rounded-full bg-rose-600/90 active:bg-rose-500 border-4 border-rose-300 text-white flex flex-col items-center justify-center shadow-[0_0_25px_rgba(244,63,94,0.6)] active:scale-95"
          >
            <Crosshair className="w-8 h-8" />
            <span className="text-xs font-mono font-bold mt-1">TEMBAK</span>
          </button>
        </div>
      </div>
    </div>
  );
};

