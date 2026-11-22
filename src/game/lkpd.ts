import {
  ALL_RYB_COLORS,
  RYB_COLOR_REGISTRY,
  getColorDef,
} from './colors';
import {
  RYBColorDef,
  RYBColorId,
  RunSummary,
} from './types';

export const LKPD_PROGRESS_STORAGE_KEY = 'color_mission_progress';
export const LKPD_DATA_STORAGE_KEY = 'color_mission_lkpd';

export const LKPD_DEFAULT_SCHOOL = 'SMAN 19 Bandung';
export const LKPD_DEFAULT_TEACHER = 'Muhammad Adli Abdurrahim, S.Pd.';

export interface GameCompletionProgress {
  gameCompleted: boolean;
  completedAt: string | null;
  bestScore: number;
  lastScore: number;
  lastAccuracy: number;
  lastBestCombo: number;
  lastKills: number;
  lastTimeSurvivedSeconds: number;
}

export const DEFAULT_GAME_PROGRESS: GameCompletionProgress = {
  gameCompleted: false,
  completedAt: null,
  bestScore: 0,
  lastScore: 0,
  lastAccuracy: 0,
  lastBestCombo: 0,
  lastKills: 0,
  lastTimeSurvivedSeconds: 0,
};

export interface LKPDLabChallenge {
  id: string;
  targetColorId: RYBColorId;
  prompt: string;
  hint: string;
}

export type LKPDQuizType = 'multiple_choice' | 'match_ingredients';

export interface LKPDQuizOption {
  id: string;
  label: string;
  swatchHexes?: string[];
}

export interface LKPDQuizQuestion {
  id: string;
  type: LKPDQuizType;
  question: string;
  previewColorIds?: ('red' | 'yellow' | 'blue' | 'orange' | 'green' | 'purple' | 'red_orange' | 'yellow_orange' | 'yellow_green' | 'blue_green' | 'blue_purple' | 'red_purple' | 'white' | 'black')[];
  options: LKPDQuizOption[];
  correctOptionId: string;
  explanation: string;
}

export interface LKPDReflectionPrompt {
  id: string;
  question: string;
  placeholder: string;
}

export interface LKPDSubmissionState {
  studentName: string;
  studentClass: string;
  studentAbsent: string;
  schoolName: string;
  teacherName: string;
  labSolvedIds: RYBColorId[];
  quizAnswers: Record<string, string>;
  quizChecked: boolean;
  reflectionAnswers: Record<string, string>;
  completedAt: string | null;
}

export const DEFAULT_LKPD_SUBMISSION: LKPDSubmissionState = {
  studentName: '',
  studentClass: '',
  studentAbsent: '',
  schoolName: LKPD_DEFAULT_SCHOOL,
  teacherName: LKPD_DEFAULT_TEACHER,
  labSolvedIds: [],
  quizAnswers: {},
  quizChecked: false,
  reflectionAnswers: {},
  completedAt: null,
};

/**
 * Bahan warna yang tersedia di Laboratorium Campur Warna LKPD (3 Primer + 3 Sekunder).
 */
export const LKPD_LAB_INGREDIENTS: RYBColorId[] = [
  'red',
  'yellow',
  'blue',
  'orange',
  'green',
  'purple',
];

/**
 * 5 Tantangan Lab Campur Warna Interaktif berdasarkan RYB_COLOR_REGISTRY.
 */
