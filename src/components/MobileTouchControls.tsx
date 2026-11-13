import React, { useRef, useState, useEffect } from 'react';
import { MobileInput } from '../game/input/InputManager';
import { WeaponType } from '../game/types';
import { Crosshair, ArrowUp, Smartphone, Zap, Flame, Target } from 'lucide-react';

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

      {/* KIRI BAWAH: Virtual Joystick Transparan Tanpa Teks */}
      <div
        ref={joystickBaseRef}
        data-ui="true"
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        onTouchCancel={handleJoystickEnd}
        className="absolute bottom-6 left-6 w-28 h-28 rounded-full bg-slate-900/30 border-2 border-cyan-400/35 flex items-center justify-center pointer-events-auto"
      >
        <div className="w-16 h-16 rounded-full border border-white/15" />
        <div
          className="absolute w-12 h-12 rounded-full bg-cyan-400/55 border-2 border-white/75"
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* KANAN BAWAH: Tombol Aksi Transparan (Hanya Ikon) */}
      <div
        data-ui="true"
        className="absolute bottom-6 right-6 flex flex-col items-end gap-3 pointer-events-auto"
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
                  className={`w-10 h-9 rounded-lg flex items-center justify-center ${
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

        <div className="flex items-end gap-3">
          {/* Lompat (Ikon saja, transparan) */}
          <button
            type="button"
            aria-label="Lompat"
            onTouchStart={(e) => {
              e.stopPropagation();
              mobileInput.triggerJump();
            }}
            onClick={() => mobileInput.triggerJump()}
            className="w-14 h-14 rounded-full bg-slate-900/35 border-2 border-cyan-400/40 text-cyan-300 flex items-center justify-center active:scale-95"
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
            className="w-20 h-20 rounded-full bg-rose-500/35 active:bg-rose-500/60 border-2 border-rose-300/65 text-white flex items-center justify-center active:scale-95"
          >
            <Crosshair className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  );
};

