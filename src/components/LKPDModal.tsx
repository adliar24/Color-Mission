import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  User,
  FlaskConical,
  HelpCircle,
  MessageSquareText,
  Award,
  CheckCircle2,
  XCircle,
  Download,
  Printer,
  Copy,
  Check,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Lightbulb,
} from 'lucide-react';
import { ALL_RYB_COLORS, getColorDef } from '../game/colors';
import {
  DEFAULT_LKPD_SUBMISSION,
  GameCompletionProgress,
  LKPD_LAB_CHALLENGES,
  LKPD_LAB_INGREDIENTS,
  LKPD_QUIZ_QUESTIONS,
  LKPD_REFLECTION_PROMPTS,
  LKPDSubmissionState,
  calculateLKPDScore,
  exportLKPDCardAsPNG,
  formatLKPDSummaryText,
  getQuizColorPreview,
  loadLKPDSubmission,
  mixRYBColors,
  saveLKPDSubmission,
} from '../game/lkpd';
import { RYBColorDef, RYBColorId } from '../game/types';

interface LKPDModalProps {
  progress: GameCompletionProgress;
  onClose: () => void;
}

type LKPDTabId = 'identitas' | 'lab' | 'kuis' | 'refleksi' | 'hasil';

const TABS: { id: LKPDTabId; label: string; shortLabel: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'identitas', label: '1. Identitas', shortLabel: 'Identitas', icon: User },
  { id: 'lab', label: '2. Lab Warna', shortLabel: 'Lab', icon: FlaskConical },
  { id: 'kuis', label: '3. Kuis RYB', shortLabel: 'Kuis', icon: HelpCircle },
  { id: 'refleksi', label: '4. Refleksi', shortLabel: 'Refleksi', icon: MessageSquareText },
  { id: 'hasil', label: '5. Rekap & Ekspor', shortLabel: 'Ekspor', icon: Award },
];