export const LKPD_LAB_CHALLENGES: LKPDLabChallenge[] = [
  {
    id: 'lab_orange',
    targetColorId: 'orange',
    prompt: 'Buat warna Sekunder sesuai kotak target.',
    hint: 'Gabungkan 2 Warna Primer hangat.',
  },
  {
    id: 'lab_green',
    targetColorId: 'green',
    prompt: 'Buat warna Sekunder sesuai kotak target.',
    hint: 'Padukan 2 Warna Primer cerah dan dingin.',
  },
  {
    id: 'lab_purple',
    targetColorId: 'purple',
    prompt: 'Buat warna Sekunder sesuai kotak target.',
    hint: 'Campurkan 2 Warna Primer berlawanan suhu.',
  },
  {
    id: 'lab_red_orange',
    targetColorId: 'red_orange',
    prompt: 'Buat warna Tersier sesuai kotak target.',
    hint: '1 Warna Primer hangat + 1 Warna Sekunder terdekat.',
  },
  {
    id: 'lab_blue_green',
    targetColorId: 'blue_green',
    prompt: 'Buat warna Tersier sesuai kotak target.',
    hint: '1 Warna Primer dingin + 1 Warna Sekunder terdekat.',
  },
];

/**
 * 6 Soal Uji Pemahaman Teori Warna Primer (4 Pilihan Ganda + 2 Pencocokan Resep Tersier).
 */
export const LKPD_QUIZ_QUESTIONS: LKPDQuizQuestion[] = [
  {
    id: 'q1_primer',
    type: 'multiple_choice',
    question: 'Manakah kelompok 3 Warna Primer?',
    options: [
      {
        id: 'a',
        label: 'Merah, Kuning, Biru',
        swatchHexes: ['#EF233C', '#FFD60A', '#1D6FFF'],
      },
      {
        id: 'b',
        label: 'Jingga, Hijau, Ungu',
        swatchHexes: ['#FF7A00', '#16A34A', '#8B5CF6'],
      },
      {
        id: 'c',
        label: 'Merah, Hijau, Hitam',
        swatchHexes: ['#EF233C', '#16A34A', '#111827'],
      },
      {
        id: 'd',
        label: 'Putih, Kuning, Abu-abu',
        swatchHexes: ['#F8FAFC', '#FFD60A', '#64748B'],
      },
    ],
    correctOptionId: 'a',
    explanation:
      'Warna Primer adalah Merah, Kuning, dan Biru (tidak berasal dari campuran lain).',
  },
  {
    id: 'q2_sekunder',
    type: 'multiple_choice',
    question: 'Hasil campuran dua kotak warna di bawah ini adalah?',
    previewColorIds: ['yellow', 'blue'],
    options: [
      { id: 'a', label: 'Jingga', swatchHexes: ['#FF7A00'] },
      { id: 'b', label: 'Hijau', swatchHexes: ['#16A34A'] },
      { id: 'c', label: 'Ungu', swatchHexes: ['#8B5CF6'] },
      { id: 'd', label: 'Merah-Ungu', swatchHexes: ['#C026D3'] },
    ],
    correctOptionId: 'b',
    explanation:
      'Campuran Kuning + Biru menghasilkan warna sekunder Hijau.',
  },
  {
    id: 'q3_tersier_konsep',
    type: 'multiple_choice',
    question: 'Bagaimana prinsip terbentuknya warna Tersier pada Stage 3?',
    options: [
      { id: 'a', label: '1 Warna Primer + 1 Warna Sekunder berdekatan' },
      { id: 'b', label: 'Warna netral terang + gelap secara merata' },
      { id: 'c', label: '1 Warna Primer tanpa campuran' },
      { id: 'd', label: 'Ketiga warna Sekunder sekaligus' },
    ],
    correctOptionId: 'a',
    explanation:
      'Warna tersier terbentuk dari campuran 1 Warna Primer + 1 Warna Sekunder yang berdekatan.',
  },
  {
    id: 'q4_boss_netral',
    type: 'multiple_choice',
    question: 'Mengapa 2 kristal warna di bawah ini pada Boss tidak masuk 12 roda Warna Primer?',
    previewColorIds: ['white', 'black'],
    options: [
      { id: 'a', label: 'Tergolong warna netral akromatik' },
      { id: 'b', label: 'Termasuk warna tersier khusus' },
      { id: 'c', label: 'Hasil campuran warna sekunder hangat' },
      { id: 'd', label: 'Termasuk Warna Primer dingin' },
    ],
    correctOptionId: 'a',
    explanation:
      'Putih dan Hitam adalah warna netral (akromatik), bukan bagian dari 12 hue roda Warna Primer.',
  },
  {
    id: 'q5_match_yellow_orange',
    type: 'match_ingredients',
    question: 'Pilih 2 bahan campuran untuk menghasilkan warna Tersier berikut:',
    previewColorIds: ['yellow_orange'],
    options: [
      { id: 'a', label: 'Kuning + Jingga', swatchHexes: ['#FFD60A', '#FF7A00'] },
      { id: 'b', label: 'Merah + Jingga', swatchHexes: ['#EF233C', '#FF7A00'] },
      { id: 'c', label: 'Kuning + Hijau', swatchHexes: ['#FFD60A', '#16A34A'] },
      { id: 'd', label: 'Biru + Ungu', swatchHexes: ['#1D6FFF', '#8B5CF6'] },
    ],
    correctOptionId: 'a',
    explanation:
      'Kuning-Jingga dibentuk dari Kuning (Warna Primer) + Jingga (Sekunder).',
  },
  {
    id: 'q6_match_red_purple',
    type: 'match_ingredients',
    question: 'Pilih 2 bahan campuran untuk menghasilkan warna Tersier berikut:',
    previewColorIds: ['red_purple'],
    options: [
      { id: 'a', label: 'Biru + Hijau', swatchHexes: ['#1D6FFF', '#16A34A'] },
      { id: 'b', label: 'Biru + Ungu', swatchHexes: ['#1D6FFF', '#8B5CF6'] },
      { id: 'c', label: 'Merah + Ungu', swatchHexes: ['#EF233C', '#8B5CF6'] },
      { id: 'd', label: 'Merah + Hijau', swatchHexes: ['#EF233C', '#16A34A'] },
    ],
    correctOptionId: 'c',
    explanation:
      'Merah-Ungu dibentuk dari Merah (Warna Primer) + Ungu (Sekunder).',
  },
];

