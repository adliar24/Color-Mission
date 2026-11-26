import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Delete,
  Gamepad2,
} from 'lucide-react';
import { GamepadBadge } from './GamepadBadge';
import { loadLKPDSubmission, saveLKPDSubmission } from '../game/lkpd';
import { recordInitialSessionStartAsync } from '../lib/syncService';
import type { MenuGamepadCommand } from '../game/input/InputManager';

interface MissionSetupModalProps {
  selectedCharacter: CharacterId;
  onSelectCharacter: (id: CharacterId) => void;
  onConfirmStart: () => void;
  onClose: () => void;
  isGamepadConnected?: boolean;
}

const CHARACTER_LIST: CharacterId[] = ['raka', 'naya'];

const GAMEPAD_KEYBOARD_ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '-'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'SPASI', 'HAPUS'],
  ['KOLOM', 'BATAL', 'LANJUT'],
];

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

  // State Keyboard Virtual Gamepad (Desktop & Mobile)
  const [activeField, setActiveField] = useState<'name' | 'class'>('name');
  const [cursorRow, setCursorRow] = useState<number>(1);
  const [cursorCol, setCursorCol] = useState<number>(0);

  const handleNextToCharacter = useCallback(
    (e?: React.FormEvent) => {
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
    },
    [studentName, studentClass]
  );

  const handleBackspace = useCallback(() => {
    if (activeField === 'name') {
      setStudentName((prev) => prev.slice(0, -1));
    } else {
      setStudentClass((prev) => prev.slice(0, -1));
    }
  }, [activeField]);

  const handleVirtualKeyPress = useCallback(
    (key: string) => {
      if (key === 'HAPUS') {
        handleBackspace();
        return;
      }
      if (key === 'KOLOM') {
        setActiveField((prev) => (prev === 'name' ? 'class' : 'name'));
        return;
      }
      if (key === 'BATAL') {
        onClose();
        return;
      }
      if (key === 'LANJUT') {
        handleNextToCharacter();
        return;
      }
      const ch = key === 'SPASI' ? ' ' : key;
      if (activeField === 'name') {
        setStudentName((prev) => (prev.length < 32 ? prev + ch : prev));
        if (validationError) setValidationError(null);
      } else {
        setStudentClass((prev) => (prev.length < 18 ? prev + ch : prev));
      }
    },
    [activeField, handleBackspace, handleNextToCharacter, onClose, validationError]
  );

  const stateHandlerRef = useRef({
    cursorRow,
    cursorCol,
    handleVirtualKeyPress,
    handleBackspace,
    handleNextToCharacter,
    onClose,
  });
  stateHandlerRef.current = {
    cursorRow,
    cursorCol,
    handleVirtualKeyPress,
    handleBackspace,
    handleNextToCharacter,
    onClose,
  };

  // Tangkap navigasi D-Pad / Analog & Tombol Gamepad saat Keyboard Virtual aktif
  useEffect(() => {
    if (step !== 'identity' || !isGamepadConnected) return;

    const onGamepadKeyboard = (ev: Event) => {
      const gp = (ev as CustomEvent<MenuGamepadCommand>).detail;
      if (!gp) return;

      const {
        cursorRow: r,
        cursorCol: c,
        handleVirtualKeyPress: pressKey,
        handleBackspace: doBackspace,
        handleNextToCharacter: doNext,
        onClose: doClose,
      } = stateHandlerRef.current;

      if (gp.back) {
        doClose();
        return;
      }
      if (gp.start) {
        doNext();
        return;
      }
      if (gp.tutorial) {
        // Tombol X / Square -> Hapus karakter cepat (Backspace)
        doBackspace();
        return;
      }
      if (gp.settings) {
        // Tombol Y / Triangle -> Pindah kolom Nama <-> Kelas
        setActiveField((prev) => (prev === 'name' ? 'class' : 'name'));
        return;
      }

      if (gp.up || gp.down) {
        const totalRows = GAMEPAD_KEYBOARD_ROWS.length;
        const nextRow = (r + (gp.down ? 1 : -1) + totalRows) % totalRows;
        const curLen = GAMEPAD_KEYBOARD_ROWS[r].length;
        const nextLen = GAMEPAD_KEYBOARD_ROWS[nextRow].length;
        const ratio = curLen > 1 ? c / (curLen - 1) : 0;
        const nextCol = Math.min(nextLen - 1, Math.max(0, Math.round(ratio * (nextLen - 1))));
        setCursorRow(nextRow);
        setCursorCol(nextCol);
        return;
      }

      if (gp.left || gp.right) {
        const rowLen = GAMEPAD_KEYBOARD_ROWS[r].length;
        const nextCol = (c + (gp.right ? 1 : -1) + rowLen) % rowLen;
        setCursorCol(nextCol);
        return;
      }

      if (gp.confirm) {
        const key = GAMEPAD_KEYBOARD_ROWS[r]?.[c];
        if (key) pressKey(key);
      }
    };

    window.addEventListener('color-mission:gamepad-keyboard', onGamepadKeyboard);
    return () => {
      window.removeEventListener('color-mission:gamepad-keyboard', onGamepadKeyboard);
    };
  }, [step, isGamepadConnected]);

  const handleFinalStart = () => {
    const trimmedName = studentName.trim();
    recordInitialSessionStartAsync(trimmedName, studentClass.trim() || '-', selectedCharacter);
    onConfirmStart();
  };

  return (
    <div className="fixed inset-0 bg-[#050811]/90 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 z-50 font-sans text-white ui-backdrop-enter">
      {step === 'identity' ? (
        /* ====================================================================
           PAPAN 1: PENGISIAN IDENTITAS PEMAIN (NAMA & KELAS + KEYBOARD GAMEPAD)
           ==================================================================== */
        <div
          data-ui-board="true"
          data-gamepad-keyboard={isGamepadConnected ? 'true' : undefined}
          className={`${
            isGamepadConnected ? 'max-w-lg' : 'max-w-md'
          } w-full max-h-[95dvh] overflow-y-auto bg-[#090d18]/98 border border-white/15 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col gap-3 ui-panel-enter`}
        >
          {/* Header Papan 1 */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-white leading-tight">
                  Identitas Pemain
                </h2>
                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                  Langkah 1 dari 2 · Masukkan nama sebelum bermain
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="p-1.5 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-slate-400 hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Input Identitas */}
          <form onSubmit={handleNextToCharacter} className="flex flex-col gap-2.5">
            <div className={isGamepadConnected ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'flex flex-col gap-3'}>
              <div>
                <label className="text-[11px] font-bold text-slate-200 flex items-center justify-between mb-1">
                  <span>
                    Nama Pemain <span className="text-cyan-400">*</span>
                  </span>
                  {isGamepadConnected && activeField === 'name' && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded">
                      Aktif
                    </span>
                  )}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus={!isGamepadConnected}
                    value={studentName}
                    onFocus={() => setActiveField('name')}
                    onClick={() => setActiveField('name')}
                    onChange={(e) => {
                      setStudentName(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="Ketik nama pemain..."
                    className={`w-full h-9 sm:h-10 pl-9 pr-3 rounded-xl bg-[#060a14] border text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors ${
                      isGamepadConnected && activeField === 'name'
                        ? 'border-cyan-400 ring-1 ring-cyan-400/50'
                        : 'border-white/15 focus:border-cyan-400'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-200 flex items-center justify-between mb-1">
                  <span>
                    Kelas <span className="text-slate-500 font-normal">(Opsional)</span>
                  </span>
                  {isGamepadConnected && activeField === 'class' && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded">
                      Aktif
                    </span>
                  )}
                </label>
                <div className="relative">
                  <GraduationCap className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={studentClass}
                    onFocus={() => setActiveField('class')}
                    onClick={() => setActiveField('class')}
                    onChange={(e) => setStudentClass(e.target.value)}
                    placeholder="contoh: X RPL 1"
                    className={`w-full h-9 sm:h-10 pl-9 pr-3 rounded-xl bg-[#060a14] border text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors ${
                      isGamepadConnected && activeField === 'class'
                        ? 'border-cyan-400 ring-1 ring-cyan-400/50'
                        : 'border-white/15 focus:border-cyan-400'
                    }`}
                  />
                </div>
              </div>
            </div>

            {validationError && (
              <div className="p-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Keyboard Virtual Khusus Gamepad (Muncul otomatis saat Gamepad terhubung di Desktop/Mobile) */}
            {isGamepadConnected && (
              <div className="rounded-2xl bg-[#050914] border border-cyan-400/25 p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-300 px-0.5 pb-1 border-b border-white/8">
                  <span className="flex items-center gap-1.5 text-cyan-300 uppercase tracking-wider">
                    <Gamepad2 className="w-3.5 h-3.5" />
                    Keyboard Gamepad
                  </span>
                  <span className="text-slate-400">
                    Mengetik di: <strong className="text-white">{activeField === 'name' ? 'Nama' : 'Kelas'}</strong>
                  </span>
                </div>

                {GAMEPAD_KEYBOARD_ROWS.map((row, rIdx) => (
                  <div
                    key={rIdx}
                    className={`grid gap-1 ${
                      rIdx === 4
                        ? 'grid-cols-3 pt-0.5'
                        : rIdx === 3
                          ? 'grid-cols-10'
                          : 'grid-cols-10'
                    }`}
                  >
                    {row.map((key, cIdx) => {
                      const isFocused = cursorRow === rIdx && cursorCol === cIdx;
                      const isSpace = key === 'SPASI';
                      const isBackspace = key === 'HAPUS';
                      const isNext = key === 'LANJUT';
                      const isCancel = key === 'BATAL';
                      const isSwitch = key === 'KOLOM';

                      const colSpanClass = isSpace
                        ? 'col-span-2'
                        : isBackspace
                          ? 'col-span-1'
                          : '';

                      return (
                        <button
                          key={`${rIdx}_${key}`}
                          type="button"
                          tabIndex={-1}
                          onClick={() => {
                            setCursorRow(rIdx);
                            setCursorCol(cIdx);
                            handleVirtualKeyPress(key);
                          }}
                          className={`${colSpanClass} h-7 sm:h-8 rounded-lg text-[10px] sm:text-xs font-extrabold uppercase tracking-wide flex items-center justify-center gap-1 transition-all cursor-pointer select-none ${
                            isFocused
                              ? 'bg-cyan-400 text-slate-950 ring-2 ring-white scale-[1.04] shadow-md shadow-cyan-400/30 z-10'
                              : isNext
                                ? 'bg-cyan-500/20 border border-cyan-400/45 text-cyan-200 hover:bg-cyan-500/30'
                                : isCancel
                                  ? 'bg-rose-500/15 border border-rose-400/35 text-rose-200 hover:bg-rose-500/25'
                                  : isSwitch
                                    ? 'bg-indigo-500/20 border border-indigo-400/35 text-indigo-200 hover:bg-indigo-500/30'
                                    : isBackspace
                                      ? 'bg-amber-500/15 border border-amber-400/35 text-amber-200 hover:bg-amber-500/25'
                                      : 'bg-white/7 border border-white/12 text-slate-100 hover:bg-white/15'
                          }`}
                        >
                          {isBackspace ? (
                            <Delete className="w-3.5 h-3.5" />
                          ) : isSwitch ? (
                            <>
                              <span>Ganti Kolom</span>
                              <GamepadBadge button="Y" visible size="sm" />
                            </>
                          ) : isCancel ? (
                            <>
                              <span>Batal</span>
                              <GamepadBadge button="B" visible size="sm" />
                            </>
                          ) : isNext ? (
                            <>
                              <span>Lanjut</span>
                              <GamepadBadge button="START" visible size="sm" />
                            </>
                          ) : (
                            <span>{key}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}

                {/* Panduan Singkat Tombol Gamepad */}
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1 text-[10px] font-semibold text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <GamepadBadge button="A" visible size="sm" /> Ketik
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <GamepadBadge button="X" visible size="sm" /> Hapus
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <GamepadBadge button="Y" visible size="sm" /> Ganti Kolom
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <GamepadBadge button="B" visible size="sm" /> Tutup
                  </span>
                </div>
              </div>
            )}

            {/* Tombol Aksi Papan 1 (Sembunyikan duplikat saat keyboard gamepad sudah menyediakan BATAL/LANJUT) */}
            {!isGamepadConnected && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 rounded-xl bg-white/6 hover:bg-white/12 border border-white/15 text-xs font-bold uppercase tracking-wide text-slate-200 cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  className="h-10 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer shadow-lg transition-all"
                >
                  <span>Pilih Karakter</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </form>
        </div>
      ) : (
        /* ====================================================================
           PAPAN 2: PEMILIHAN KARAKTER (PAS & TANPA SCROLL SAMA SEKALI)
           ==================================================================== */
        <div
          data-ui-board="true"
          className="max-w-xl w-full bg-[#090d18]/98 border border-white/15 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col gap-3 ui-panel-enter"
        >
          {/* Header Papan 2 */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-white leading-tight">
                  Pilih Karakter Agen
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold">
                  {studentName}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Langkah 2 dari 2 · Pilih agen tempur sebelum bertanding
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="p-1.5 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-slate-400 hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2 Kartu Karakter (Tinggi Proporsional Tanpa Perlu Scroll) */}
          <div className="grid grid-cols-2 gap-3">
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
                  className={`group text-left rounded-2xl p-2.5 sm:p-3 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#0e1e3e]/90 border-cyan-400 shadow-md shadow-cyan-500/10'
                      : 'bg-[#0b101e] hover:bg-[#0f172a] border-white/12 hover:border-white/25'
                  }`}
                >
                  {/* Gambar Karakter */}
                  <div className="relative w-full h-32 sm:h-40 md:h-44 rounded-xl overflow-hidden bg-[#050811] border border-white/10 p-1 flex items-center justify-center">
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
                        className="w-full h-full object-contain object-center transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                      />
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-xl border flex items-center justify-center ${
                          isRaka
                            ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300'
                            : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                        }`}
                      >
                        {isRaka ? (
                          <Shield className="w-6 h-6" />
                        ) : (
                          <Heart className="w-6 h-6" />
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
                  <div className="mt-2">
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-white">
                      {profile.name}
                    </h3>
                    <div className="mt-1 px-2 py-1 rounded-lg bg-[#060913] border border-white/10 flex items-center justify-between gap-1 text-[10px] sm:text-[11px] font-semibold">
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
          <div className="flex items-center gap-2 pt-2 border-t border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => setStep('identity')}
              className="px-4 h-10 rounded-xl bg-white/6 hover:bg-white/12 border border-white/15 text-xs font-bold uppercase tracking-wide text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali</span>
            </button>

            <button
              type="button"
              onClick={handleFinalStart}
              data-start="true"
              className="flex-1 h-10 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current text-slate-950" />
              <span>MULAI MISI</span>
              {isGamepadConnected && <GamepadBadge button="A" visible size="sm" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
