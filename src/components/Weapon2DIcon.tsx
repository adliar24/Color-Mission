import React, { useId } from 'react';
import { WeaponType } from '../game/types';

interface Weapon2DIconProps {
  weaponId: WeaponType;
  className?: string;
}

export const Weapon2DIcon: React.FC<Weapon2DIconProps> = ({
  weaponId,
  className = 'w-full h-full',
}) => {
  const uid = useId().replace(/:/g, '');

  if (weaponId === 'cyber_shotgun') {
    const barrelBackId = `sgBarrelBack_${uid}`;
    const barrelFrontId = `sgBarrelFront_${uid}`;
    const bodyId = `sgBody_${uid}`;

    return (
      <svg
        viewBox="0 0 360 180"
        className={className}
        aria-label="Visual 2D Glitch Scattergun"
      >
        <defs>
          <linearGradient id={barrelBackId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="50%" stopColor="#e11d48" />
            <stop offset="100%" stopColor="#9f1239" />
          </linearGradient>
          <linearGradient id={barrelFrontId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fda4af" />
            <stop offset="45%" stopColor="#ff1e68" />
            <stop offset="100%" stopColor="#be123c" />
          </linearGradient>
          <linearGradient id={bodyId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a1a3a" />
            <stop offset="100%" stopColor="#180e24" />
          </linearGradient>
        </defs>

        {/* Popor Belakang (Stock Pad + Stock Arm) */}
        <rect
          x="28"
          y="64"
          width="16"
          height="48"
          rx="2.5"
          fill="#120a1c"
          stroke="#4a3560"
          strokeWidth="2"
        />
        <rect
          x="42"
          y="75"
          width="46"
          height="22"
          rx="2"
          fill="#1a1027"
          stroke="#4a3560"
          strokeWidth="2"
        />

        {/* Pistol Grip (Gagang Belakang Miring) */}
        <polygon
          points="116,104 143,104 131,153 103,150"
          fill="#120a1c"
          stroke="#4a3560"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Trigger Guard */}
        <rect
          x="137"
          y="108"
          width="32"
          height="7"
          rx="2"
          fill="#180e24"
          stroke="#4a3560"
          strokeWidth="1.8"
        />

        {/* Magazine Depan Miring + Pita Rose Pink Menonjol */}
        <polygon
          points="162,104 188,104 197,147 170,152"
          fill="#160d22"
          stroke="#4a3560"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <polygon
          points="166,133 196,127 199,137 168,143"
          fill="#ff1e68"
          stroke="#fda4af"
          strokeWidth="1.2"
        />

        {/* Underbarrel Pump (Kotak Hitam-Ungu di Bawah Laras Kembar) */}
        <rect
          x="228"
          y="84"
          width="54"
          height="20"
          rx="2.5"
          fill="#140b1e"
          stroke="#4a3560"
          strokeWidth="2"
        />

        {/* Laras Kembar Rose-Pink (2 Silinder Sejajar sesuai 3D) */}
        <rect
          x="228"
          y="60"
          width="92"
          height="16"
          rx="4"
          fill={`url(#${barrelBackId})`}
          stroke="#fda4af"
          strokeWidth="1.2"
        />
        <ellipse cx="318" cy="68" rx="3" ry="7.5" fill="#fecdd3" />

        <rect
          x="228"
          y="70"
          width="98"
          height="17"
          rx="4"
          fill={`url(#${barrelFrontId})`}
          stroke="#fecdd3"
          strokeWidth="1.5"
        />
        <ellipse cx="324" cy="78.5" rx="3.2" ry="8" fill="#ffe4e6" />

        {/* Badan Utama (Chunky Receiver Box Solid) */}
        <rect
          x="84"
          y="56"
          width="148"
          height="50"
          rx="3.5"
          fill={`url(#${bodyId})`}
          stroke="#5b4375"
          strokeWidth="2.2"
        />
        <line x1="88" y1="62" x2="228" y2="62" stroke="#4a3560" strokeWidth="2" />
      </svg>
    );
  }

  if (weaponId === 'railgun') {
    const railId = `rgRail_${uid}`;
    const bodyId = `rgBody_${uid}`;

    return (
      <svg
        viewBox="0 0 360 180"
        className={className}
        aria-label="Visual 2D Apex Railgun"
      >
        <defs>
          <linearGradient id={railId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="50%" stopColor="#bf00ff" />
            <stop offset="100%" stopColor="#e879f9" />
          </linearGradient>
          <linearGradient id={bodyId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#17223b" />
            <stop offset="100%" stopColor="#0b1120" />
          </linearGradient>
        </defs>

        {/* Popor Belakang Pendek (Stock Pad + Stock Arm) */}
        <rect
          x="22"
          y="64"
          width="16"
          height="48"
          rx="2.5"
          fill="#080d1a"
          stroke="#334155"
          strokeWidth="2"
        />
        <rect
          x="36"
          y="76"
          width="32"
          height="22"
          rx="2"
          fill="#0f172a"
          stroke="#334155"
          strokeWidth="2"
        />

        {/* Pistol Grip (Gagang Belakang Miring) */}
        <polygon
          points="106,106 133,106 121,154 93,151"
          fill="#080d1a"
          stroke="#334155"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Trigger Guard */}
        <rect
          x="127"
          y="110"
          width="32"
          height="7"
          rx="2"
          fill="#0f172a"
          stroke="#334155"
          strokeWidth="1.8"
        />

        {/* Magazine Depan Miring + Pita Ungu Menonjol */}
        <polygon
          points="152,106 178,106 187,148 160,153"
          fill="#0b1120"
          stroke="#334155"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <polygon
          points="156,134 186,128 189,138 158,144"
          fill="#bf00ff"
          stroke="#f0abfc"
          strokeWidth="1.2"
        />

        {/* Badan Utama Besar (Heavy Receiver Box) */}
        <rect
          x="66"
          y="54"
          width="164"
          height="54"
          rx="3.5"
          fill={`url(#${bodyId})`}
          stroke="#475569"
          strokeWidth="2.2"
        />
        <line x1="70" y1="60" x2="226" y2="60" stroke="#334155" strokeWidth="2" />

        {/* Rel Akselerator Atas & Bawah Sejajar dengan Celah Kosong di Tengah sesuai 3D */}
        <rect
          x="208"
          y="48"
          width="130"
          height="12"
          rx="2"
          fill={`url(#${railId})`}
          stroke="#f0abfc"
          strokeWidth="1.5"
        />
        <rect
          x="208"
          y="98"
          width="130"
          height="12"
          rx="2"
          fill={`url(#${railId})`}
          stroke="#f0abfc"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  // Default: Pulse Laser Rifle ('laser_rifle')
  const barrelId = `lrBarrel_${uid}`;
  const bodyId = `lrBody_${uid}`;

  return (
    <svg
      viewBox="0 0 360 180"
      className={className}
      aria-label="Visual 2D Pulse Laser Rifle"
    >
      <defs>
        <linearGradient id={barrelId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="45%" stopColor="#00f0ff" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id={bodyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      {/* Popor Belakang (Stock Pad + Stock Arm) */}
      <rect
        x="28"
        y="64"
        width="16"
        height="48"
        rx="2.5"
        fill="#0b1120"
        stroke="#334155"
        strokeWidth="2"
      />
      <rect
        x="42"
        y="75"
        width="46"
        height="22"
        rx="2"
        fill="#111827"
        stroke="#334155"
        strokeWidth="2"
      />

      {/* Pistol Grip (Gagang Belakang Miring) */}
      <polygon
        points="116,102 142,102 130,152 103,149"
        fill="#0b1120"
        stroke="#334155"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Trigger Guard */}
      <rect
        x="136"
        y="106"
        width="32"
        height="7"
        rx="2"
        fill="#111827"
        stroke="#334155"
        strokeWidth="1.8"
      />

      {/* Magazine Depan Miring + Pita Cyan Menonjol */}
      <polygon
        points="160,102 186,102 195,146 168,151"
        fill="#0f172a"
        stroke="#334155"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <polygon
        points="164,132 194,126 197,136 166,142"
        fill="#00f0ff"
        stroke="#67e8f9"
        strokeWidth="1.2"
      />

      {/* Badan Utama (Receiver Box) */}
      <rect
        x="84"
        y="60"
        width="144"
        height="44"
        rx="3"
        fill={`url(#${bodyId})`}
        stroke="#475569"
        strokeWidth="2.2"
      />
      <line x1="87" y1="65" x2="225" y2="65" stroke="#334155" strokeWidth="2" />

      {/* Front Shroud (Kotak Bertingkat di Depan Receiver) */}
      <rect
        x="226"
        y="67"
        width="44"
        height="30"
        rx="2.5"
        fill="#111827"
        stroke="#475569"
        strokeWidth="2"
      />

      {/* Laras Silinder Cyan */}
      <rect
        x="268"
        y="73"
        width="68"
        height="18"
        rx="4"
        fill={`url(#${barrelId})`}
        stroke="#a5f3fc"
        strokeWidth="1.5"
      />
      <ellipse cx="334" cy="82" rx="3" ry="9" fill="#cffafe" />

      {/* Wireframe Optic Box Cyan di Atas Receiver sesuai 3D */}
      <g stroke="#00f0ff" strokeWidth="2" fill="none" strokeLinejoin="round">
        <rect
          x="148"
          y="36"
          width="46"
          height="22"
          rx="1"
          fill="rgba(0, 240, 255, 0.05)"
        />
        <line x1="148" y1="36" x2="194" y2="58" strokeWidth="1.6" opacity="0.9" />
        <line x1="194" y1="36" x2="148" y2="58" strokeWidth="1.6" opacity="0.9" />
        <line x1="148" y1="47" x2="194" y2="47" strokeWidth="1.3" opacity="0.65" />
      </g>
    </svg>
  );
};