/**
 * 3 Pertanyaan Esai Analisis & Refleksi Siswa.
 */
export const LKPD_REFLECTION_PROMPTS: LKPDReflectionPrompt[] = [
  {
    id: 'ref_1_kategori',
    question:
      '1. Apa perbedaan Warna Primer, Sekunder, dan Tersier di Stage 1–3?',
    placeholder: 'Jelaskan singkat beserta contohnya...',
  },
  {
    id: 'ref_2_strategi',
    question:
      '2. Bagaimana strategimu menentukan warna campuran & kristal Boss?',
    placeholder: 'Ceritakan strategimu saat bermain...',
  },
  {
    id: 'ref_3_refleksi',
    question:
      '3. Bagian mana yang paling membantumu memahami teori Warna Primer?',
    placeholder: 'Tuliskan refleksi belajarmu...',
  },
];

/**
 * Mencampur dua warna dari Laboratorium Campur Warna berdasarkan definisi RYB_COLOR_REGISTRY.
 * Urutan bahan bersifat komutatif (A + B sama dengan B + A).
 */
export function mixRYBColors(colorA: RYBColorId, colorB: RYBColorId): RYBColorDef | null {
  if (colorA === colorB) {
    return RYB_COLOR_REGISTRY[colorA];
  }

  for (const def of ALL_RYB_COLORS) {
    if (!def.ingredients) continue;
    const [ing1, ing2] = def.ingredients;
    if ((ing1 === colorA && ing2 === colorB) || (ing1 === colorB && ing2 === colorA)) {
      return def;
    }
  }
  return null;
}

export interface LKPDScoreBreakdown {
  labCorrect: number;
  labTotal: number;
  quizCorrect: number;
  quizTotal: number;
  reflectionAnswered: number;
  reflectionTotal: number;
  objectiveScore: number;
  predicate: string;
}

/**
 * Menghitung rekap nilai objektif (Lab + Kuis) serta kelengkapan refleksi siswa.
 */
