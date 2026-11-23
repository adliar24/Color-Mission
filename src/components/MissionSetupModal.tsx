import React, { useState } from 'react';
import { CharacterId } from '../game/types';
import { CHARACTER_REGISTRY } from '../game/rules';
import {
  Shield,
  Heart,
  Play,
  X,
  Check,
  User,
  GraduationCap,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { GamepadBadge } from './GamepadBadge';
import { loadLKPDSubmission, saveLKPDSubmission } from '../game/lkpd';

interface MissionSetupModalProps {
  selectedCharacter: CharacterId;
  onSelectCharacter: (id: CharacterId) => void;
  onConfirmStart: () => void;
  onClose: () => void;
  isGamepadConnected?: boolean;
}

const CHARACTER_LIST: CharacterId[] = ['raka', 'naya'];

// Preload potret kedua karakter
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
  // Step 1: 'identity' (Nama & Kelas) -> Step 2: 'character' (Pilih Karakter)
  const [step, setStep] = useState<'identity' | 'character'>('identity');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Muat data identitas yang sudah tersimpan sebelumnya
  const [studentName, setStudentName] = useState<string>(() => {
    return loadLKPDSubmission().studentName || '';
  });
  const [studentClass, setStudentClass] = useState<string>(() => {
    return loadLKPDSubmission().studentClass || '';
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleNextToCharacter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = studentName.trim();
    if (!trimmedName) {
      setValidationError('Nama pemain wajib diisi sebelum melanjutkan!');
      return;
    }

    // Simpan identitas ke penyimpanan lokal & sinkronisasi LKPD
    const currentLKPD = loadLKPDSubmission();
    saveLKPDSubmission({
      ...currentLKPD,
      studentName: trimmedName,
      studentClass: studentClass.trim() || '-',
    });

    setValidationError(null);
    setStep('character');
  };

  const handleFinalStart = () => {
    onConfirmStart();
  };

  return (
    <div className="fixed inset-0 bg-[#050811]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50 font-sans text-white ui-backdrop-enter">
      {step === 'identity' ? (
        /* ====================================================================
           PAPAN 1: PENGISIAN IDENTITAS PEMAIN (NAMA & KELAS)
           ==================================================================== */
        <div
          data-ui-board="true"
          className="max-w-md w-full bg-[#090d18]/98 border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col gap-5 ui-panel-enter"
        >
          {/* Header Papan 1 */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-white leading-tight">
                  Identitas Pemain
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Langkah 1 dari 2 · Masukkan nama sebelum bermain
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="p-2 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-slate-400 hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Input Identitas */}
          <form onSubmit={handleNextToCharacter} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-slate-200 block mb-1.5">
                Nama Lengkap / Panggilan <span className="text-cyan-400">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={studentName}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="Ketik nama pemain..."
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#060a14] border border-white/15 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-200 block mb-1.5">
                Kelas <span className="text-slate-500 font-normal">(Opsional)</span>
              </label>
              <div className="relative">
                <GraduationCap className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  placeholder="contoh: X RPL 1 atau 7A"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#060a14] border border-white/15 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {validationError && (
              <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Tombol Aksi Papan 1 */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-xl bg-white/6 hover:bg-white/12 border border-white/15 text-xs font-bold uppercase tracking-wide text-slate-200 cursor-pointer"
              >
                Batal
              </button>

              <button
                type="submit"
                className="h-11 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer shadow-lg transition-all"
              >
                <span>Pilih Karakter</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* ====================================================================
           PAPAN 2: PEMILIHAN KARAKTER (MUNCUL SETELAH NAMA DIISI)
           ==================================================================== */
        <div
          data-ui-board="true"
          className="max-w-xl w-full max-h-[95vh] overflow-y-auto bg-[#090d18]/98 border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 ui-panel-enter"
        >
          {/* Header Papan 2 */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white leading-tight">
                  Pilih Karakter Agen
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold">
                  {studentName}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Langkah 2 dari 2 · Pilih agen dengan kemampuan tempur yang Anda inginkan
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="p-2 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-slate-400 hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2 Kartu Karakter */}
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
                  className={`group text-left rounded-2xl p-3 sm:p-3.5 border-2 transition-all cursor-pointer flex flex-col gap-2.5 ${
                    isSelected
                      ? 'bg-[#0e1e3e]/90 border-cyan-400 shadow-lg shadow-cyan-500/10'
                      : 'bg-[#0b101e] hover:bg-[#0f172a] border-white/12 hover:border-white/25'
                  }`}
                >
                  {/* Gambar Karakter */}
                  <div className="relative w-full aspect-square max-h-52 rounded-xl overflow-hidden bg-[#050811] border border-white/10 p-1.5 flex items-center justify-center">
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
                        className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${
                          isRaka
                            ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300'
                            : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                        }`}
                      >
                        {isRaka ? (
                          <Shield className="w-7 h-7" />
                        ) : (
                          <Heart className="w-7 h-7" />
                        )}
                      </div>
                    )}

                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shadow-sm">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  {/* Info Karakter */}
                  <div>
                    <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-white">
                      {profile.name}
                    </h3>
                    <div className="mt-1 px-2 py-1.5 rounded-lg bg-[#060913] border border-white/10 flex items-center justify-between gap-1 text-[11px] font-semibold">
                      <span className={isRaka ? 'text-cyan-300' : 'text-emerald-300'}>
                        {profile.abilityName}
                      </span>
                      <span className="text-slate-400">
                        {profile.abilityCooldownSeconds / 60}m
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tombol Aksi Papan 2 */}
          <div className="flex items-center gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setStep('identity')}
              className="px-4 h-11 rounded-xl bg-white/6 hover:bg-white/12 border border-white/15 text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>

            <button
              type="button"
              onClick={handleFinalStart}
              data-start="true"
              className="flex-1 h-11 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs sm:text-sm font-black uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
            >
              <Play className="w-4 h-4 fill-current text-slate-950" />
              <span>MULAI MISI</span>
              {isGamepadConnected && <GamepadBadge button="A" visible size="sm" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
