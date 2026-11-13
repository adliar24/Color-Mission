import React, { useRef, useState } from 'react';
import { MobileInput } from '../game/input/InputManager';
import { WeaponType } from '../game/types';
import { Crosshair, ArrowUp, Zap, Flame, Target } from 'lucide-react';

interface MobileTouchControlsProps {
  mobileInput: MobileInput;
  currentWeapon: WeaponType;
  unlockedWeapons: WeaponType[];
  onSwitchWeapon: (w: WeaponType) => void;
}

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  mobileInput,
  currentWeapon,
  unlockedWeapons,
  onSwitchWeapon,
}) => {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const activeJoystickTouchId = useRef<number | null>(null);
  const activeLookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const maxRadius = 52;

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
      {/* Area Sentuh Kanan untuk Mengarahkan Kamera (tidak mengganggu tombol) */}
      <div
        className="absolute top-16 right-0 bottom-0 w-3/5 pointer-events-auto"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
      />

      {/* KIRI BAWAH: Virtual Joystick Transparan Tanpa Teks */}
      <div
        ref={joystickBaseRef}
        data-ui="true"
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        onTouchCancel={handleJoystickEnd}
        className="absolute bottom-14 left-6 sm:left-12 w-32 h-32 rounded-full bg-slate-900/30 border-2 border-cyan-400/35 flex items-center justify-center pointer-events-auto"
      >
        <div className="w-18 h-18 rounded-full border border-white/15" />
        <div
          className="absolute w-13 h-13 rounded-full bg-cyan-400/55 border-2 border-white/75"
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* KANAN BAWAH: Tombol Aksi Transparan (Hanya Ikon) */}
      <div
        data-ui="true"
        className="absolute bottom-14 right-6 sm:right-12 flex flex-col items-end gap-2.5 pointer-events-auto"
      >
        {unlockedWeapons.length > 1 && (
          <div className="flex gap-1.5 bg-slate-950/35 p-1 rounded-xl border border-white/15">
            {unlockedWeapons.map((wId) => {
              const Icon =
                wId === 'laser_rifle' ? Zap : wId === 'cyber_shotgun' ? Flame : Target;
              return (
                <button
                  key={wId}
                  type="button"
                  aria-label={wId}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    onSwitchWeapon(wId);
                  }}
                  onClick={() => onSwitchWeapon(wId)}
                  className={`w-9 h-7 rounded-lg flex items-center justify-center ${
                    currentWeapon === wId
                      ? 'bg-cyan-400/75 text-slate-950'
                      : 'bg-white/10 text-white/70'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-end gap-3.5">
          {/* Lompat (Ikon saja, transparan) */}
          <button
            type="button"
            aria-label="Lompat"
            onTouchStart={(e) => {
              e.stopPropagation();
              mobileInput.triggerJump();
            }}
            onClick={() => mobileInput.triggerJump()}
            className="w-13 h-13 rounded-full bg-slate-900/35 border-2 border-cyan-400/40 text-cyan-300 flex items-center justify-center active:scale-95"
          >
            <ArrowUp className="w-6 h-6" />
          </button>

          {/* Tembak (Ikon saja, transparan) */}
          <button
            type="button"
            aria-label="Tembak"
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
            className="w-18 h-18 rounded-full bg-rose-500/35 active:bg-rose-500/60 border-2 border-rose-300/65 text-white flex items-center justify-center active:scale-95"
          >
            <Crosshair className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
};