export function calculateLKPDScore(submission: LKPDSubmissionState): LKPDScoreBreakdown {
  const validChallengeTargets = new Set(LKPD_LAB_CHALLENGES.map((c) => c.targetColorId));
  const labCorrect = submission.labSolvedIds.filter((id) => validChallengeTargets.has(id)).length;
  const labTotal = LKPD_LAB_CHALLENGES.length;

  let quizCorrect = 0;
  for (const q of LKPD_QUIZ_QUESTIONS) {
    if (submission.quizAnswers[q.id] === q.correctOptionId) {
      quizCorrect += 1;
    }
  }
  const quizTotal = LKPD_QUIZ_QUESTIONS.length;

  let reflectionAnswered = 0;
  for (const prompt of LKPD_REFLECTION_PROMPTS) {
    if ((submission.reflectionAnswers[prompt.id] || '').trim().length >= 8) {
      reflectionAnswered += 1;
    }
  }
  const reflectionTotal = LKPD_REFLECTION_PROMPTS.length;

  const totalObjective = labTotal + quizTotal;
  const objectiveScore =
    totalObjective > 0 ? Math.round(((labCorrect + quizCorrect) / totalObjective) * 100) : 0;

  let predicate = 'Perlu Pendalaman';
  if (objectiveScore >= 90) {
    predicate = 'Sangat Baik';
  } else if (objectiveScore >= 75) {
    predicate = 'Baik';
  } else if (objectiveScore >= 60) {
    predicate = 'Cukup';
  }

  return {
    labCorrect,
    labTotal,
    quizCorrect,
    quizTotal,
    reflectionAnswered,
    reflectionTotal,
    objectiveScore,
    predicate,
  };
}

export function loadGameCompletionProgress(): GameCompletionProgress {
  try {
    const raw = localStorage.getItem(LKPD_PROGRESS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GAME_PROGRESS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_GAME_PROGRESS, ...parsed };
  } catch {
    return { ...DEFAULT_GAME_PROGRESS };
  }
}

