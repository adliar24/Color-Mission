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
  Sparkles,
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

  // State umpan balik tombol ekspor
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [pngExportedMsg, setPngExportedMsg] = useState<string | null>(null);

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
        message: `${getColorDef(slotA).nameId} + ${getColorDef(slotB).nameId} tidak menghasilkan warna standar Sekunder/Tersier pada tantangan ini. Coba kombinasi lain!`,
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
        message: `Tepat sekali! ${getColorDef(slotA).nameId} + ${getColorDef(slotB).nameId} = ${result.nameId} (${result.categoryLabelId}). Tantangan ini selesai!`,
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
    if (submission.quizChecked) return;
    setSubmission((prev) => ({
      ...prev,
      quizAnswers: {
        ...prev.quizAnswers,
        [questionId]: optionId,
      },
    }));
  };

  const handleCheckQuiz = () => {
    setSubmission((prev) => ({
      ...prev,
      quizChecked: true,
      completedAt: prev.completedAt || new Date().toISOString(),
    }));
  };

  const handleResetQuiz = () => {
    setSubmission((prev) => ({
      ...prev,
      quizAnswers: {},
      quizChecked: false,
    }));
  };

  const handleOpenTab = (tabId: LKPDTabId) => {
    if (tabId === 'hasil' && !submission.completedAt) {
      setSubmission((prev) => ({
        ...prev,
        completedAt: new Date().toISOString(),
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
      setPngExportedMsg('Kartu Bukti Nilai (.PNG) berhasil diunduh!');
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
      className="fixed inset-0 bg-[#050811]/90 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-5 z-50 font-sans text-white ui-backdrop-enter lkpd-modal-overlay"
    >
      {/* Panel Interaktif Utama */}
      <div
        data-ui-board="true"
        className="max-w-3xl w-full max-h-[92dvh] bg-[#090d18] border border-white/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden ui-panel-enter lkpd-interactive-shell"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#EF233C] border border-white/75" />
              <span className="w-3.5 h-3.5 rounded-sm bg-[#FFD60A] border border-white/75" />
              <span className="w-3.5 h-3.5 rounded-sm bg-[#1D6FFF] border border-white/75" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black tracking-tight uppercase truncate">
                LKPD EVALUASI INTERAKTIF
              </h2>
              <p className="text-[11px] sm:text-xs font-semibold text-cyan-400 truncate">
                COLOR MISSION · Teori Pencampuran Warna Pigmen RYB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-extrabold">
              <span>Nilai Objektif:</span>
              <span className="tabular-nums">{scoreBreakdown.objectiveScore}/100</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup LKPD"
              className="p-2 rounded-xl bg-white/6 hover:bg-white/12 text-slate-300 hover:text-white cursor-pointer flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigasi Tab */}
        <div className="px-3 sm:px-5 py-2.5 border-b border-white/10 bg-[#070b15] flex items-center gap-1.5 overflow-x-auto shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleOpenTab(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wide flex items-center gap-1.5 whitespace-nowrap cursor-pointer border transition-colors ${
                  active
                    ? 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Konten Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* ==============================================================
              TAB 1: IDENTITAS PESERTA DIDIK & CAPAIAN GAME
             ============================================================== */}
          {activeTab === 'identitas' && (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-400/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                    MISI GAME TELAH SELESAI · LKPD TERBUKA
                  </span>
                  <p className="text-xs sm:text-sm text-slate-200 mt-0.5">
                    Lengkapi data dirimu terlebih dahulu, lalu kerjakan Laboratorium Warna, Kuis, dan Refleksi secara berurutan.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 bg-black/30 px-3.5 py-2 rounded-xl border border-white/10">
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Skor Terbaik</span>
                    <span className="text-sm font-black text-emerald-300 tabular-nums">
                      {progress.bestScore.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="w-px h-7 bg-white/10" />
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Akurasi</span>
                    <span className="text-sm font-black text-cyan-300 tabular-nums">
                      {progress.lastAccuracy}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="block">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-300 block mb-1.5">
                    Nama Lengkap Siswa *
                  </span>
                  <input
                    type="text"
                    value={submission.studentName}
                    onChange={(e) =>
                      setSubmission((prev) => ({ ...prev, studentName: e.target.value }))
                    }
                    placeholder="Contoh: Nadia Putri Pratama"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 focus:border-cyan-400 focus:outline-none text-sm font-semibold text-white placeholder:text-slate-500"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-slate-300 block mb-1.5">
                      Kelas *
                    </span>
                    <input
                      type="text"
                      value={submission.studentClass}
                      onChange={(e) =>
                        setSubmission((prev) => ({ ...prev, studentClass: e.target.value }))
                      }
                      placeholder="Contoh: X-4"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 focus:border-cyan-400 focus:outline-none text-sm font-semibold text-white placeholder:text-slate-500"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-slate-300 block mb-1.5">
                      No. Absen
                    </span>
                    <input
                      type="text"
                      value={submission.studentAbsent}
                      onChange={(e) =>
                        setSubmission((prev) => ({ ...prev, studentAbsent: e.target.value }))
                      }
                      placeholder="Contoh: 17"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 focus:border-cyan-400 focus:outline-none text-sm font-semibold text-white placeholder:text-slate-500"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-300 block mb-1.5">
                    Satuan Pendidikan
                  </span>
                  <input
                    type="text"
                    value={submission.schoolName}
                    onChange={(e) =>
                      setSubmission((prev) => ({ ...prev, schoolName: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 focus:border-cyan-400 focus:outline-none text-sm font-semibold text-white"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-300 block mb-1.5">
                    Guru Pengampu
                  </span>
                  <input
                    type="text"
                    value={submission.teacherName}
                    onChange={(e) =>
                      setSubmission((prev) => ({ ...prev, teacherName: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 focus:border-cyan-400 focus:outline-none text-sm font-semibold text-white"
                  />
                </label>
              </div>

              <div className="bg-white/4 border border-white/10 rounded-2xl p-4 space-y-2.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 block">
                  Tujuan Pembelajaran LKPD
                </span>
                <ul className="text-xs sm:text-sm text-slate-300 space-y-1.5 list-disc pl-4">
                  <li>Mengelompokkan warna Primer, Sekunder, dan Tersier pada sistem warna pigmen RYB.</li>
                  <li>Membuktikan hasil pencampuran warna melalui eksperimen virtual di Laboratorium Warna.</li>
                  <li>Menyimpulkan strategi penentuan warna pada tantangan Stage 1–3 &amp; Boss CHROMA TITAN.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 2: LABORATORIUM CAMPUR WARNA INTERAKTIF (5 MISI)
             ============================================================== */}
          {activeTab === 'lab' && (
            <div className="space-y-4">
              {/* Pilihan Tantangan 1-5 */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase flex items-center gap-1.5 border cursor-pointer ${
                          selected
                            ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                            : solved
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                            : 'bg-white/5 text-slate-300 border-white/12 hover:bg-white/10'
                        }`}
                      >
                        {solved && <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>Misi {idx + 1}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs font-extrabold text-cyan-300 tabular-nums">
                  Selesai: {scoreBreakdown.labCorrect}/{scoreBreakdown.labTotal}
                </span>
              </div>

              {/* Instruksi Target Tantangan */}
              <div className="bg-white/5 border border-white/12 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-400">
                      TARGET EKSPERIMEN #{activeChallengeIdx + 1} ({targetColorDef.categoryLabelId})
                    </span>
                    {submission.labSolvedIds.includes(activeChallenge.targetColorId) && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase">
                        Sudah Berhasil
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-white">{activeChallenge.prompt}</p>
                  {showLabHint && (
                    <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-400/25 rounded-lg px-2.5 py-1.5 mt-1">
                      Petunjuk: {activeChallenge.hint}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-12 h-12 rounded-xl border-2 border-white shadow-md"
                      style={{ backgroundColor: targetColorDef.hex }}
                    />
                    <span className="text-[10px] font-bold text-slate-300 mt-1 uppercase">
                      {targetColorDef.nameId}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLabHint((v) => !v)}
                    className="p-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-300 cursor-pointer"
                    title="Lihat Petunjuk"
                  >
                    <Lightbulb className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Meja Campur Interaktif */}
              <div className="bg-[#060a14] border border-white/10 rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 sm:gap-3 text-center">
                  {/* Wadah 1 */}
                  <button
                    type="button"
                    onClick={() => setActiveSlotPicker('A')}
                    className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                      activeSlotPicker === 'A'
                        ? 'border-cyan-400 bg-cyan-400/10'
                        : 'border-white/15 bg-white/4 hover:bg-white/8'
                    }`}
                  >
                    <span className="text-[10px] font-extrabold uppercase text-slate-400">Wadah 1</span>
                    <div
                      className="w-11 h-11 rounded-xl border-2 border-white/90"
                      style={{ backgroundColor: slotA ? getColorDef(slotA).hex : '#1e293b' }}
                    />
                    <span className="text-xs font-bold text-white">
                      {slotA ? getColorDef(slotA).nameId : 'Pilih'}
                    </span>
                  </button>

                  <span className="text-xl font-black text-slate-400">+</span>

                  {/* Wadah 2 */}
                  <button
                    type="button"
                    onClick={() => setActiveSlotPicker('B')}
                    className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                      activeSlotPicker === 'B'
                        ? 'border-cyan-400 bg-cyan-400/10'
                        : 'border-white/15 bg-white/4 hover:bg-white/8'
                    }`}
                  >
                    <span className="text-[10px] font-extrabold uppercase text-slate-400">Wadah 2</span>
                    <div
                      className="w-11 h-11 rounded-xl border-2 border-white/90"
                      style={{ backgroundColor: slotB ? getColorDef(slotB).hex : '#1e293b' }}
                    />
                    <span className="text-xs font-bold text-white">
                      {slotB ? getColorDef(slotB).nameId : 'Pilih'}
                    </span>
                  </button>

                  <span className="text-xl font-black text-slate-400">=</span>

                  {/* Hasil Campuran */}
                  <div className="p-3 rounded-2xl border border-white/15 bg-white/4 flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400">Hasil</span>
                    <div
                      className="w-11 h-11 rounded-xl border-2 border-white/90 flex items-center justify-center"
                      style={{
                        backgroundColor: mixResult?.mixed ? mixResult.mixed.hex : '#0f172a',
                      }}
                    >
                      {!mixResult?.mixed && <span className="text-sm font-black text-slate-500">?</span>}
                    </div>
                    <span className="text-xs font-bold text-white">
                      {mixResult?.mixed ? mixResult.mixed.nameId : 'Belum Dicampur'}
                    </span>
                  </div>
                </div>

                {/* Palet Bahan Warna */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Klik warna di bawah untuk mengisi{' '}
                    <span className="text-cyan-400 font-extrabold">
                      {activeSlotPicker === 'A' ? 'Wadah 1' : 'Wadah 2'}
                    </span>
                    :
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {LKPD_LAB_INGREDIENTS.map((cid) => {
                      const def = getColorDef(cid);
                      return (
                        <button
                          key={cid}
                          type="button"
                          onClick={() => handleSelectIngredient(cid)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/12 border border-white/12 flex flex-col items-center gap-1.5 cursor-pointer"
                        >
                          <span
                            className="w-8 h-8 rounded-lg border border-white/90 shadow-sm"
                            style={{ backgroundColor: def.hex }}
                          />
                          <span className="text-[11px] font-bold text-slate-200">{def.nameId}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleMixColors}
                  className="w-full h-11 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wide rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>CAMPURKAN WARNA SEKARANG</span>
                </button>

                {mixResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs sm:text-sm font-semibold flex items-start gap-2.5 ${
                      mixResult.matchedChallenge
                        ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                        : 'bg-amber-500/15 border-amber-400/35 text-amber-200'
                    }`}
                  >
                    {mixResult.matchedChallenge ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <FlaskConical className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p>{mixResult.message}</p>
                      {mixResult.matchedChallenge && activeChallengeIdx < LKPD_LAB_CHALLENGES.length - 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveChallengeIdx((i) => Math.min(LKPD_LAB_CHALLENGES.length - 1, i + 1));
                            setMixResult(null);
                            setShowLabHint(false);
                          }}
                          className="mt-2 px-3 py-1 rounded-lg bg-emerald-400 text-slate-950 text-xs font-black uppercase cursor-pointer"
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
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white/4 border border-white/10 rounded-2xl p-3.5">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 block">
                    UJI PEMAHAMAN TEORI WARNA RYB (6 SOAL)
                  </span>
                  <p className="text-xs text-slate-300">
                    Pilih jawaban paling tepat, lalu tekan tombol periksa untuk melihat nilai dan pembahasan.
                  </p>
                </div>
                {submission.quizChecked && (
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/35 text-emerald-300 text-xs font-black tabular-nums">
                    Benar: {scoreBreakdown.quizCorrect}/{scoreBreakdown.quizTotal}
                  </span>
                )}
              </div>

              <div className="space-y-3.5">
                {LKPD_QUIZ_QUESTIONS.map((q, qIdx) => {
                  const chosen = submission.quizAnswers[q.id];
                  const isCorrect = chosen === q.correctOptionId;

                  return (
                    <div
                      key={q.id}
                      className="bg-white/4 border border-white/12 rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                          <span className="text-cyan-400 font-black mr-1.5">#{qIdx + 1}</span>
                          {q.question}
                        </p>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-white/8 text-slate-300 shrink-0">
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
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/35 border border-white/10"
                              >
                                <span
                                  className="w-4 h-4 rounded-sm border border-white/80"
                                  style={{ backgroundColor: info.hex }}
                                />
                                <span className="text-[11px] font-bold text-slate-200">
                                  {info.nameId}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt) => {
                          const isSelected = chosen === opt.id;
                          const isOptCorrect = opt.id === q.correctOptionId;
                          let styleCls =
                            'bg-white/4 hover:bg-white/8 border-white/12 text-slate-200';
                          if (submission.quizChecked) {
                            if (isOptCorrect) {
                              styleCls =
                                'bg-emerald-500/20 border-emerald-400 text-emerald-200';
                            } else if (isSelected && !isOptCorrect) {
                              styleCls = 'bg-rose-500/20 border-rose-400 text-rose-200';
                            } else {
                              styleCls = 'bg-white/2 border-white/8 text-slate-400 opacity-75';
                            }
                          } else if (isSelected) {
                            styleCls = 'bg-cyan-400/18 border-cyan-400 text-white';
                          }

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleSelectQuizOption(q.id, opt.id)}
                              disabled={submission.quizChecked}
                              className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 cursor-pointer text-xs font-semibold transition-colors ${styleCls}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-md bg-black/35 border border-white/15 flex items-center justify-center text-[10px] font-black uppercase shrink-0">
                                  {opt.id}
                                </span>
                                <span className="truncate">{opt.label}</span>
                              </div>

                              {opt.swatchHexes && (
                                <div className="flex items-center gap-1 shrink-0">
                                  {opt.swatchHexes.map((hex, sIdx) => (
                                    <span
                                      key={sIdx}
                                      className="w-4 h-4 rounded-sm border border-white/80"
                                      style={{ backgroundColor: hex }}
                                    />
                                  ))}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {submission.quizChecked && (
                        <div
                          className={`p-2.5 rounded-xl text-xs flex items-start gap-2 ${
                            isCorrect
                              ? 'bg-emerald-500/12 text-emerald-200'
                              : 'bg-rose-500/12 text-rose-200'
                          }`}
                        >
                          {isCorrect ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <span>
                            <strong>{isCorrect ? 'Benar!' : 'Kurang tepat.'}</strong> {q.explanation}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                {!submission.quizChecked ? (
                  <button
                    type="button"
                    onClick={handleCheckQuiz}
                    className="w-full h-11 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wide rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>PERIKSA JAWABAN KUIS</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleResetQuiz}
                    className="w-full h-11 bg-white/8 hover:bg-white/14 border border-white/15 text-white font-bold text-xs uppercase tracking-wide rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-cyan-400" />
                    <span>KERJAKAN ULANG KUIS</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 4: ANALISIS & REFLEKSI SISWA (3 PERTANYAAN ESAI)
             ============================================================== */}
          {activeTab === 'refleksi' && (
            <div className="space-y-4">
              <div className="bg-white/4 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 block">
                    ANALISIS &amp; REFLEKSI PESERTA DIDIK
                  </span>
                  <p className="text-xs text-slate-300">
                    Tuliskan jawaban dengan kalimatmu sendiri berdasarkan pengalaman menamatkan Stage 1–3.
                  </p>
                </div>
                <span className="text-xs font-extrabold text-emerald-300 shrink-0 tabular-nums">
                  Terisi: {scoreBreakdown.reflectionAnswered}/{scoreBreakdown.reflectionTotal}
                </span>
              </div>

              {LKPD_REFLECTION_PROMPTS.map((prompt) => {
                const val = submission.reflectionAnswers[prompt.id] || '';
                return (
                  <div
                    key={prompt.id}
                    className="bg-white/4 border border-white/12 rounded-2xl p-4 space-y-2"
                  >
                    <label className="text-xs sm:text-sm font-bold text-white block">
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
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/35 border border-white/15 focus:border-cyan-400 focus:outline-none text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 resize-y"
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
            <div className="space-y-4">
              {/* Ringkasan Nilai Utama */}
              <div className="bg-gradient-to-br from-cyan-500/12 via-emerald-500/10 to-slate-900 border border-cyan-400/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-300 block">
                    HASIL EVALUASI AKHIR SISWA
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                    {submission.studentName.trim() || 'Nama Siswa Belum Diisi'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Kelas: <strong>{submission.studentClass.trim() || '-'}</strong> · Absen:{' '}
                    <strong>{submission.studentAbsent.trim() || '-'}</strong> ·{' '}
                    {submission.schoolName}
                  </p>
                </div>

                <div className="bg-black/40 border border-white/15 rounded-2xl px-5 py-3 text-center shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    NILAI OBJEKTIF
                  </span>
                  <span className="text-3xl font-black text-emerald-400 tabular-nums">
                    {scoreBreakdown.objectiveScore}
                    <span className="text-base text-slate-400">/100</span>
                  </span>
                  <span className="block text-xs font-extrabold text-cyan-300 mt-0.5">
                    {scoreBreakdown.predicate}
                  </span>
                </div>
              </div>

              {/* Detail Komponen Skor */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white/4 border border-white/10 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Lab Warna
                  </span>
                  <span className="text-lg font-black text-cyan-300 tabular-nums">
                    {scoreBreakdown.labCorrect}/{scoreBreakdown.labTotal}
                  </span>
                </div>
                <div className="bg-white/4 border border-white/10 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Kuis RYB
                  </span>
                  <span className="text-lg font-black text-amber-300 tabular-nums">
                    {scoreBreakdown.quizCorrect}/{scoreBreakdown.quizTotal}
                  </span>
                </div>
                <div className="bg-white/4 border border-white/10 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Refleksi Esai
                  </span>
                  <span className="text-lg font-black text-emerald-300 tabular-nums">
                    {scoreBreakdown.reflectionAnswered}/{scoreBreakdown.reflectionTotal}
                  </span>
                </div>
                <div className="bg-white/4 border border-white/10 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Skor Game
                  </span>
                  <span className="text-lg font-black text-violet-300 tabular-nums">
                    {progress.bestScore.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {!submission.quizChecked && (
                <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/30 text-xs text-amber-200 font-semibold">
                  Tip: Kamu belum menekan tombol <strong>&ldquo;Periksa Jawaban Kuis&rdquo;</strong> di Tab 3. Nilai kuis tetap terhitung otomatis, namun sebaiknya periksa jawabanmu agar dapat melihat pembahasannya!
                </div>
              )}

              {/* 12 Kotak Warna RYB */}
              <div className="bg-white/4 border border-white/10 rounded-2xl p-3.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-2">
                  12 Warna Roda RYB yang Telah Dikuasai:
                </span>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                  {ALL_RYB_COLORS.map((c) => (
                    <div key={c.id} className="flex flex-col items-center gap-1">
                      <div
                        className="w-full aspect-square rounded-lg border border-white/85"
                        style={{ backgroundColor: c.hex }}
                        title={c.nameId}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Tombol Ekspor Bukti */}
              <div className="space-y-2.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 block">
                  UNDUH / KUMPULKAN BUKTI PENGERJAAN KE GURU:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportPNG}
                    className="h-12 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    <span>Simpan Kartu PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintPDF}
                    className="h-12 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak / Simpan PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="h-12 px-4 rounded-xl bg-white/8 hover:bg-white/14 border border-white/15 text-white font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {copiedSummary ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-cyan-400" />
                        <span>Salin Ringkasan</span>
                      </>
                    )}
                  </button>
                </div>

                {pngExportedMsg && (
                  <p className="text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 rounded-xl px-3 py-2">
                    {pngExportedMsg}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSubmission({ ...DEFAULT_LKPD_SUBMISSION });
                    setMixResult(null);
                    setActiveChallengeIdx(0);
                    setActiveTab('identitas');
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-rose-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Isian LKPD</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigasi Antar Tab */}
        <div className="px-5 py-3 border-t border-white/10 bg-[#070b15] flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => goAdjacentTab(-1)}
            disabled={activeTab === 'identitas'}
            className="px-3.5 py-2 rounded-xl bg-white/6 hover:bg-white/12 disabled:opacity-35 disabled:cursor-not-allowed text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Sebelumnya</span>
          </button>

          <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
            Guru: {submission.teacherName} · {submission.schoolName}
          </span>

          {activeTab !== 'hasil' ? (
            <button
              type="button"
              onClick={() => goAdjacentTab(1)}
              className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
            >
              <span>Lanjut</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/16 text-white text-xs font-black uppercase cursor-pointer"
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
