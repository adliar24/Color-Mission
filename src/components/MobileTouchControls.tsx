import React, { useEffect, useRef, useState } from 'react';
import { MobileInput } from '../game/input/InputManager';
import {
  CharacterId,
  GameSettings,
  WeaponType,
  resolveMobileHudLayout,
} from '../game/types';
import { Crosshair, ArrowUp, Zap, Flame, Target, Shield, Heart } from 'lucide-react';

interface MobileTouchControlsProps {
  mobileInput: MobileInput;
  currentWeapon: WeaponType;
  unlockedWeapons: WeaponType[];
  onSwitchWeapon: (w: WeaponType) => void;
  characterId?: CharacterId;
  abilityCooldownLeft?: number;
  abilityActiveLeft?: number;
  onTriggerAbility?: () => void;
  settings?: GameSettings;
  mobileOrientation?: 'landscape' | 'portrait';
}

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  mobileInput,
  currentWeapon,
  unlockedWeapons,
  onSwitchWeapon,
  characterId = 'raka',
  abilityCooldownLeft = 0,
  abilityActiveLeft = 0,
  onTriggerAbility,
  settings,
  mobileOrientation = 'landscape',
}) => {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const activeJoystickTouchId = useRef<number | null>(null);
  const activeLookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const layout = resolveMobileHudLayout(settings, mobileOrientation);
  const joystickScale = layout.joystick.scalePercent / 100;
  const maxRadius = 52 * joystickScale;

  // Pastikan setiap kali kontrol sentuh muncul atau ditutup (misal saat selesai stage / pause), gerakan direset ke 0
  useEffect(() => {
    mobileInput.reset();
    setKnobOffset({ x: 0, y: 0 });
    activeJoystickTouchId.current = null;
    activeLookTouchId.current = null;

    const handleWindowBlur = () => {
      activeJoystickTouchId.current = null;
      activeLookTouchId.current = null;
      setKnobOffset({ x: 0, y: 0 });
      mobileInput.reset();
    };

    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      mobileInput.reset();
    };
  }, [mobileInput]);

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
    const localScale = Math.max(0.5, joystickScale);
    setKnobOffset({ x: dx / localScale, y: dy / localScale });
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
      {/* Area Sentuh Layar untuk Mengarahkan Kamera (tidak mengganggu tombol yang punya stopPropagation) */}
      <div
        className="absolute top-16 left-0 right-0 bottom-0 pointer-events-auto"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
      />

      {/* 1. GERAK (VIRTUAL JOYSTICK) */}
      <div
        ref={joystickBaseRef}
        data-ui="true"
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        onTouchCancel={handleJoystickEnd}
        style={{
          left: `${layout.joystick.xPercent}%`,
          top: `${layout.joystick.yPercent}%`,
          transform: `translate(-50%, -50%) scale(${layout.joystick.scalePercent / 100})`,
          opacity: layout.joystick.opacityPercent / 100,
        }}
        className="absolute w-28 h-28 rounded-full bg-slate-900/35 border-2 border-cyan-400/40 flex items-center justify-center pointer-events-auto"
      >
        <div className="w-16 h-16 rounded-full border border-white/15" />
        <div
          className="absolute w-12 h-12 rounded-full bg-cyan-400/60 border-2 border-white/80"
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* 2. GANTI SENJATA */}
      {unlockedWeapons.length > 1 && (
        <div
          data-ui="true"
          style={{
            left: `${layout.weaponSwitch.xPercent}%`,
            top: `${layout.weaponSwitch.yPercent}%`,
            transform: `translate(-50%, -50%) scale(${layout.weaponSwitch.scalePercent / 100})`,
            opacity: layout.weaponSwitch.opacityPercent / 100,
          }}
          className="absolute flex gap-2 bg-slate-950/50 p-1.5 rounded-xl border border-white/15 pointer-events-auto"
        >
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
                    ? 'bg-cyan-400/85 text-slate-950'
                    : 'bg-white/10 text-white/75'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      )}

      {/* 3. JURUS / ABILITY KARAKTER (PERISAI SUPER RAKA / RECOVERY NAYA) */}
      <button
        type="button"
        data-ui="true"
        aria-label="Ability Karakter"
        disabled={abilityCooldownLeft > 0}
        onTouchStart={(e) => {
          e.stopPropagation();
          if (abilityCooldownLeft <= 0) {
            mobileInput.triggerAbility();
            onTriggerAbility?.();
          }
        }}
        onClick={() => {
          if (abilityCooldownLeft <= 0) {
            mobileInput.triggerAbility();
            onTriggerAbility?.();
          }
        }}
        style={{
          left: `${layout.ability.xPercent}%`,
          top: `${layout.ability.yPercent}%`,
          transform: `translate(-50%, -50%) scale(${layout.ability.scalePercent / 100})`,
          opacity: layout.ability.opacityPercent / 100,
        }}
        className={`absolute w-13 h-13 rounded-full border-2 flex flex-col items-center justify-center pointer-events-auto active:brightness-125 ${
          abilityActiveLeft > 0
            ? 'bg-cyan-400/80 border-white text-slate-950 animate-pulse'
            : abilityCooldownLeft > 0
              ? 'bg-slate-950/65 border-white/20 text-slate-400'
              : characterId === 'raka'
                ? 'bg-cyan-500/40 border-cyan-300/80 text-cyan-200'
                : 'bg-emerald-500/40 border-emerald-300/80 text-emerald-200'
        }`}
      >
        {characterId === 'raka' ? (
          <Shield className="w-5 h-5" />
        ) : (
          <Heart className="w-5 h-5" />
        )}
        <span className="text-[9px] font-black tabular-nums leading-none mt-0.5">
          {abilityActiveLeft > 0
            ? `${Math.ceil(abilityActiveLeft)}s`
            : abilityCooldownLeft > 0
              ? `${Math.ceil(abilityCooldownLeft)}s`
              : 'SKILL'}
        </span>
      </button>

      {/* 4. LOMPAT */}
      <button
        type="button"
        data-ui="true"
        aria-label="Lompat"
        onTouchStart={(e) => {
          e.stopPropagation();
          mobileInput.triggerJump();
        }}
        onClick={() => mobileInput.triggerJump()}
        style={{
          left: `${layout.jump.xPercent}%`,
          top: `${layout.jump.yPercent}%`,
          transform: `translate(-50%, -50%) scale(${layout.jump.scalePercent / 100})`,
          opacity: layout.jump.opacityPercent / 100,
        }}
        className="absolute w-13 h-13 rounded-full bg-slate-900/45 border-2 border-cyan-400/50 text-cyan-300 flex items-center justify-center pointer-events-auto active:brightness-125"
      >
        <ArrowUp className="w-6 h-6" />
      </button>

      {/* 5. TEMBAK */}
      <button
        type="button"
        data-ui="true"
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
        style={{
          left: `${layout.shoot.xPercent}%`,
          top: `${layout.shoot.yPercent}%`,
          transform: `translate(-50%, -50%) scale(${layout.shoot.scalePercent / 100})`,
          opacity: layout.shoot.opacityPercent / 100,
        }}
        className="absolute w-18 h-18 rounded-full bg-rose-500/45 active:bg-rose-500/70 border-2 border-rose-300/75 text-white flex items-center justify-center pointer-events-auto"
      >
        <Crosshair className="w-7 h-7" />
      </button>
    </div>
  );
};