export function saveGameCompletionProgress(summary: RunSummary): GameCompletionProgress {
  const prev = loadGameCompletionProgress();
  const next: GameCompletionProgress = {
    gameCompleted: prev.gameCompleted || Boolean(summary.won),
    completedAt: prev.completedAt || (summary.won ? new Date().toISOString() : null),
    bestScore: Math.max(prev.bestScore, summary.score),
    lastScore: summary.score,
    lastAccuracy: summary.accuracy,
    lastBestCombo: summary.bestCombo,
    lastKills: summary.kills,
    lastTimeSurvivedSeconds: summary.timeSurvivedSeconds,
  };
  try {
    localStorage.setItem(LKPD_PROGRESS_STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function loadLKPDSubmission(): LKPDSubmissionState {
  try {
    const raw = localStorage.getItem(LKPD_DATA_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LKPD_SUBMISSION };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_LKPD_SUBMISSION,
      ...parsed,
      labSolvedIds: Array.isArray(parsed?.labSolvedIds) ? parsed.labSolvedIds : [],
      quizAnswers: parsed?.quizAnswers && typeof parsed.quizAnswers === 'object' ? parsed.quizAnswers : {},
      reflectionAnswers:
        parsed?.reflectionAnswers && typeof parsed.reflectionAnswers === 'object'
          ? parsed.reflectionAnswers
          : {},
    };
  } catch {
    return { ...DEFAULT_LKPD_SUBMISSION };
  }
}

export function saveLKPDSubmission(state: LKPDSubmissionState): void {
  try {
    localStorage.setItem(LKPD_DATA_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function formatLKPDSummaryText(
  submission: LKPDSubmissionState,
  progress: GameCompletionProgress
): string {
  const score = calculateLKPDScore(submission);
  const studentName = submission.studentName.trim() || '-';
  const studentClass = submission.studentClass.trim() || '-';
  const studentAbsent = submission.studentAbsent.trim() || '-';
  const dateText = submission.completedAt
    ? new Date(submission.completedAt).toLocaleString('id-ID')
    : new Date().toLocaleString('id-ID');

  const lines = [
    '=== HASIL EVALUASI LKPD — COLOR MISSION ===',
    `Nama Siswa   : ${studentName}`,
    `Kelas        : ${studentClass} (No. Absen: ${studentAbsent})`,
    `Sekolah      : ${submission.schoolName || LKPD_DEFAULT_SCHOOL}`,
    `Guru Pengampu: ${submission.teacherName || LKPD_DEFAULT_TEACHER}`,
    `Waktu        : ${dateText}`,
    '',
    '[CAPAIAN GAME]',
    `- Status Misi  : ${progress.gameCompleted ? 'SELESAI (Boss CHROMA TITAN Kalah)' : 'Belum Selesai'}`,
    `- Skor Terbaik : ${progress.bestScore.toLocaleString('id-ID')}`,
    `- Akurasi      : ${progress.lastAccuracy}% | Kombo Terbaik: ${progress.lastBestCombo}x`,
    '',
    '[SKOR LKPD INTERAKTIF]',
    `- Lab Campur Warna : ${score.labCorrect}/${score.labTotal}`,
    `- Kuis Teori Warna : ${score.quizCorrect}/${score.quizTotal}`,
    `- Nilai Objektif   : ${score.objectiveScore}/100 (${score.predicate})`,
    `- Refleksi Terisi  : ${score.reflectionAnswered}/${score.reflectionTotal}`,
    '',
    '[JAWABAN ESAI & REFLEKSI]',
    ...LKPD_REFLECTION_PROMPTS.map((p) => {
      const ans = (submission.reflectionAnswers[p.id] || '').trim() || '(Belum diisi)';
      return `${p.question}\nJawaban: ${ans}\n`;
    }),
  ];

  return lines.join('\n');
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : ['-'];
}

/**
 * Menghasilkan file PNG kartu bukti hasil LKPD agar siswa mudah mengumpulkan ke guru.
 */
export function exportLKPDCardAsPNG(
  submission: LKPDSubmissionState,
  progress: GameCompletionProgress
): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1520;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const score = calculateLKPDScore(submission);
  const studentName = submission.studentName.trim() || 'Peserta Didik';
  const studentClass = submission.studentClass.trim() || '-';
  const studentAbsent = submission.studentAbsent.trim() || '-';
  const dateLabel = new Date(submission.completedAt || Date.now()).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Latar belakang kartu gelap elegan
  ctx.fillStyle = '#070b15';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Bingkai luar
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(28, 28, canvas.width - 56, canvas.height - 56, 28);
  ctx.stroke();

  // Header
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(56, 56, canvas.width - 112, 160, 22);
  ctx.fill();

  // 3 Kotak Primer
  const primHexes = ['#EF233C', '#FFD60A', '#1D6FFF'];
  primHexes.forEach((hex, idx) => {
    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.roundRect(92 + idx * 36, 92, 26, 26, 6);
    ctx.fill();
  });

  ctx.fillStyle = '#22d3ee';
  ctx.font = '800 20px system-ui, sans-serif';
  ctx.fillText('LEMBAR KERJA PESERTA DIDIK (LKPD) · BUKTI EVALUASI', 214, 112);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 42px system-ui, sans-serif';
  ctx.fillText('COLOR MISSION — TEORI WARNA PRIMER', 92, 166);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText(
    `${submission.schoolName || LKPD_DEFAULT_SCHOOL}  ·  Guru: ${submission.teacherName || LKPD_DEFAULT_TEACHER}  ·  ${dateLabel}`,
    92,
    198
  );

  // Kotak Identitas Siswa
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.beginPath();
  ctx.roundRect(56, 238, canvas.width - 112, 128, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText('NAMA LENGKAP', 90, 276);
  ctx.fillText('KELAS', 620, 276);
  ctx.fillText('NO. ABSEN', 870, 276);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 28px system-ui, sans-serif';
  ctx.fillText(studentName.slice(0, 32), 90, 320);
  ctx.fillText(studentClass.slice(0, 14), 620, 320);
  ctx.fillText(studentAbsent.slice(0, 10), 870, 320);

  // 4 Kartu Skor Ringkas
  const cardW = (canvas.width - 112 - 48) / 4;
  const stats = [
    { label: 'NILAI LKPD', value: `${score.objectiveScore}/100`, sub: score.predicate, color: '#34d399' },
    { label: 'LAB CAMPUR WARNA', value: `${score.labCorrect}/${score.labTotal}`, sub: 'Misi Praktikum', color: '#22d3ee' },
    { label: 'KUIS TEORI WARNA', value: `${score.quizCorrect}/${score.quizTotal}`, sub: 'Soal Pemahaman', color: '#fbbf24' },
    { label: 'SKOR GAME TERBAIK', value: progress.bestScore.toLocaleString('id-ID'), sub: `Akurasi ${progress.lastAccuracy}%`, color: '#a78bfa' },
  ];

  stats.forEach((st, idx) => {
    const cx = 56 + idx * (cardW + 16);
    const cy = 392;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.roundRect(cx, cy, cardW, 142, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(st.label, cx + 20, cy + 36);

    ctx.fillStyle = st.color;
    ctx.font = '900 38px system-ui, sans-serif';
    ctx.fillText(st.value, cx + 20, cy + 88);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(st.sub, cx + 20, cy + 120);
  });

  // 12 Swatch Roda Warna Primer
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.beginPath();
  ctx.roundRect(56, 558, canvas.width - 112, 128, 18);
  ctx.fill();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '800 17px system-ui, sans-serif';
  ctx.fillText('12 RODA WARNA PRIMER YANG TELAH DIKUASAI DALAM GAME', 84, 594);

  const swSize = 54;
  const swGap = 32;
  const swStartX = 84;
  ALL_RYB_COLORS.forEach((col, i) => {
    const sx = swStartX + i * (swSize + swGap);
    ctx.fillStyle = col.hex;
    ctx.beginPath();
    ctx.roundRect(sx, 612, swSize, 38, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Bagian Jawaban Esai & Refleksi
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.beginPath();
  ctx.roundRect(56, 712, canvas.width - 112, 710, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.stroke();

  ctx.fillStyle = '#22d3ee';
  ctx.font = '800 20px system-ui, sans-serif';
  ctx.fillText('RINGKASAN JAWABAN ANALISIS & REFLEKSI SISWA', 88, 756);

  let yCursor = 800;
  for (const prompt of LKPD_REFLECTION_PROMPTS) {
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 18px system-ui, sans-serif';
    const qLines = wrapCanvasText(ctx, prompt.question, canvas.width - 180).slice(0, 2);
    for (const ql of qLines) {
      ctx.fillText(ql, 88, yCursor);
      yCursor += 26;
    }

    const rawAns = (submission.reflectionAnswers[prompt.id] || '').trim() || '(Belum diisi)';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 17px system-ui, sans-serif';
    const aLines = wrapCanvasText(ctx, `Jawaban: ${rawAns}`, canvas.width - 180).slice(0, 4);
    for (const al of aLines) {
      ctx.fillText(al, 88, yCursor);
      yCursor += 24;
    }
    yCursor += 26;
  }

  // Footer
  ctx.fillStyle = '#64748b';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText(
    'Dokumen ini dibuat otomatis oleh sistem evaluasi interaktif COLOR MISSION.',
    56,
    1464
  );

  const safeName = studentName.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const safeClass = studentClass.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const link = document.createElement('a');
  link.download = `LKPD_COLOR_MISSION_${safeName}_${safeClass}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

export function getQuizColorPreview(
  id: 'red' | 'yellow' | 'blue' | 'orange' | 'green' | 'purple' | 'red_orange' | 'yellow_orange' | 'yellow_green' | 'blue_green' | 'blue_purple' | 'red_purple' | 'white' | 'black'
): { nameId: string; hex: string } {
  const def = getColorDef(id);
  return { nameId: def.nameId, hex: def.hex };
}
