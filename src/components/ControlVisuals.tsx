import React from 'react';
import { VRMovementMode, VRTurnMode } from '../game/types';

export type ControlDeviceTab = 'kbm' | 'gamepad' | 'mobile' | 'vr';

const KeyCap: React.FC<{
  label: string;
  sub?: string;
  active?: boolean;
  wide?: boolean;
}> = ({ label, sub, active = false, wide = false }) => (
  <div
    className={`h-8 ${wide ? 'px-3 min-w-[64px]' : 'w-8'} rounded-lg border flex flex-col items-center justify-center leading-none select-none transition-colors ${
      active
        ? 'bg-cyan-400/20 border-cyan-400/70 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.18)]'
        : 'bg-slate-900/90 border-white/15 text-slate-300'
    }`}
  >
    <span className="text-[10px] font-black tracking-tight">{label}</span>
    {sub && <span className="text-[8px] font-bold text-slate-400 mt-0.5">{sub}</span>}
  </div>
);

export const KeyboardMouseVisual: React.FC<{ fullKeyboard: boolean }> = ({ fullKeyboard }) => {
  return (
    <div className="bg-[#060a14] border border-white/10 rounded-2xl p-3.5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400">
          SKEMA KEYBOARD &amp; MOUSE
        </span>
        <span className="text-[10px] font-bold text-slate-400">
          {fullKeyboard ? 'Mode Full Keyboard Aktif' : 'Mode Standar FPS'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1.35fr_0.9fr] gap-3 items-center">
        {/* Blok Keyboard */}
        <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3 flex flex-col gap-2.5">
          {/* Baris Angka & Fungsi */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1">
              <KeyCap label="ESC" />
              <KeyCap label="1" active />
              <KeyCap label="2" active />
              <KeyCap label="3" active />
            </div>
            <div className="flex items-center gap-1">
              <KeyCap label="H" />
              <KeyCap label="P" />
            </div>
          </div>

          {/* Kluster WASD + Space + Arrow/Enter */}
          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-col items-center gap-1">
              <KeyCap label="W" active />
              <div className="flex gap-1">
                <KeyCap label="A" active />
                <KeyCap label="S" active />
                <KeyCap label="D" active />
              </div>
              <KeyCap label="SPACE" wide active />
            </div>

            <div className="flex flex-col items-end gap-1">
              <KeyCap label="ENTER" wide active={fullKeyboard} />
              <div className="flex flex-col items-center gap-1 mt-0.5">
                <KeyCap label="↑" active={fullKeyboard} />
                <div className="flex gap-1">
                  <KeyCap label="←" active={fullKeyboard} />
                  <KeyCap label="↓" active={fullKeyboard} />
                  <KeyCap label="→" active={fullKeyboard} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Blok Mouse SVG */}
        <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3 flex flex-col items-center justify-center gap-2">
          <svg viewBox="0 0 90 112" className="w-16 h-20" aria-label="Skema Mouse">
            <rect
              x="16"
              y="8"
              width="58"
              height="96"
              rx="28"
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="2.2"
            />
            {/* Tombol Kiri (Tembak) */}
            <path
              d="M17 36 C17 19 28 9 44 9 L44 46 L17 46 Z"
              fill={fullKeyboard ? '#1e293b' : 'rgba(34,211,238,0.28)'}
              stroke={fullKeyboard ? '#475569' : '#22d3ee'}
              strokeWidth="1.6"
            />
            {/* Tombol Kanan */}
            <path
              d="M46 9 C62 9 73 19 73 36 L73 46 L46 46 Z"
              fill="#1e293b"
              stroke="#475569"
              strokeWidth="1.4"
            />
            {/* Scroll wheel */}
            <rect x="42" y="20" width="6" height="16" rx="3" fill="#94a3b8" />
            {/* Garis sensor gerak */}
            <path d="M45 68 L45 84 M37 76 L53 76" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
          </svg>
          <div className="text-center leading-tight">
            <div className="text-[10px] font-black text-cyan-300">KLIK KIRI: TEMBAK</div>
            <div className="text-[9px] font-semibold text-slate-400">GESER: KAMERA</div>
          </div>
        </div>
      </div>

      {/* Legend Ringkas */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-300 pt-0.5 border-t border-white/8">
        <div><span className="font-black text-cyan-300">WASD</span> · Bergerak</div>
        <div><span className="font-black text-cyan-300">1 / 2 / 3</span> · Pilih Senjata</div>
        <div><span className="font-black text-cyan-300">SPACE</span> · Lompat</div>
        <div><span className="font-black text-cyan-300">H / P / ESC</span> · Petunjuk &amp; Pause</div>
      </div>
    </div>
  );
};

export const GamepadVisual: React.FC = () => {
  return (
    <div className="bg-[#060a14] border border-white/10 rounded-2xl p-3.5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400">
          SKEMA CONTROLLER / GAMEPAD
        </span>
        <span className="text-[10px] font-bold text-slate-400">Dual Stick Layout</span>
      </div>

      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-2.5 flex items-center justify-center">
        <svg viewBox="0 0 320 192" className="w-full max-w-[285px] h-auto" aria-label="Skema Controller">
          <defs>
            <linearGradient id="gpBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="55%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#090d16" />
            </linearGradient>
            <linearGradient id="gpPlate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#172033" />
              <stop offset="100%" stopColor="#0b1120" />
            </linearGradient>
          </defs>

          {/* Top Center Module / Battery Hump */}
          <path
            d="M128 24 C132 17 188 17 192 24 L196 36 L124 36 Z"
            fill="#0f172a"
            stroke="#334155"
            strokeWidth="1.6"
          />

          {/* Triggers (LT / RT) menonjol di bahu atas */}
          <path
            d="M66 36 L68 15 C69 11 86 11 89 16 L93 34 Z"
            fill="#0f172a"
            stroke="#475569"
            strokeWidth="1.6"
          />
          <path
            d="M254 36 L252 15 C251 11 234 11 231 16 L227 34 Z"
            fill="rgba(34,211,238,0.2)"
            stroke="#22d3ee"
            strokeWidth="1.7"
          />
          <text x="79" y="25" textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="800">LT</text>
          <text x="241" y="25" textAnchor="middle" fill="#67e8f9" fontSize="8" fontWeight="800">RT</text>

          {/* Body Utama (Gaya Simetris sesuai referensi) */}
          <path
            d="M66 34 C86 24 108 32 126 37 C144 41 176 41 194 37 C212 32 234 24 254 34 C276 45 291 82 293 122 C295 154 277 177 254 174 C236 172 222 156 208 148 C194 141 126 141 112 148 C98 156 84 172 66 174 C43 177 25 154 27 122 C29 82 44 45 66 34 Z"
            fill="url(#gpBody)"
            stroke="#334155"
            strokeWidth="2.4"
          />

          {/* Bumpers (LB / RB) mengikuti lengkung bahu atas */}
          <path
            d="M54 46 C66 35 88 31 106 37 C107 43 102 48 93 47 C77 45 64 49 54 53 Z"
            fill="#1e293b"
            stroke="#64748b"
            strokeWidth="1.4"
          />
          <path
            d="M266 46 C254 35 232 31 214 37 C213 43 218 48 227 47 C243 45 256 49 266 53 Z"
            fill="#1e293b"
            stroke="#64748b"
            strokeWidth="1.4"
          />
          <text x="82" y="43" textAnchor="middle" fill="#cbd5e1" fontSize="7.5" fontWeight="800">LB</text>
          <text x="238" y="43" textAnchor="middle" fill="#cbd5e1" fontSize="7.5" fontWeight="800">RB</text>

          {/* Garis Kontur Atas + Connect & Sensor Bar */}
          <path
            d="M110 43 C130 56 190 56 210 43"
            fill="none"
            stroke="#1e293b"
            strokeWidth="1.4"
          />
          <rect x="148" y="41" width="24" height="5" rx="2.5" fill="#090d16" stroke="#334155" strokeWidth="1" />
          <circle cx="133" cy="43.5" r="2" fill="#38bdf8" opacity="0.8" />

          {/* Faceplate Dalam Halus */}
          <path
            d="M114 54 C134 62 186 62 206 54 L214 134 C190 132 130 132 106 134 Z"
            fill="url(#gpPlate)"
            opacity="0.55"
          />

          {/* D-Pad Bulat di Kiri Atas */}
          <circle cx="78" cy="90" r="22" fill="#090d16" stroke="#334155" strokeWidth="1.6" />
          <circle cx="78" cy="90" r="18" fill="#172033" stroke="#475569" strokeWidth="1.2" />
          <path
            d="M73 75 H83 V85 H93 V95 H83 V105 H73 V95 H63 V85 H73 Z"
            fill="#1e293b"
            stroke="#64748b"
            strokeWidth="1.3"
          />

          {/* Tombol Back & Start Oval di Tengah */}
          <rect x="122" y="83" width="17" height="10" rx="5" fill="#0f172a" stroke="#64748b" strokeWidth="1.4" />
          <text x="130.5" y="77" textAnchor="middle" fill="#94a3b8" fontSize="6.5" fontWeight="800">BACK</text>

          <rect x="181" y="83" width="17" height="10" rx="5" fill="rgba(56,189,248,0.18)" stroke="#38bdf8" strokeWidth="1.5" />
          <text x="189.5" y="77" textAnchor="middle" fill="#7dd3fc" fontSize="6.5" fontWeight="800">START</text>

          {/* Face Buttons Y, B, A, X di Kanan Atas */}
          <circle cx="242" cy="70" r="9.5" fill="#0f172a" stroke="#facc15" strokeWidth="1.8" />
          <text x="242" y="73.5" textAnchor="middle" fill="#fef08a" fontSize="9" fontWeight="900">Y</text>

          <circle cx="262" cy="90" r="9.5" fill="#0f172a" stroke="#fb7185" strokeWidth="1.8" />
          <text x="262" y="93.5" textAnchor="middle" fill="#fecdd3" fontSize="9" fontWeight="900">B</text>

          <circle cx="242" cy="110" r="9.5" fill="#0f172a" stroke="#34d399" strokeWidth="1.8" />
          <text x="242" y="113.5" textAnchor="middle" fill="#a7f3d0" fontSize="9" fontWeight="900">A</text>

          <circle cx="222" cy="90" r="9.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.8" />
          <text x="222" y="93.5" textAnchor="middle" fill="#bae6fd" fontSize="9" fontWeight="900">X</text>

          {/* Left Stick & Right Stick Simetris di Bawah */}
          <circle cx="122" cy="133" r="19" fill="#090d16" stroke="#334155" strokeWidth="1.5" />
          <circle cx="122" cy="133" r="14" fill="#1e293b" stroke="#22d3ee" strokeWidth="2" />
          <circle cx="122" cy="133" r="7.5" fill="#0f172a" stroke="#22d3ee" strokeWidth="1" opacity="0.85" />
          <text x="122" y="135.5" textAnchor="middle" fill="#cffafe" fontSize="7" fontWeight="900">LS</text>

          <circle cx="198" cy="133" r="19" fill="#090d16" stroke="#334155" strokeWidth="1.5" />
          <circle cx="198" cy="133" r="14" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
          <circle cx="198" cy="133" r="7.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" opacity="0.85" />
          <text x="198" y="135.5" textAnchor="middle" fill="#e0f2fe" fontSize="7" fontWeight="900">RS</text>
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-300 pt-0.5 border-t border-white/8">
        <div><span className="font-black text-cyan-300">LS / D-Pad</span> · Gerak &amp; Menu</div>
        <div><span className="font-black text-cyan-300">RT</span> · Menembak</div>
        <div><span className="font-black text-cyan-300">RS</span> · Arahkan Kamera</div>
        <div><span className="font-black text-emerald-300">A</span> · Lompat / Pilih</div>
        <div><span className="font-black text-amber-300">Y</span> · Ganti Senjata</div>
        <div><span className="font-black text-rose-300">B / START</span> · Kembali / Pause</div>
      </div>
    </div>
  );
};

export const MobileTouchVisual: React.FC<{ gyroEnabled: boolean }> = ({ gyroEnabled }) => {
  return (
    <div className="bg-[#060a14] border border-white/10 rounded-2xl p-3.5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400">
          SKEMA LAYAR SENTUH MOBILE
        </span>
        <span className={`text-[10px] font-bold ${gyroEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
          {gyroEnabled ? 'Gyroscope Aktif' : 'Kontrol Sentuh Standar'}
        </span>
      </div>

      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3 flex items-center justify-center">
        <div className="w-full max-w-[248px] aspect-[16/9] rounded-2xl border-2 border-slate-700 bg-[#0b1222] relative p-2.5 flex items-center justify-between overflow-hidden">
          {/* Notch / Kamera depan */}
          <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-slate-700" />

          {/* Zona Kiri: Virtual Joystick */}
          <div className="flex flex-col items-center justify-end h-full pl-2 pb-1">
            <div className="w-14 h-14 rounded-full border-2 border-dashed border-cyan-400/60 bg-cyan-400/10 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-cyan-400/50 border border-cyan-200" />
            </div>
            <span className="text-[8px] font-extrabold text-cyan-300 mt-1">JOYSTICK GERAK</span>
          </div>

          {/* Tengah: Gyro indicator */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-4 h-4 rounded-full border border-white/40 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-cyan-300" />
            </div>
            {gyroEnabled && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-[8px] font-black text-emerald-300">
                GYRO
              </span>
            )}
          </div>

          {/* Zona Kanan: Kamera + Tombol Aksi */}
          <div className="flex flex-col items-end justify-between h-full pr-1">
            <div className="px-1.5 py-0.5 rounded bg-white/8 border border-white/15 text-[8px] font-extrabold text-slate-300">
              SENJATA
            </div>
            <div className="flex items-end gap-1.5">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center text-[7px] font-black text-emerald-200">
                LOMPAT
              </div>
              <div className="w-11 h-11 rounded-full bg-rose-500/25 border-2 border-rose-400 flex items-center justify-center text-[8px] font-black text-rose-200">
                TEMBAK
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-300 pt-0.5 border-t border-white/8">
        <div><span className="font-black text-cyan-300">Sisi Kiri</span> · Virtual Joystick</div>
        <div><span className="font-black text-cyan-300">Sisi Kanan</span> · Geser Bidik Kamera</div>
        <div><span className="font-black text-rose-300">Tombol Tembak</span> · Tahan untuk Laser</div>
        <div><span className="font-black text-emerald-300">Gyroscope</span> · Bidik Miringkan HP</div>
      </div>
    </div>
  );
};

export const VRVisual: React.FC<{
  turnMode: VRTurnMode;
  movementMode: VRMovementMode;
}> = ({ turnMode, movementMode }) => {
  return (
    <div className="bg-[#060a14] border border-white/10 rounded-2xl p-3.5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400">
          SKEMA META QUEST TOUCH
        </span>
        <span className="text-[10px] font-bold text-slate-400">6DoF Dual Controllers</span>
      </div>

      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3 grid grid-cols-2 gap-3">
        {/* Quest Touch Controller Kiri */}
        <div className="flex flex-col items-center gap-1.5">
          <svg viewBox="0 0 120 132" className="w-24 h-24" aria-label="Controller Meta Quest Kiri">
            {/* Halo Tracking Ring miring */}
            <path
              d="M24 38 C16 18 46 8 78 16 C100 22 106 42 94 56"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="4.5"
              strokeLinecap="round"
              opacity="0.9"
            />
            {/* Trigger Telunjuk (belakang atas) */}
            <path d="M84 44 C94 46 98 56 92 64 L82 60 Z" fill="#1e293b" stroke="#64748b" strokeWidth="1.4" />
            {/* Gagang Ergonomis Pistol Grip */}
            <path
              d="M36 42 C42 32 76 32 82 48 L72 110 C70 120 50 122 46 112 L34 62 C32 54 33 46 36 42 Z"
              fill="#0f172a"
              stroke="#475569"
              strokeWidth="2.2"
            />
            {/* Grip Button (sisi dalam kanan gagang) */}
            <rect x="74" y="68" width="5" height="18" rx="2.5" fill="#1e293b" stroke="#64748b" strokeWidth="1.2" />
            {/* Faceplate Atas (Thumb Rest) */}
            <ellipse cx="58" cy="48" rx="20" ry="15" fill="#172033" stroke="#334155" strokeWidth="1.4" />
            {/* Thumbstick Kiri */}
            <circle cx="51" cy="44" r="6.8" fill="#1e293b" stroke="#22d3ee" strokeWidth="1.8" />
            {/* Tombol Y & X */}
            <circle cx="66" cy="42" r="3.6" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.1" />
            <text x="66" y="44" textAnchor="middle" fill="#cbd5e1" fontSize="5" fontWeight="800">Y</text>
            <circle cx="64" cy="52" r="3.6" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.1" />
            <text x="64" y="54" textAnchor="middle" fill="#cbd5e1" fontSize="5" fontWeight="800">X</text>
            {/* Tombol Menu */}
            <circle cx="52" cy="56" r="2.8" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
          </svg>
          <span className="text-[10px] font-black text-cyan-300">TOUCH KIRI</span>
          <span className="text-[9px] text-slate-400 text-center">
            Stick: Gerak ({movementMode === 'teleport' ? 'Teleport' : 'Halus'})
          </span>
        </div>

        {/* Quest Touch Controller Kanan */}
        <div className="flex flex-col items-center gap-1.5">
          <svg viewBox="0 0 120 132" className="w-24 h-24" aria-label="Controller Meta Quest Kanan">
            {/* Halo Tracking Ring miring */}
            <path
              d="M96 38 C104 18 74 8 42 16 C20 22 14 42 26 56"
              fill="none"
              stroke="#a855f7"
              strokeWidth="4.5"
              strokeLinecap="round"
              opacity="0.9"
            />
            {/* Trigger Telunjuk (Tembak) */}
            <path d="M36 44 C26 46 22 56 28 64 L38 60 Z" fill="rgba(244,63,94,0.3)" stroke="#fb7185" strokeWidth="1.6" />
            {/* Gagang Ergonomis Pistol Grip */}
            <path
              d="M84 42 C78 32 44 32 38 48 L48 110 C50 120 70 122 74 112 L86 62 C88 54 87 46 84 42 Z"
              fill="#0f172a"
              stroke="#475569"
              strokeWidth="2.2"
            />
            {/* Grip Button (sisi dalam kiri gagang) */}
            <rect x="41" y="68" width="5" height="18" rx="2.5" fill="#1e293b" stroke="#64748b" strokeWidth="1.2" />
            {/* Faceplate Atas (Thumb Rest) */}
            <ellipse cx="62" cy="48" rx="20" ry="15" fill="#172033" stroke="#334155" strokeWidth="1.4" />
            {/* Thumbstick Kanan */}
            <circle cx="69" cy="44" r="6.8" fill="#1e293b" stroke="#c084fc" strokeWidth="1.8" />
            {/* Tombol B & A */}
            <circle cx="54" cy="42" r="3.6" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.1" />
            <text x="54" y="44" textAnchor="middle" fill="#cbd5e1" fontSize="5" fontWeight="800">B</text>
            <circle cx="56" cy="52" r="3.6" fill="#0f172a" stroke="#34d399" strokeWidth="1.2" />
            <text x="56" y="54" textAnchor="middle" fill="#a7f3d0" fontSize="5" fontWeight="800">A</text>
            {/* Tombol Meta */}
            <circle cx="68" cy="56" r="2.8" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
          </svg>
          <span className="text-[10px] font-black text-purple-300">TOUCH KANAN</span>
          <span className="text-[9px] text-slate-400 text-center">
            Trigger: Tembak · Stick: Putar ({turnMode === 'snap' ? 'Snap' : 'Halus'})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-300 pt-0.5 border-t border-white/8">
        <div><span className="font-black text-cyan-300">Aim 6DoF</span> · Arahkan Touch Kanan</div>
        <div><span className="font-black text-rose-300">Trigger Kanan</span> · Tembak Laser</div>
      </div>
    </div>
  );
};

