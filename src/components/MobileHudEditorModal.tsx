import React, { useRef, useState } from 'react';
import {
  DEFAULT_MOBILE_HUD_LAYOUT,
  GameSettings,
  MOBILE_CONTROL_LABELS,
  MobileControlButtonConfig,
  MobileControlElementId,
  MobileHudLayoutSettings,
  clampMobileButtonConfig,
  resolveMobileHudLayout,
} from '../game/types';
import {
  ArrowUp,
  Check,
  Crosshair,
  Flame,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Shield,
  Target,
  X,
  Zap,
} from 'lucide-react';

interface MobileHudEditorModalProps {
  settings: GameSettings;
  initialOrientation: 'landscape' | 'portrait';
  onSaveLayout: (nextHudLayout: MobileHudLayoutSettings) => void;
  onClose: () => void;
}

const ELEMENT_ORDER: MobileControlElementId[] = [
  'joystick',
  'shoot',
  'jump',
  'ability',
  'weaponSwitch',
];

export const MobileHudEditorModal: React.FC<MobileHudEditorModalProps> = ({
  settings,
  initialOrientation,
  onSaveLayout,
  onClose,
}) => {
  const [editOrientation, setEditOrientation] = useState<'landscape' | 'portrait'>(
    initialOrientation
  );
  const [selectedId, setSelectedId] = useState<MobileControlElementId>('shoot');
  const [panelTopPosition, setPanelTopPosition] = useState<boolean>(true);
  const [draftLayouts, setDraftLayouts] = useState<MobileHudLayoutSettings>(() => ({
    landscape: resolveMobileHudLayout(settings, 'landscape'),
    portrait: resolveMobileHudLayout(settings, 'portrait'),
  }));

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    id: MobileControlElementId;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const currentMap = draftLayouts[editOrientation];
  const selectedCfg = currentMap[selectedId];

  const updateElementConfig = (
    id: MobileControlElementId,
    patch: Partial<MobileControlButtonConfig>
  ) => {
    setDraftLayouts((prev) => {
      const cur = prev[editOrientation][id];
      const nextCfg = clampMobileButtonConfig(
        { ...cur, ...patch },
        DEFAULT_MOBILE_HUD_LAYOUT[editOrientation][id]
      );
      return {
        ...prev,
        [editOrientation]: {
          ...prev[editOrientation],
          [id]: nextCfg,
        },
      };
    });
  };

  const handleResetOrientationDefault = () => {
    const def = DEFAULT_MOBILE_HUD_LAYOUT[editOrientation];
    setDraftLayouts((prev) => ({
      ...prev,
      [editOrientation]: {
        joystick: { ...def.joystick },
        shoot: { ...def.shoot },
        jump: { ...def.jump },
        ability: { ...def.ability },
        weaponSwitch: { ...def.weaponSwitch },
      },
    }));
  };

  const handlePointerDownElement = (
    e: React.PointerEvent<HTMLDivElement>,
    id: MobileControlElementId
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(id);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cur = currentMap[id];
    const centerPxX = rect.left + (cur.xPercent / 100) * rect.width;
    const centerPxY = rect.top + (cur.yPercent / 100) * rect.height;

    dragStateRef.current = {
      id,
      pointerId: e.pointerId,
      offsetX: e.clientX - centerPxX,
      offsetY: e.clientY - centerPxY,
    };
  };

  const handlePointerMoveElement = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const targetX = e.clientX - drag.offsetX - rect.left;
    const targetY = e.clientY - drag.offsetY - rect.top;

    const nextXPercent = (targetX / rect.width) * 100;
    const nextYPercent = (targetY / rect.height) * 100;

    updateElementConfig(drag.id, {
      xPercent: nextXPercent,
      yPercent: nextYPercent,
    });
  };

  const handlePointerUpElement = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    dragStateRef.current = null;
  };

  return (
    <div
      ref={canvasRef}
      className="fixed inset-0 z-[70] bg-[#040711]/95 select-none touch-none overflow-hidden font-sans text-white"
    >
      {/* Background Grid Taktis */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(56,189,248,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.18) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Garis Tengah Bantu */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-cyan-400/20 pointer-events-none" />
      <div className="absolute top-1/2 left-0 right-0 h-px bg-cyan-400/20 pointer-events-none" />

      {/* Siluet Area HUD Info Atas sebagai Referensi */}
      <div className="absolute top-3 left-3 px-2.5 py-1.5 rounded-xl border border-dashed border-white/15 bg-white/[0.02] text-[9px] font-bold text-slate-500 pointer-events-none">
        AREA HUD STAGE &amp; HP
      </div>
      <div className="absolute top-3 right-3 px-2.5 py-1.5 rounded-xl border border-dashed border-white/15 bg-white/[0.02] text-[9px] font-bold text-slate-500 pointer-events-none">
        AREA SKOR &amp; PELURU
      </div>

      {/* ====================================================================
          5 ELEMEN TOMBOL GUI MOBILE YANG DAPAT DIGESER (DRAG & DROP)
         ==================================================================== */}
      {ELEMENT_ORDER.map((id) => {
        const cfg = currentMap[id];
        const isSelected = selectedId === id;
        const scale = cfg.scalePercent / 100;
        const opacity = cfg.opacityPercent / 100;

        return (
          <div
            key={id}
            onPointerDown={(e) => handlePointerDownElement(e, id)}
            onPointerMove={handlePointerMoveElement}
            onPointerUp={handlePointerUpElement}
            onPointerCancel={handlePointerUpElement}
            style={{
              left: `${cfg.xPercent}%`,
              top: `${cfg.yPercent}%`,
              transform: `translate(-50%, -50%) scale(${scale})`,
              opacity,
            }}
            className={`absolute cursor-grab active:cursor-grabbing pointer-events-auto transition-shadow ${
              isSelected
                ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-[#040711] rounded-full shadow-[0_0_22px_rgba(34,211,238,0.45)] z-30'
                : 'z-20'
            }`}
          >
            {id === 'joystick' && (
              <div className="w-28 h-28 rounded-full bg-slate-900/55 border-2 border-cyan-400/60 flex items-center justify-center relative">
                <div className="w-16 h-16 rounded-full border border-white/25" />
                <div className="absolute w-12 h-12 rounded-full bg-cyan-400/70 border-2 border-white/85 flex items-center justify-center">
                  <Move className="w-4 h-4 text-slate-950" />
                </div>
                <span className="absolute -bottom-5 px-1.5 py-0.5 rounded bg-slate-950/90 border border-white/15 text-[8px] font-black text-cyan-300 whitespace-nowrap">
                  GERAK
                </span>
              </div>
            )}

            {id === 'shoot' && (
              <div className="w-18 h-18 rounded-full bg-rose-500/50 border-2 border-rose-300/80 text-white flex flex-col items-center justify-center relative">
                <Crosshair className="w-7 h-7" />
                <span className="text-[8px] font-black uppercase tracking-wider mt-0.5">
                  TEMBAK
                </span>
              </div>
            )}

            {id === 'jump' && (
              <div className="w-13 h-13 rounded-full bg-slate-900/60 border-2 border-cyan-400/60 text-cyan-300 flex flex-col items-center justify-center">
                <ArrowUp className="w-5 h-5" />
                <span className="text-[7px] font-black uppercase leading-none">LOMPAT</span>
              </div>
            )}

            {id === 'ability' && (
              <div className="w-13 h-13 rounded-full bg-cyan-500/45 border-2 border-cyan-300/80 text-cyan-100 flex flex-col items-center justify-center">
                <Shield className="w-5 h-5" />
                <span className="text-[8px] font-black uppercase leading-none mt-0.5">
                  JURUS
                </span>
              </div>
            )}

            {id === 'weaponSwitch' && (
              <div className="flex flex-col items-center gap-1">
                <div className="flex gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-cyan-400/45">
                  <div className="w-9 h-7 rounded-lg bg-cyan-400 text-slate-950 flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="w-9 h-7 rounded-lg bg-white/15 text-white/80 flex items-center justify-center">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div className="w-9 h-7 rounded-lg bg-white/15 text-white/80 flex items-center justify-center">
                    <Target className="w-4 h-4" />
                  </div>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-slate-950/90 border border-white/15 text-[8px] font-black text-cyan-300 whitespace-nowrap">
                  SENJATA
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* ====================================================================
          PANEL KONTROL EDITOR (RINGKAS, PADAT & BISA PINDAH ATAS/BAWAH)
         ==================================================================== */}
      <div
        data-ui-board="true"
        className={`absolute left-1/2 -translate-x-1/2 z-40 w-[min(94vw,440px)] bg-[#090d18]/95 border border-white/18 rounded-2xl p-3 shadow-2xl flex flex-col gap-2.5 ${
          panelTopPosition ? 'top-3' : 'bottom-3'
        }`}
      >
        {/* Baris 1: Judul, Tab Orientasi (Landscape / Portrait), Pindah Panel, Tutup */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-0.5">
            {(
              [
                { id: 'landscape', label: 'LANDSCAPE' },
                { id: 'portrait', label: 'PORTRAIT' },
              ] as const
            ).map((ori) => (
              <button
                key={ori.id}
                type="button"
                onClick={() => setEditOrientation(ori.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide cursor-pointer ${
                  editOrientation === ori.id
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {ori.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPanelTopPosition((p) => !p)}
              className="px-2 py-1 rounded-lg bg-white/6 hover:bg-white/12 border border-white/10 text-[9px] font-extrabold text-slate-300 cursor-pointer"
            >
              {panelTopPosition ? 'Panel ↓' : 'Panel ↑'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Batal"
              className="p-1 rounded-lg bg-white/6 hover:bg-white/12 border border-white/10 text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Baris 2: Pilihan Cepat 5 Tombol */}
        <div className="grid grid-cols-5 gap-1">
          {ELEMENT_ORDER.map((id) => {
            const shortLabel =
              id === 'joystick'
                ? 'GERAK'
                : id === 'shoot'
                  ? 'TEMBAK'
                  : id === 'jump'
                    ? 'LOMPAT'
                    : id === 'ability'
                      ? 'JURUS'
                      : 'SENJATA';
            const active = selectedId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedId(id)}
                className={`py-1 px-1 rounded-lg text-[9px] font-black uppercase truncate border cursor-pointer ${
                  active
                    ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                {shortLabel}
              </button>
            );
          })}
        </div>

        {/* Baris 3: Slider Ukuran & Opacity untuk Tombol Terpilih */}
        <div className="grid grid-cols-2 gap-2.5 bg-white/[0.03] border border-white/8 rounded-xl p-2">
          {/* Ukuran (50% - 160%) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] font-extrabold">
              <span className="text-slate-300">UKURAN</span>
              <span className="text-cyan-300 tabular-nums">{selectedCfg.scalePercent}%</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  updateElementConfig(selectedId, {
                    scalePercent: selectedCfg.scalePercent - 5,
                  })
                }
                className="w-6 h-6 rounded-lg bg-white/8 border border-white/12 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="range"
                min={50}
                max={160}
                step={5}
                aria-label="Ukuran Tombol"
                value={selectedCfg.scalePercent}
                onChange={(e) =>
                  updateElementConfig(selectedId, {
                    scalePercent: Number(e.target.value),
                  })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <button
                type="button"
                onClick={() =>
                  updateElementConfig(selectedId, {
                    scalePercent: selectedCfg.scalePercent + 5,
                  })
                }
                className="w-6 h-6 rounded-lg bg-white/8 border border-white/12 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Opacity (15% - 100%) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] font-extrabold">
              <span className="text-slate-300">OPACITY</span>
              <span className="text-cyan-300 tabular-nums">{selectedCfg.opacityPercent}%</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  updateElementConfig(selectedId, {
                    opacityPercent: selectedCfg.opacityPercent - 5,
                  })
                }
                className="w-6 h-6 rounded-lg bg-white/8 border border-white/12 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="range"
                min={15}
                max={100}
                step={5}
                aria-label="Opacity Tombol"
                value={selectedCfg.opacityPercent}
                onChange={(e) =>
                  updateElementConfig(selectedId, {
                    opacityPercent: Number(e.target.value),
                  })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <button
                type="button"
                onClick={() =>
                  updateElementConfig(selectedId, {
                    opacityPercent: selectedCfg.opacityPercent + 5,
                  })
                }
                className="w-6 h-6 rounded-lg bg-white/8 border border-white/12 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Baris 4: Info Singkat + Tombol Reset & Simpan */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-slate-400 truncate">
            Geser <strong className="text-cyan-300">{MOBILE_CONTROL_LABELS[selectedId]}</strong> di layar
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleResetOrientationDefault}
              className="px-2.5 h-8 rounded-xl bg-white/6 hover:bg-white/12 border border-white/12 text-[10px] font-extrabold uppercase text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onSaveLayout(draftLayouts);
                onClose();
              }}
              className="px-3.5 h-8 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer shadow-lg"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
