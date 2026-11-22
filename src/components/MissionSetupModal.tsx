import React, { useState } from 'react';
import { CharacterId } from '../game/types';
import { CHARACTER_REGISTRY } from '../game/rules';
import { Shield, Heart, Play, X, Check } from 'lucide-react';
import { GamepadBadge } from './GamepadBadge';

interface MissionSetupModalProps {
  selectedCharacter: CharacterId;
  onSelectCharacter: (id: CharacterId) => void;
  onConfirmStart: () => void;
  onClose: () => void;
  isGamepadConnected?: boolean;
}

const CHARACTER_LIST: CharacterId[] = ['raka', 'naya'];

// Preload & pre-decode potret kedua karakter sejak awal aplikasi dimuat agar tampil instan tanpa loading saat klik MULAI MISI
const preloadedCharacterImages: HTMLImageElement[] = [];
if (typeof window !== 'undefined') {
  CHARACTER_LIST.forEach((charId) => {
    const img = new Image();
    img.decoding = 'sync';
    img.src = CHARACTER_REGISTRY[charId].imagePath;
    if (typeof img.decode === 'function') {
      img.decode().catch(() => {});
    }
    preloadedCharacterImages.push(img);
  });
}

export const MissionSetupModal: React.FC<MissionSetupModalProps> = ({
  selectedCharacter,
  onSelectCharacter,
  onConfirmStart,
  onClose,
  isGamepadConnected = false,
}) => {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  return (
    <div className="fixed inset-0 bg-[#050811]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50 font-sans text-white ui-backdrop-enter">
      <div
        data-ui-board="true"
        className="max-w-xl w-full bg-[#090d18]/98 border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 ui-panel-enter"
      >
        {/* Header Singkat */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
            PILIH KARAKTER
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-2 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2 Papan Karakter (Singkat, Padat, Ruang Gambar Lega) */}
        <div className="grid grid-cols-2 gap-3.5">
          {CHARACTER_LIST.map((charId) => {
            const profile = CHARACTER_REGISTRY[charId];
            const isSelected = selectedCharacter === charId;
            const isRaka = charId === 'raka';
            const imgFailed = Boolean(failedImages[charId]);

            return (
              <button
                key={charId}
                type="button"
                onClick={() => onSelectCharacter(charId)}
                className={`group text-left rounded-2xl p-3 sm:p-3.5 border-2 transition-all cursor-pointer flex flex-col gap-3 ${
                  isSelected
                    ? 'bg-[#0e1e3e]/90 border-cyan-400 shadow-lg shadow-cyan-500/10'
                    : 'bg-[#0b101e] hover:bg-[#0f172a] border-white/12 hover:border-white/25'
                }`}
              >
                {/* Ruang Gambar Karakter */}
                <div className="relative w-full aspect-square max-h-60 rounded-xl overflow-hidden bg-[#050811] border border-white/10 p-1.5 flex items-center justify-center">
                  {!imgFailed ? (
                    <img
                      src={profile.imagePath}
                      alt={profile.name}
                      loading="eager"
                      decoding="sync"
                      fetchPriority="high"
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [charId]: true }))
                      }
                      className="w-full h-full object-contain object-center transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)]"
                    />
                  ) : (
                    <div
                      className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${
                        isRaka
                          ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300'
                          : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                      }`}
                    >
                      {isRaka ? (
                        <Shield className="w-8 h-8" />
                      ) : (
                        <Heart className="w-8 h-8" />
                      )}
                    </div>
                  )}

                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white text-slate-950 flex items-center justify-center shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Info Karakter Singkat & Padat */}
                <div>
                  <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white">
                    {profile.name}
                  </h3>

                  <div className="mt-1.5 px-2.5 py-2 rounded-xl bg-[#060913] border border-white/10 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-1 text-[11px] font-extrabold uppercase">
                      <span
                        className={`flex items-center gap-1 ${
                          isRaka ? 'text-cyan-300' : 'text-emerald-300'
                        }`}
                      >
                        {isRaka ? (
                          <Shield className="w-3 h-3 shrink-0" />
                        ) : (
                          <Heart className="w-3 h-3 shrink-0" />
                        )}
                        <span>{profile.abilityName}</span>
                      </span>
                      <span className="text-slate-400 tabular-nums">
                        CD {profile.abilityCooldownSeconds / 60}m
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-300">
                      {isRaka ? 'Kebal tembakan 6 detik' : 'Pulihkan +20% HP'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tombol Aksi */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-5 h-11 rounded-xl bg-white/6 hover:bg-white/12 border border-white/15 text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-200 cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={onConfirmStart}
            data-start="true"
            className="flex-1 h-11 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs sm:text-sm font-black uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <Play className="w-4 h-4 fill-current text-blue-700" />
            <span>MULAI</span>
            {isGamepadConnected && <GamepadBadge button="A" visible size="sm" />}
          </button>
        </div>
      </div>
    </div>
  );
};
