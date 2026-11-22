import React, { useState } from 'react';
import { CharacterId, DifficultyLevel } from '../game/types';
import { CHARACTER_REGISTRY, DIFFICULTY_REGISTRY } from '../game/rules';
import {
  Shield,
  Heart,
  Play,
  X,
  Check,
  Clock,
  Sparkles,
  Gauge,
} from 'lucide-react';
import { GamepadBadge } from './GamepadBadge';

interface MissionSetupModalProps {
  selectedCharacter: CharacterId;
  selectedDifficulty: DifficultyLevel;
  onSelectCharacter: (id: CharacterId) => void;
  onSelectDifficulty: (diff: DifficultyLevel) => void;
  onConfirmStart: () => void;
  onClose: () => void;
  isGamepadConnected?: boolean;
}

const CHARACTER_LIST: CharacterId[] = ['raka', 'naya'];
const DIFFICULTY_LIST: DifficultyLevel[] = ['easy', 'normal', 'hard'];

export const MissionSetupModal: React.FC<MissionSetupModalProps> = ({
  selectedCharacter,
  selectedDifficulty,
  onSelectCharacter,
  onSelectDifficulty,
  onConfirmStart,
  onClose,
  isGamepadConnected = false,
}) => {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  return (
    <div className="fixed inset-0 bg-[#050811]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50 font-sans text-white ui-backdrop-enter">
      <div
        data-ui-board="true"
        className="max-w-3xl w-full max-h-[92dvh] bg-[#080c16]/98 border border-blue-500/30 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col overflow-hidden ui-panel-enter"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-white/10 shrink-0">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-400 block">
              PERSIAPAN OPERASI SPEKTRUM
            </span>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
              PILIH KARAKTER &amp; TINGKAT KESULITAN
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Kembali ke Menu"
            className="p-2 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
          {/* 1. Pemilihan 2 Karakter Utama (Agen Raka & Agen Naya) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>1. PILIH AGEN UTAMA</span>
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                Masing-masing memiliki Ability Khusus In-Game
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                    className={`group text-left rounded-2xl p-3.5 sm:p-4 border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#0e1e3e]/90 border-cyan-400 shadow-lg shadow-cyan-500/10'
                        : 'bg-[#0b101e] hover:bg-[#0f172a] border-white/12 hover:border-blue-400/40'
                    }`}
                  >
                    {/* Ruang Khusus Gambar Karakter (Portrait Frame) */}
                    <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] rounded-xl overflow-hidden bg-[#050811] border border-white/12 flex items-center justify-center">
                      {!imgFailed ? (
                        <img
                          src={profile.imagePath}
                          alt={profile.name}
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, [charId]: true }))
                          }
                          className="w-full h-full object-contain object-center transition-transform duration-300 group-hover:scale-103"
                        />
                      ) : (
                        /* Fallback Siluet Agen & Penanda Ruang Gambar */
                        <div className="flex flex-col items-center justify-center text-center p-3 select-none">
                          <div
                            className={`w-16 h-16 rounded-2xl border flex items-center justify-center mb-2 ${
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
                          <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                            {profile.name}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400 mt-0.5">
                            Taruh gambar di: public{profile.imagePath}
                          </span>
                        </div>
                      )}

                      {/* Badge Kode & Status Pilihan */}
                      <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-lg bg-[#050811]/85 border border-white/15 text-[10px] font-black uppercase tracking-wider text-slate-200">
                        {profile.codename} · {profile.genderLabel}
                      </div>

                      {isSelected && (
                        <div className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-white text-slate-950 text-[10px] font-black uppercase flex items-center gap-1 shadow-sm">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>TERPILIH</span>
                        </div>
                      )}
                    </div>

                    {/* Nama & Peran */}
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-black uppercase tracking-tight text-white">
                          {profile.name}
                        </h3>
                        <span
                          className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                            isRaka
                              ? 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/35'
                              : 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/35'
                          }`}
                        >
                          {profile.abilityName}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-300 mt-0.5">
                        {profile.role}
                      </p>
                    </div>

                    {/* Kartu Ability Khusus & Cooldown */}
                    <div className="rounded-xl bg-[#060913] border border-white/10 p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-extrabold uppercase">
                        <span className="flex items-center gap-1.5 text-white">
                          {isRaka ? (
                            <Shield className="w-3.5 h-3.5 text-cyan-400" />
                          ) : (
                            <Heart className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          <span>SKILL: {profile.abilityName}</span>
                        </span>
                        <span className="flex items-center gap-1 text-slate-300 tabular-nums">
                          <Clock className="w-3 h-3 text-blue-400" />
                          <span>CD: {profile.abilityCooldownSeconds / 60} Menit</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-snug">
                        {profile.abilityDescription}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Pemilihan Tingkat Kesulitan (Mudah, Normal, Sulit) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                <span>2. PILIH TINGKAT KESULITAN</span>
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                Menyesuaikan jumlah target, kecepatan musuh &amp; bantuan petunjuk
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {DIFFICULTY_LIST.map((diffId) => {
                const cfg = DIFFICULTY_REGISTRY[diffId];
                const active = selectedDifficulty === diffId;

                return (
                  <button
                    key={diffId}
                    type="button"
                    onClick={() => onSelectDifficulty(diffId)}
                    className={`text-left rounded-2xl p-3.5 border-2 transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      active
                        ? 'bg-[#0e1e3e]/95 border-white text-white shadow-md'
                        : 'bg-[#0b101e] hover:bg-[#0f172a] border-white/12 text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm sm:text-base font-black uppercase tracking-wide text-white">
                          {cfg.label}
                        </span>
                        {active && (
                          <span className="px-2 py-0.5 rounded-md bg-white text-slate-950 text-[10px] font-black uppercase">
                            AKTIF
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-cyan-300 block mt-0.5">
                        {cfg.tagline}
                      </span>
                      <p className="text-xs text-slate-300 mt-1.5 leading-snug">
                        {cfg.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-bold text-slate-300 tabular-nums">
                      <span>HP/Shield: {cfg.playerInitialHp}/{cfg.playerInitialShield}</span>
                      <span>Skor: {Math.round(cfg.scoreMult * 100)}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Tombol Mulai */}
        <div className="pt-3.5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="text-xs font-semibold text-slate-300">
            Agen Aktif:{' '}
            <strong className="text-white">
              {CHARACTER_REGISTRY[selectedCharacter].name}
            </strong>{' '}
            · Mode:{' '}
            <strong className="text-cyan-300">
              {DIFFICULTY_REGISTRY[selectedDifficulty].label}
            </strong>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-11 rounded-xl bg-white/6 hover:bg-white/12 border border-white/15 text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-200 cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={onConfirmStart}
              data-start="true"
              className="flex-1 sm:flex-initial px-6 h-11 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs sm:text-sm font-black uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <Play className="w-4 h-4 fill-current text-blue-700" />
              <span>MULAI OPERASI</span>
              {isGamepadConnected && <GamepadBadge button="A" visible size="sm" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
