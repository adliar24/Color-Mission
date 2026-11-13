import React from 'react';

export type XboxButtonType = 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'LT' | 'RT' | 'START' | 'BACK';

interface GamepadBadgeProps {
  button: XboxButtonType;
  visible?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const BUTTON_STYLES: Record<XboxButtonType, string> = {
  A: 'bg-[#22c55e] text-slate-950 border-white/40 rounded-full',
  B: 'bg-[#ef4444] text-white border-white/40 rounded-full',
  X: 'bg-[#3b82f6] text-white border-white/40 rounded-full',
  Y: 'bg-[#eab308] text-slate-950 border-white/40 rounded-full',
  LB: 'bg-slate-800 text-slate-100 border-white/30 rounded-md',
  RB: 'bg-slate-800 text-slate-100 border-white/30 rounded-md',
  LT: 'bg-slate-800 text-slate-100 border-white/30 rounded-md',
  RT: 'bg-slate-800 text-slate-100 border-white/30 rounded-md',
  START: 'bg-slate-800 text-slate-100 border-white/30 rounded-md',
  BACK: 'bg-slate-800 text-slate-100 border-white/30 rounded-md',
};

export const GamepadBadge: React.FC<GamepadBadgeProps> = ({
  button,
  visible = true,
  size = 'md',
  className = '',
}) => {
  if (!visible) return null;

  const isFace = button === 'A' || button === 'B' || button === 'X' || button === 'Y';
  const sizeClass =
    size === 'sm'
      ? isFace
        ? 'w-5 h-5 text-[10px]'
        : 'px-1.5 h-4 text-[9px]'
      : isFace
      ? 'w-6 h-6 text-xs'
      : 'px-2 h-5 text-[10px]';

  const label = button === 'START' ? 'MENU' : button;

  return (
    <span
      className={`inline-flex items-center justify-center font-black leading-none border shadow-sm shrink-0 ${BUTTON_STYLES[button]} ${sizeClass} ${className}`}
      title={`Tombol Gamepad ${label}`}
    >
      {label}
    </span>
  );
};