export const LKPDModal: React.FC<LKPDModalProps> = ({ progress, onClose }) => {
  const [activeTab, setActiveTab] = useState<LKPDTabId>('identitas');
  const [submission, setSubmission] = useState<LKPDSubmissionState>(() => loadLKPDSubmission());

  // State khusus Lab Campur Warna
  const [activeChallengeIdx, setActiveChallengeIdx] = useState<number>(0);
  const [slotA, setSlotA] = useState<RYBColorId | null>('red');
  const [slotB, setSlotB] = useState<RYBColorId | null>('yellow');
  const [activeSlotPicker, setActiveSlotPicker] = useState<'A' | 'B'>('A');
  const [mixResult, setMixResult] = useState<{
    mixed: RYBColorDef | null;
    matchedChallenge: boolean;
    message: string;
  } | null>(null);
  const [showLabHint, setShowLabHint] = useState<boolean>(false);

  // State umpan balik tombol ekspor & ulasan akhir
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [pngExportedMsg, setPngExportedMsg] = useState<string | null>(null);
  const [showQuizReview, setShowQuizReview] = useState<boolean>(false);

  useEffect(() => {
    saveLKPDSubmission(submission);
  }, [submission]);

  const scoreBreakdown = useMemo(() => calculateLKPDScore(submission), [submission]);
  const activeChallenge = LKPD_LAB_CHALLENGES[activeChallengeIdx] || LKPD_LAB_CHALLENGES[0];
  const targetColorDef = getColorDef(activeChallenge.targetColorId);

  const handleSelectIngredient = (colorId: RYBColorId) => {
    if (activeSlotPicker === 'A') {
      setSlotA(colorId);
      setActiveSlotPicker('B');
    } else {
      setSlotB(colorId);
      setActiveSlotPicker('A');
    }
    setMixResult(null);
  };

  const handleMixColors = () => {
    if (!slotA || !slotB) {
      setMixResult({
        mixed: null,
        matchedChallenge: false,
        message: 'Pilih dua warna bahan terlebih dahulu pada Wadah 1 dan Wadah 2.',
      });
      return;
    }

    const result = mixRYBColors(slotA, slotB);
    if (!result) {
      setMixResult({
        mixed: null,
        matchedChallenge: false,
        message: `${getColorDef(slotA).nameId} + ${getColorDef(slotB).nameId} tidak menghasilkan warna standar Sekunder/Tersier pada tantangan ini. Coba kombinasi lain.`,
      });
      return;
    }

    const isMatch = result.id === activeChallenge.targetColorId;
    if (isMatch) {
      setSubmission((prev) => {
        if (prev.labSolvedIds.includes(activeChallenge.targetColorId)) return prev;
        return {
          ...prev,
          labSolvedIds: [...prev.labSolvedIds, activeChallenge.targetColorId],
        };
      });
      setMixResult({
        mixed: result,
        matchedChallenge: true,
        message: `Tepat sekali! ${getColorDef(slotA).nameId} + ${getColorDef(slotB).nameId} = ${result.nameId} (${result.categoryLabelId}). Tantangan ini selesai.`,
      });
    } else {
      setMixResult({
        mixed: result,
        matchedChallenge: false,
        message: `Hasil campuran adalah ${result.nameId} (${result.categoryLabelId}), namun target misi saat ini adalah ${targetColorDef.nameId}.`,
      });
    }
  };

  const handleSelectQuizOption = (questionId: string, optionId: string) => {
    setSubmission((prev) => ({
      ...prev,
      quizAnswers: {
        ...prev.quizAnswers,
        [questionId]: optionId,
      },
    }));
  };

  const handleOpenTab = (tabId: LKPDTabId) => {
    if (tabId === 'hasil') {
      setSubmission((prev) => ({
        ...prev,
        quizChecked: true,
        completedAt: prev.completedAt || new Date().toISOString(),
      }));
    }
    setActiveTab(tabId);
  };

  const handleCopySummary = async () => {
    const text = formatLKPDSummaryText(submission, progress);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {}
  };

  const handleExportPNG = () => {
    const stamped = submission.completedAt
      ? submission
      : { ...submission, completedAt: new Date().toISOString() };
    if (!submission.completedAt) {
      setSubmission(stamped);
    }
    const ok = exportLKPDCardAsPNG(stamped, progress);
    if (ok) {
      setPngExportedMsg('Kartu Bukti Nilai (.PNG) berhasil diunduh.');
      setTimeout(() => setPngExportedMsg(null), 3200);
    }
  };

  const handlePrintPDF = () => {
    if (!submission.completedAt) {
      setSubmission((prev) => ({
        ...prev,
        completedAt: new Date().toISOString(),
      }));
    }
    setTimeout(() => {
      window.print();
    }, 60);
  };

  const goAdjacentTab = (delta: -1 | 1) => {
    const idx = TABS.findIndex((t) => t.id === activeTab);
    const nextIdx = Math.max(0, Math.min(TABS.length - 1, idx + delta));
    handleOpenTab(TABS[nextIdx].id);
  };

  return (
    <div
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      className="fixed inset-0 bg-[#04070f]/90 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-5 z-50 font-sans text-white ui-backdrop-enter lkpd-modal-overlay"
    >
      {/* Panel Interaktif Utama — Skema 60% Hitam/Gelap, 30% Biru, 10% Putih Kontras */}
      <div
        data-ui-board="true"
        className="max-w-4xl w-full max-h-[92dvh] bg-[#080c16] text-white border border-blue-500/25 rounded-3xl shadow-2xl flex flex-col overflow-hidden ui-panel-enter lkpd-interactive-shell"
      >
        {/* Header (60% Hitam + 30% Biru Aksen + 10% Putih Badge Nilai) */}
        <div className="px-5 sm:px-6 py-4 bg-[#060912] border-b border-blue-500/20 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#EF233C] border border-white/85" />
              <span className="w-3.5 h-3.5 rounded-sm bg-[#FFD60A] border border-white/85" />
              <span className="w-3.5 h-3.5 rounded-sm bg-[#1D6FFF] border border-white/85" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black tracking-tight uppercase text-white truncate">
                LKPD EVALUASI INTERAKTIF
              </h2>
              <p className="text-xs sm:text-sm font-medium text-blue-400 truncate">
                COLOR MISSION · Teori Pencampuran Warna RYB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {activeTab === 'hasil' ? (
              <div className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-slate-950 text-xs sm:text-sm font-black shadow-sm">
                <span>Nilai:</span>
                <span className="tabular-nums text-blue-700">{scoreBreakdown.objectiveScore}/100</span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0b152a] border border-blue-500/30 text-blue-200 text-xs sm:text-sm font-bold">
                <span>Bagian</span>
                <span className="tabular-nums text-white font-black">
                  {TABS.findIndex((t) => t.id === activeTab) + 1}/{TABS.length}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup LKPD"
              className="p-2 rounded-xl bg-blue-950/60 hover:bg-blue-900/70 border border-blue-500/25 text-white cursor-pointer flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigasi Tab (30% Biru Struktural) */}
        <div className="px-4 sm:px-6 py-3 border-b border-blue-500/20 bg-[#0b152a] flex items-center gap-2 overflow-x-auto shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleOpenTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-wide flex items-center gap-2 whitespace-nowrap cursor-pointer border transition-colors ${
                  active
                    ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                    : 'bg-[#080d1a] hover:bg-blue-950/80 text-slate-200 border-blue-500/20'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Konten Scrollable (60% Hitam) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-7 space-y-6 bg-[#080c16]">
          {/* ==============================================================
              TAB 1: IDENTITAS PESERTA DIDIK & CAPAIAN GAME
             ============================================================== */}
          {activeTab === 'identitas' && (
            <div className="space-y-5">
              {/* Banner Biru 30% + Kartu Statistik Putih 10% */}
              <div className="bg-[#0e1e3e] border border-blue-500/35 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-blue-300 block">
                    MISI GAME SELESAI · LKPD TERBUKA
                  </span>
                  <p className="text-sm sm:text-base text-slate-100 mt-1 leading-relaxed">
                    Lengkapi data dirimu, lalu kerjakan Laboratorium Warna, Kuis, dan Refleksi secara berurutan.
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0 bg-white text-slate-950 px-4 py-2.5 rounded-xl shadow-sm">
                  <div className="text-center">
                    <span className="text-[11px] text-slate-500 font-bold block uppercase">Skor Game</span>
                    <span className="text-base font-black text-blue-700 tabular-nums">
                      {progress.bestScore.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-slate-200" />
                  <div className="text-center">
                    <span className="text-[11px] text-slate-500 font-bold block uppercase">Akurasi</span>
                    <span className="text-base font-black text-slate-950 tabular-nums">
                      {progress.lastAccuracy}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs sm:text-sm font-bold text-slate-200 block mb-1.5">
                    Nama Lengkap Siswa *
                  </span>
                  <input
                    type="text"
                    value={submission.studentName}
                    onChange={(e) =>
                      setSubmission((prev) => ({ ...prev, studentName: e.target.value }))
                    }
                    placeholder="Contoh: Nadia Putri Pratama"
                    className="w-full px-4 py-3 rounded-xl bg-[#0d1424] border border-blue-500/30 focus:border-blue-400 focus:outline-none text-sm sm:text-base font-medium text-white placeholder:text-slate-500"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs sm:text-sm font-bold text-slate-200 block mb-1.5">
                      Kelas *
                    </span>
                    <input
                      type="text"
                      value={submission.studentClass}
                      onChange={(e) =>
                        setSubmission((prev) => ({ ...prev, studentClass: e.target.value }))
                      }
                      placeholder="Contoh: X-4"
                      className="w-full px-4 py-3 rounded-xl bg-[#0d1424] border border-blue-500/30 focus:border-blue-400 focus:outline-none text-sm sm:text-base font-medium text-white placeholder:text-slate-500"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs sm:text-sm font-bold text-slate-200 block mb-1.5">
                      No. Absen
                    </span>
                    <input
                      type="text"
                      value={submission.studentAbsent}
                      onChange={(e) =>
                        setSubmission((prev) => ({ ...prev, studentAbsent: e.target.value }))
                      }
                      placeholder="Contoh: 17"
                      className="w-full px-4 py-3 rounded-xl bg-[#0d1424] border border-blue-500/30 focus:border-blue-400 focus:outline-none text-sm sm:text-base font-medium text-white placeholder:text-slate-500"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs sm:text-sm font-bold text-slate-200 block mb-1.5">
                    Satuan Pendidikan
                  </span>
                  <input
                    type="text"
                    value={submission.schoolName}
                    onChange={(e) =>
                      setSubmission((prev) => ({ ...prev, schoolName: e.target.value }))
                    }
                    className="w-full px-4 py-3 rounded-xl bg-[#0d1424] border border-blue-500/30 focus:border-blue-400 focus:outline-none text-sm sm:text-base font-medium text-white"
                  />
                </label>

                <label className="block">
                  <span className="text-xs sm:text-sm font-bold text-slate-200 block mb-1.5">
                    Guru Pengampu
                  </span>
                  <input
                    type="text"
                    value={submission.teacherName}
                    onChange={(e) =>
                      setSubmission((prev) => ({ ...prev, teacherName: e.target.value }))
                    }
                    className="w-full px-4 py-3 rounded-xl bg-[#0d1424] border border-blue-500/30 focus:border-blue-400 focus:outline-none text-sm sm:text-base font-medium text-white"
                  />
                </label>
              </div>

              <div className="bg-[#0d1424] border border-blue-500/25 rounded-2xl p-4 sm:p-5 space-y-2">
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-blue-400 block">
                  Tujuan Pembelajaran
                </span>
                <ul className="text-sm sm:text-base text-slate-200 space-y-1.5 list-disc pl-5 leading-relaxed">
                  <li>Mengelompokkan warna Primer, Sekunder, dan Tersier pada sistem pigmen RYB.</li>
                  <li>Membuktikan hasil pencampuran warna melalui eksperimen di Laboratorium Warna.</li>
                  <li>Menyimpulkan strategi penentuan warna pada Stage 1–3 &amp; Boss CHROMA TITAN.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 2: LABORATORIUM CAMPUR WARNA INTERAKTIF (5 MISI)
             ============================================================== */}
          {activeTab === 'lab' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {LKPD_LAB_CHALLENGES.map((ch, idx) => {
                    const solved = submission.labSolvedIds.includes(ch.targetColorId);
                    const selected = idx === activeChallengeIdx;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => {
                          setActiveChallengeIdx(idx);
                          setMixResult(null);
                          setShowLabHint(false);
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 border cursor-pointer transition-colors ${
                          selected
                            ? 'bg-white text-slate-950 border-white font-extrabold shadow-sm'
                            : solved
                            ? 'bg-[#0e1e3e] text-blue-200 border-blue-500/45'
                            : 'bg-[#0d1424] text-slate-300 border-slate-700 hover:border-blue-500/40'
                        }`}
                      >
                        {solved && (
                          <CheckCircle2
                            className={`w-4 h-4 ${selected ? 'text-blue-700' : 'text-blue-300'}`}
                          />
                        )}
                        <span>Misi {idx + 1}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="text-sm font-extrabold text-white tabular-nums">
                  Selesai: <span className="text-blue-400">{scoreBreakdown.labCorrect}/{scoreBreakdown.labTotal}</span>
                </span>
              </div>

              {/* Instruksi Target Tantangan */}
              <div className="bg-[#0e1e3e] border border-blue-500/35 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-blue-300">
                      TARGET EKSPERIMEN #{activeChallengeIdx + 1} · {targetColorDef.categoryLabelId}
                    </span>
                    {submission.labSolvedIds.includes(activeChallenge.targetColorId) && (
                      <span className="px-2.5 py-0.5 rounded-full bg-white text-slate-950 text-xs font-extrabold">
                        Selesai
                      </span>
                    )}
                  </div>
                  <p className="text-base font-bold text-white leading-snug">
                    {activeChallenge.prompt}
                  </p>
                  {showLabHint && (
                    <p className="text-sm text-slate-100 bg-[#080d1a] border border-blue-400/35 rounded-xl px-3.5 py-2 mt-2">
                      <strong className="text-blue-300">Petunjuk:</strong> {activeChallenge.hint}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex flex-col items-center bg-white text-slate-950 px-3 py-2 rounded-xl shadow-sm">
                    <div
                      className="w-12 h-12 rounded-xl border-2 border-slate-900/15"
                      style={{ backgroundColor: targetColorDef.hex }}
                    />
                    <span className="text-xs font-extrabold mt-1.5">
                      {targetColorDef.nameId}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLabHint((v) => !v)}
                    className="p-2.5 rounded-xl bg-[#080d1a] hover:bg-blue-950 border border-blue-400/35 text-blue-300 cursor-pointer"
                    title="Lihat Petunjuk"
                  >
                    <Lightbulb className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Meja Campur Interaktif (60% Hitam + 30% Biru + 10% Putih) */}
              <div className="bg-[#0d1424] border border-blue-500/25 rounded-2xl p-4 sm:p-5 space-y-5">
                <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 sm:gap-4 text-center">
                  {/* Wadah 1 */}
                  <button
                    type="button"
                    onClick={() => setActiveSlotPicker('A')}
                    className={`p-3.5 rounded-2xl border-2 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                      activeSlotPicker === 'A'
                        ? 'border-blue-400 bg-blue-600/20 text-white'
                        : 'border-slate-700 bg-[#080c16] text-slate-200 hover:border-blue-500/40'
                    }`}
                  >
                    <span className="text-xs font-extrabold uppercase text-blue-300">
                      Wadah 1
                    </span>
                    <div
                      className="w-12 h-12 rounded-xl border-2 border-white/90 shadow-sm"
                      style={{ backgroundColor: slotA ? getColorDef(slotA).hex : '#1e293b' }}
                    />
                    <span className="text-sm font-bold text-white">
                      {slotA ? getColorDef(slotA).nameId : 'Pilih'}
                    </span>
                  </button>

                  <span className="text-2xl font-black text-blue-400">+</span>

                  {/* Wadah 2 */}
                  <button
                    type="button"
                    onClick={() => setActiveSlotPicker('B')}
                    className={`p-3.5 rounded-2xl border-2 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                      activeSlotPicker === 'B'
                        ? 'border-blue-400 bg-blue-600/20 text-white'
                        : 'border-slate-700 bg-[#080c16] text-slate-200 hover:border-blue-500/40'
                    }`}
                  >
                    <span className="text-xs font-extrabold uppercase text-blue-300">
                      Wadah 2
                    </span>
                    <div
                      className="w-12 h-12 rounded-xl border-2 border-white/90 shadow-sm"
                      style={{ backgroundColor: slotB ? getColorDef(slotB).hex : '#1e293b' }}
                    />
                    <span className="text-sm font-bold text-white">
                      {slotB ? getColorDef(slotB).nameId : 'Pilih'}
                    </span>
                  </button>

                  <span className="text-2xl font-black text-blue-400">=</span>

                  {/* Hasil Campuran */}
                  <div className="p-3.5 rounded-2xl border border-slate-700 bg-[#080c16] flex flex-col items-center gap-2">
                    <span className="text-xs font-extrabold uppercase text-slate-300">Hasil</span>
                    <div
                      className="w-12 h-12 rounded-xl border-2 border-white/90 flex items-center justify-center"
                      style={{
                        backgroundColor: mixResult?.mixed ? mixResult.mixed.hex : '#0f172a',
                      }}
                    >
                      {!mixResult?.mixed && <span className="text-base font-black text-slate-400">?</span>}
                    </div>
                    <span className="text-sm font-bold text-white">
                      {mixResult?.mixed ? mixResult.mixed.nameId : 'Belum Ada'}
                    </span>
                  </div>
                </div>

                {/* Palet Bahan Warna */}
                <div>
                  <span className="text-xs sm:text-sm font-semibold text-slate-200 block mb-2.5">
                    Pilih warna untuk mengisi{' '}
                    <span className="text-blue-400 font-extrabold">
                      {activeSlotPicker === 'A' ? 'Wadah 1' : 'Wadah 2'}
                    </span>
                    :
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                    {LKPD_LAB_INGREDIENTS.map((cid) => {
                      const def = getColorDef(cid);
                      return (
                        <button
                          key={cid}
                          type="button"
                          onClick={() => handleSelectIngredient(cid)}
                          className="p-2.5 rounded-xl bg-[#080c16] hover:bg-blue-950/70 text-white border border-blue-500/25 flex flex-col items-center gap-1.5 cursor-pointer"
                        >
                          <span
                            className="w-9 h-9 rounded-lg border-2 border-white/85 shadow-sm"
                            style={{ backgroundColor: def.hex }}
                          />
                          <span className="text-xs sm:text-sm font-bold text-slate-100">{def.nameId}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleMixColors}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm sm:text-base uppercase tracking-wide rounded-xl flex items-center justify-center cursor-pointer shadow-md"
                >
                  CAMPURKAN WARNA SEKARANG
                </button>

                {mixResult && (
                  <div
                    className={`p-3.5 rounded-xl border text-sm font-semibold flex items-start gap-3 ${
                      mixResult.matchedChallenge
                        ? 'bg-[#0e1e3e] text-white border-blue-400/60'
                        : 'bg-[#080c16] text-slate-100 border-blue-500/35'
                    }`}
                  >
                    {mixResult.matchedChallenge ? (
                      <CheckCircle2 className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
                    ) : (
                      <FlaskConical className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="leading-relaxed">{mixResult.message}</p>
                      {mixResult.matchedChallenge && activeChallengeIdx < LKPD_LAB_CHALLENGES.length - 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveChallengeIdx((i) => Math.min(LKPD_LAB_CHALLENGES.length - 1, i + 1));
                            setMixResult(null);
                            setShowLabHint(false);
                          }}
                          className="mt-2.5 px-4 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-950 text-xs sm:text-sm font-extrabold cursor-pointer shadow-sm"
                        >
                          Lanjut ke Misi {activeChallengeIdx + 2} →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 3: KUIS UJI PEMAHAMAN RODA WARNA (6 SOAL)
             ============================================================== */}
          {activeTab === 'kuis' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0e1e3e] border border-blue-500/35 rounded-2xl p-4 sm:p-5">
                <div>
                  <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-blue-300 block">
                    UJI PEMAHAMAN TEORI WARNA RYB (6 SOAL)
                  </span>
                  <p className="text-sm text-slate-200 mt-0.5">
                    Pilih jawaban paling tepat untuk setiap soal. Nilai dan pembahasan akan tampil di bagian Rekap Akhir.
                  </p>
                </div>
                <span className="px-3.5 py-1.5 rounded-xl bg-white text-slate-950 text-xs sm:text-sm font-black tabular-nums">
                  Terjawab:{' '}
                  {LKPD_QUIZ_QUESTIONS.filter((q) => Boolean(submission.quizAnswers[q.id])).length}/
                  {LKPD_QUIZ_QUESTIONS.length}
                </span>
              </div>

              <div className="space-y-4">
                {LKPD_QUIZ_QUESTIONS.map((q, qIdx) => {
                  const chosen = submission.quizAnswers[q.id];
                  const useSingleColumn = q.options.some((opt) => opt.label.length > 30);

                  return (
                    <div
                      key={q.id}
                      className="bg-[#0d1424] border border-blue-500/25 rounded-2xl p-4 sm:p-5 space-y-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm sm:text-base font-bold text-white leading-relaxed">
                          <span className="text-blue-400 font-black mr-2">#{qIdx + 1}</span>
                          {q.question}
                        </p>
                        <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-lg bg-[#080c16] border border-blue-500/25 text-blue-300 shrink-0">
                          {q.type === 'match_ingredients' ? 'Cocokkan' : 'Pilihan Ganda'}
                        </span>
                      </div>

                      {q.previewColorIds && q.previewColorIds.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          {q.previewColorIds.map((cid) => {
                            const info = getQuizColorPreview(cid);
                            return (
                              <div
                                key={cid}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white text-slate-950"
                              >
                                <span
                                  className="w-4 h-4 rounded-sm border border-slate-400"
                                  style={{ backgroundColor: info.hex }}
                                />
                                <span className="text-xs sm:text-sm font-extrabold">
                                  {info.nameId}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div
                        className={`grid gap-2.5 ${
                          useSingleColumn ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
                        }`}
                      >
                        {q.options.map((opt) => {
                          const isSelected = chosen === opt.id;
                          const styleCls = isSelected
                            ? 'bg-blue-600 border-blue-400 text-white shadow-sm'
                            : 'bg-[#080c16] hover:bg-blue-950/60 border-slate-700 text-slate-100';
                          const badgeCls = isSelected
                            ? 'bg-white border-white text-blue-700'
                            : 'bg-[#0e1e3e] border-blue-500/35 text-blue-200';

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleSelectQuizOption(q.id, opt.id)}
                              className={`px-4 py-3 rounded-xl border text-left flex items-center justify-between gap-3 cursor-pointer text-sm sm:text-[15px] font-semibold transition-colors ${styleCls}`}
                            >
                              <div className="flex items-start sm:items-center gap-3 min-w-0">
                                <span
                                  className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs font-black uppercase shrink-0 ${badgeCls}`}
                                >
                                  {opt.id}
                                </span>
                                <span className="whitespace-normal break-words leading-snug">
                                  {opt.label}
                                </span>
                              </div>

                              {opt.swatchHexes && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {opt.swatchHexes.map((hex, sIdx) => (
                                    <span
                                      key={sIdx}
                                      className="w-5 h-5 rounded-md border-2 border-white/85"
                                      style={{ backgroundColor: hex }}
                                    />
                                  ))}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 4: ANALISIS & REFLEKSI SISWA (3 PERTANYAAN ESAI)
             ============================================================== */}
          {activeTab === 'refleksi' && (
            <div className="space-y-4">
              <div className="bg-[#0e1e3e] border border-blue-500/35 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-blue-300 block">
                    ANALISIS &amp; REFLEKSI PESERTA DIDIK
                  </span>
                  <p className="text-sm text-slate-200 mt-0.5">
                    Tuliskan jawaban dengan kalimatmu sendiri berdasarkan pengalaman menamatkan Stage 1–3.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-white text-slate-950 text-xs sm:text-sm font-black shrink-0 tabular-nums">
                  {scoreBreakdown.reflectionAnswered}/{scoreBreakdown.reflectionTotal}
                </span>
              </div>

              {LKPD_REFLECTION_PROMPTS.map((prompt) => {
                const val = submission.reflectionAnswers[prompt.id] || '';
                return (
                  <div
                    key={prompt.id}
                    className="bg-[#0d1424] border border-blue-500/25 rounded-2xl p-4 sm:p-5 space-y-2.5"
                  >
                    <label className="text-sm sm:text-base font-bold text-white block leading-relaxed">
                      {prompt.question}
                    </label>
                    <textarea
                      rows={3}
                      value={val}
                      onChange={(e) =>
                        setSubmission((prev) => ({
                          ...prev,
                          reflectionAnswers: {
                            ...prev.reflectionAnswers,
                            [prompt.id]: e.target.value,
                          },
                        }))
                      }
                      placeholder={prompt.placeholder}
                      className="w-full px-4 py-3 rounded-xl bg-[#080c16] border border-blue-500/30 focus:border-blue-400 focus:outline-none text-sm sm:text-base text-white placeholder:text-slate-500 resize-y leading-relaxed"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* ==============================================================
              TAB 5: REKAP NILAI & EKSPOR BUKTI KE GURU
             ============================================================== */}
          {activeTab === 'hasil' && (
            <div className="space-y-5">
              {/* Ringkasan Nilai Utama (Biru 30% + Kartu Nilai Putih 10%) */}
              <div className="bg-[#0e1e3e] border border-blue-500/35 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-blue-300 block">
                    HASIL EVALUASI AKHIR SISWA
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                    {submission.studentName.trim() || 'Nama Siswa Belum Diisi'}
                  </h3>
                  <p className="text-sm text-slate-200 mt-1">
                    Kelas: <strong className="text-white">{submission.studentClass.trim() || '-'}</strong> · Absen:{' '}
                    <strong className="text-white">{submission.studentAbsent.trim() || '-'}</strong> ·{' '}
                    {submission.schoolName}
                  </p>
                </div>

                <div className="bg-white text-slate-950 rounded-2xl px-6 py-3.5 text-center shrink-0 shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    NILAI OBJEKTIF
                  </span>
                  <span className="text-3xl font-black text-blue-700 tabular-nums">
                    {scoreBreakdown.objectiveScore}
                    <span className="text-base text-slate-400">/100</span>
                  </span>
                  <span className="block text-xs font-extrabold text-slate-900 mt-0.5">
                    {scoreBreakdown.predicate}
                  </span>
                </div>
              </div>

              {/* Detail Komponen Skor */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#0d1424] border border-blue-500/25 rounded-2xl p-3.5 text-center">
                  <span className="text-xs font-bold uppercase text-slate-400 block">
                    Lab Warna
                  </span>
                  <span className="text-xl font-black text-blue-400 tabular-nums mt-0.5 block">
                    {scoreBreakdown.labCorrect}/{scoreBreakdown.labTotal}
                  </span>
                </div>
                <div className="bg-[#0d1424] border border-blue-500/25 rounded-2xl p-3.5 text-center">
                  <span className="text-xs font-bold uppercase text-slate-400 block">
                    Kuis RYB
                  </span>
                  <span className="text-xl font-black text-blue-400 tabular-nums mt-0.5 block">
                    {scoreBreakdown.quizCorrect}/{scoreBreakdown.quizTotal}
                  </span>
                </div>
                <div className="bg-[#0d1424] border border-blue-500/25 rounded-2xl p-3.5 text-center">
                  <span className="text-xs font-bold uppercase text-slate-400 block">
                    Refleksi Esai
                  </span>
                  <span className="text-xl font-black text-white tabular-nums mt-0.5 block">
                    {scoreBreakdown.reflectionAnswered}/{scoreBreakdown.reflectionTotal}
                  </span>
                </div>
                <div className="bg-[#0d1424] border border-blue-500/25 rounded-2xl p-3.5 text-center">
                  <span className="text-xs font-bold uppercase text-slate-400 block">
                    Skor Game
                  </span>
                  <span className="text-xl font-black text-white tabular-nums mt-0.5 block">
                    {progress.bestScore.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Ulasan Pembahasan Kuis di Bagian Akhir */}
              <div className="bg-[#0d1424] border border-blue-500/25 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">
                    Pembahasan Jawaban Kuis
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowQuizReview((v) => !v)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0e1e3e] hover:bg-blue-600 border border-blue-500/35 text-xs sm:text-sm font-bold text-white cursor-pointer transition-colors"
                  >
                    {showQuizReview ? 'Sembunyikan Pembahasan' : 'Lihat Pembahasan'}
                  </button>
                </div>

                {showQuizReview && (
                  <div className="space-y-2.5 pt-2 border-t border-blue-500/20">
                    {LKPD_QUIZ_QUESTIONS.map((q, qIdx) => {
                      const chosen = submission.quizAnswers[q.id];
                      const isCorrect = chosen === q.correctOptionId;
                      return (
                        <div
                          key={q.id}
                          className={`p-3.5 rounded-xl text-sm flex items-start gap-2.5 border ${
                            isCorrect
                              ? 'bg-[#0e1e3e] border-blue-400/50 text-white'
                              : 'bg-[#080c16] border-rose-400/45 text-rose-100'
                          }`}
                        >
                          {isCorrect ? (
                            <CheckCircle2 className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-1 leading-relaxed">
                            <p className="font-bold text-white">
                              #{qIdx + 1}. {q.question}
                            </p>
                            <p className="text-slate-200">
                              <strong>{isCorrect ? 'Benar.' : 'Kurang tepat.'}</strong> {q.explanation}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 12 Kotak Warna RYB */}
              <div className="bg-[#0d1424] border border-blue-500/25 rounded-2xl p-4">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200 block mb-2.5">
                  12 Warna Roda RYB yang Telah Dikuasai
                </span>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
                  {ALL_RYB_COLORS.map((c) => (
                    <div
                      key={c.id}
                      className="w-full aspect-square rounded-lg border-2 border-white/85"
                      style={{ backgroundColor: c.hex }}
                      title={c.nameId}
                    />
                  ))}
                </div>
              </div>

              {/* Tombol Ekspor Bukti (Biru + Putih + Hitam Kontras) */}
              <div className="space-y-3">
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-blue-300 block">
                  Unduh / Kumpulkan Bukti Pengerjaan ke Guru
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={handleExportPNG}
                    className="h-12 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Simpan Kartu PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintPDF}
                    className="h-12 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Printer className="w-4 h-4 text-blue-700" />
                    <span>Cetak / Simpan PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="h-12 px-4 rounded-xl bg-[#0d1424] hover:bg-blue-950/70 border border-blue-500/35 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {copiedSummary ? (
                      <>
                        <Check className="w-4 h-4 text-blue-300" />
                        <span className="text-blue-200">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-blue-400" />
                        <span>Salin Ringkasan</span>
                      </>
                    )}
                  </button>
                </div>

                {pngExportedMsg && (
                  <p className="text-sm font-semibold text-slate-950 bg-white rounded-xl px-4 py-2.5">
                    {pngExportedMsg}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-blue-500/20 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSubmission({ ...DEFAULT_LKPD_SUBMISSION });
                    setMixResult(null);
                    setShowQuizReview(false);
                    setActiveChallengeIdx(0);
                    setActiveTab('identitas');
                  }}
                  className="text-xs sm:text-sm font-bold text-slate-400 hover:text-rose-400 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Isian LKPD</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigasi Antar Tab */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-blue-500/20 bg-[#060912] flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => goAdjacentTab(-1)}
            disabled={activeTab === 'identitas'}
            className="px-4 py-2.5 rounded-xl bg-[#0d1424] hover:bg-blue-950/70 disabled:opacity-35 disabled:cursor-not-allowed border border-blue-500/30 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Sebelumnya</span>
          </button>

          <span className="text-xs sm:text-sm font-medium text-slate-300 hidden sm:inline">
            Guru: {submission.teacherName} · {submission.schoolName}
          </span>

          {activeTab !== 'hasil' ? (
            <button
              type="button"
              onClick={() => goAdjacentTab(1)}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span>Lanjut</span>
              <ChevronRight className="w-4 h-4 text-blue-700" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs sm:text-sm font-extrabold cursor-pointer"
            >
              Selesai &amp; Tutup
            </button>
          )}
        </div>
      </div>

      {/* ====================================================================
          LEMBAR CETAK PDF BERSIH (HANYA MUNCUL SAAT WINDOW.PRINT)
         ==================================================================== */}
      <div className="hidden lkpd-print-sheet bg-white text-slate-900 p-8 font-sans">
        <div className="border-b-2 border-slate-900 pb-4 mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-600">
            LEMBAR KERJA PESERTA DIDIK (LKPD) · EVALUASI AKHIR GAME EDUKASI
          </p>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-950 mt-1">
            COLOR MISSION — TEORI WARNA PIGMEN RYB
          </h1>
          <p className="text-sm text-slate-700 mt-1">
            {submission.schoolName} · Guru Pengampu: {submission.teacherName}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 border border-slate-300 rounded-xl p-4 mb-5 text-sm">
          <div>
            <strong>Nama Lengkap:</strong> {submission.studentName || '-'}
          </div>
          <div>
            <strong>Kelas / Absen:</strong> {submission.studentClass || '-'} /{' '}
            {submission.studentAbsent || '-'}
          </div>
          <div>
            <strong>Status Game:</strong> Misi Stage 1–3 &amp; Boss CHROMA TITAN Selesai
          </div>
          <div>
            <strong>Skor Game Terbaik:</strong> {progress.bestScore.toLocaleString('id-ID')} (Akurasi{' '}
            {progress.lastAccuracy}%)
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6 text-center">
          <div className="border border-slate-300 rounded-xl p-3">
            <span className="text-xs uppercase font-bold text-slate-500 block">Lab Campur Warna</span>
            <strong className="text-xl">
              {scoreBreakdown.labCorrect}/{scoreBreakdown.labTotal}
            </strong>
          </div>
          <div className="border border-slate-300 rounded-xl p-3">
            <span className="text-xs uppercase font-bold text-slate-500 block">Kuis Teori Warna</span>
            <strong className="text-xl">
              {scoreBreakdown.quizCorrect}/{scoreBreakdown.quizTotal}
            </strong>
          </div>
          <div className="border border-slate-300 rounded-xl p-3">
            <span className="text-xs uppercase font-bold text-slate-500 block">Nilai Objektif</span>
            <strong className="text-xl">
              {scoreBreakdown.objectiveScore}/100 ({scoreBreakdown.predicate})
            </strong>
          </div>
        </div>

        <h2 className="text-base font-black uppercase mb-3 border-b border-slate-300 pb-1">
          Jawaban Analisis &amp; Refleksi Siswa
        </h2>
        <div className="space-y-4 text-sm">
          {LKPD_REFLECTION_PROMPTS.map((p) => (
            <div key={p.id} className="border border-slate-300 rounded-xl p-3">
              <p className="font-bold text-slate-900 mb-1">{p.question}</p>
              <p className="text-slate-700 whitespace-pre-wrap">
                {(submission.reflectionAnswers[p.id] || '').trim() || '(Belum diisi)'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
