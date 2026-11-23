import { getSupabase, isSupabaseConfigured } from './supabase';
import { RunSummary } from '../game/types';
import { LKPDSubmissionState, calculateLKPDScore, loadLKPDSubmission } from '../game/lkpd';

export interface StudentSessionRecord {
  id: string;
  student_name: string;
  student_class: string;
  student_absent: string;
  character_id: string;
  difficulty: string;
  stage_reached: number;
  won: boolean;
  score: number;
  accuracy: number;
  best_combo: number;
  kills: number;
  play_duration_seconds: number;
  created_at: string;
}

export interface LKPDSubmissionRecord {
  id: string;
  student_name: string;
  student_class: string;
  student_absent: string;
  lab_solved_ids: string[];
  quiz_answers: Record<string, string>;
  reflection_answers: Record<string, string>;
  objective_score: number;
  submitted_at: string;
}

export interface UnifiedStudentRow {
  student_name: string;
  student_class: string;
  student_absent: string;
  // Game metrics
  character_id: string;
  difficulty: string;
  stage_reached: number;
  won: boolean;
  score: number;
  accuracy: number;
  best_combo: number;
  play_duration_seconds: number;
  last_played_at: string;
  // LKPD metrics
  lkpd_submitted: boolean;
  lkpd_score: number | null;
  lkpd_lab_count: number;
  lkpd_submitted_at: string | null;
  lab_solved_ids?: string[];
  reflection_answers?: Record<string, string>;
  quiz_answers?: Record<string, string>;
}

const LS_SESSIONS_HISTORY = 'color_mission_sessions_history';
const LS_LKPD_HISTORY = 'color_mission_lkpd_history';

/**
 * Menghasilkan UUID v4 valid yang dijamin kompatibel dengan PostgreSQL UUID schema.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isValidUUID(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

// ==============================================================================
// LOCAL STORAGE HELPERS
// ==============================================================================

function getLocalSessions(): StudentSessionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_SESSIONS_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSession(session: StudentSessionRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getLocalSessions();
    const updated = [session, ...list.filter((s) => s.id !== session.id)].slice(0, 500);
    localStorage.setItem(LS_SESSIONS_HISTORY, JSON.stringify(updated));
  } catch {}
}

function getLocalLKPDSubmissions(): LKPDSubmissionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_LKPD_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalLKPD(submission: LKPDSubmissionRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getLocalLKPDSubmissions();
    const updated = [submission, ...list.filter((s) => s.id !== submission.id)].slice(0, 500);
    localStorage.setItem(LS_LKPD_HISTORY, JSON.stringify(updated));
  } catch {}
}

// ==============================================================================
// RECORDING API (Non-blocking & Asynchronous)
// ==============================================================================

/**
 * Mencatat awal sesi permainan begitu siswa menekan 'Mulai Misi'.
 * Mengirimkan status awal (stage 1, score 0) ke Supabase Cloud secara realtime
 * sehingga guru langsung dapat memantau siswa aktif di kelas dari laptop/perangkat lain.
 */
export async function recordInitialSessionStartAsync(
  studentName: string,
  studentClass: string,
  characterId: string = 'raka',
  difficulty: string = 'normal'
): Promise<string> {
  const name = (studentName || '').trim() || 'Siswa Anonim';
  const cls = (studentClass || '').trim() || '-';
  const recordId = generateUUID();

  const record: StudentSessionRecord = {
    id: recordId,
    student_name: name,
    student_class: cls,
    student_absent: '-',
    character_id: characterId,
    difficulty: difficulty,
    stage_reached: 1,
    won: false,
    score: 0,
    accuracy: 100,
    best_combo: 0,
    kills: 0,
    play_duration_seconds: 0,
    created_at: new Date().toISOString(),
  };

  saveLocalSession(record);

  if (isSupabaseConfigured()) {
    try {
      const client = getSupabase();
      if (client) {
        const { error } = await client.from('student_sessions').insert([record]);
        if (error) {
          console.warn('[SyncService] Supabase initial session insert error:', error.message);
        } else {
          console.info('[SyncService] Sesi aktif siswa terkirim ke Supabase Cloud:', name);
        }
      }
    } catch (err) {
      console.warn('[SyncService] Supabase initial session exception:', err);
    }
  }

  return recordId;
}

/**
 * Mencatat hasil sesi game siswa (dipanggil saat game over atau tamat).
 * Menulis ke localStorage secara instan, lalu sync ke Supabase di background tanpa menghambat 60fps game.
 */
export function recordGameSessionAsync(summary: RunSummary): void {
  const lkpdCurrent = loadLKPDSubmission();
  const name = (lkpdCurrent.studentName || '').trim() || 'Siswa Anonim';
  const cls = (lkpdCurrent.studentClass || '').trim() || '-';
  const absent = (lkpdCurrent.studentAbsent || '').trim() || '-';

  const record: StudentSessionRecord = {
    id: generateUUID(),
    student_name: name,
    student_class: cls,
    student_absent: absent,
    character_id: summary.characterId || 'raka',
    difficulty: summary.difficulty || 'normal',
    stage_reached: summary.stagesCleared > 0 ? (summary.won ? 3 : Math.min(3, summary.stagesCleared + 1)) : 1,
    won: Boolean(summary.won),
    score: summary.score,
    accuracy: Number(summary.accuracy.toFixed(1)),
    best_combo: summary.bestCombo,
    kills: summary.kills,
    play_duration_seconds: Math.round(summary.timeSurvivedSeconds),
    created_at: new Date().toISOString(),
  };

  // 1. Simpan ke local storage segera
  saveLocalSession(record);

  // 2. Sync asinkron ke Supabase (Fire and forget - jangan await)
  if (isSupabaseConfigured()) {
    Promise.resolve().then(async () => {
      try {
        const client = getSupabase();
        if (!client) return;
        const { error } = await client.from('student_sessions').insert([record]);
        if (error) {
          console.warn('[SyncService] Supabase session sync error:', error.message);
        } else {
          console.info('[SyncService] Sesi hasil game berhasil tersimpan di Supabase Cloud:', name);
        }
      } catch (err) {
        console.warn('[SyncService] Gagal sync sesi ke Supabase:', err);
      }
    });
  }
}

let _lastLKPDJson = '';

/**
 * Mencatat pengumpulan LKPD siswa (Dilengkapi Deduplikasi agar server Supabase tetap ringan).
 */
export function recordLKPDSubmissionAsync(state: LKPDSubmissionState): void {
  const scoreBreakdown = calculateLKPDScore(state);
  const name = (state.studentName || '').trim();
  const cls = (state.studentClass || '').trim() || '-';
  const absent = (state.studentAbsent || '').trim() || '-';

  if (!name) return;

  const jsonSignature = JSON.stringify({
    name,
    cls,
    lab: state.labSolvedIds,
    quiz: state.quizAnswers,
    ref: state.reflectionAnswers,
    score: scoreBreakdown.objectiveScore,
  });

  // Cegah pengiriman data kembar jika tidak ada perubahan
  if (jsonSignature === _lastLKPDJson) {
    return;
  }
  _lastLKPDJson = jsonSignature;

  const record: LKPDSubmissionRecord = {
    id: generateUUID(),
    student_name: name,
    student_class: cls,
    student_absent: absent,
    lab_solved_ids: state.labSolvedIds,
    quiz_answers: state.quizAnswers,
    reflection_answers: state.reflectionAnswers,
    objective_score: scoreBreakdown.objectiveScore,
    submitted_at: state.completedAt || new Date().toISOString(),
  };

  // 1. Simpan lokal
  saveLocalLKPD(record);

  // 2. Sync asinkron ke Supabase
  if (isSupabaseConfigured()) {
    Promise.resolve().then(async () => {
      try {
        const client = getSupabase();
        if (!client) return;
        const { error } = await client.from('lkpd_submissions').insert([record]);
        if (error) {
          console.warn('[SyncService] Supabase LKPD sync error:', error.message);
        } else {
          console.info('[SyncService] LKPD berhasil tersimpan di Supabase Cloud:', name);
        }
      } catch (err) {
        console.warn('[SyncService] Gagal sync LKPD ke Supabase:', err);
      }
    });
  }
}

// ==============================================================================
// SYNCHRONIZATION: PUSH LOCAL TO SUPABASE CLOUD
// ==============================================================================

/**
 * Mengunggah seluruh data lokal yang ada di browser saat ini ke Supabase Cloud.
 * Digunakan agar data yang pernah dimainkan di perangkat ini langsung tersinkronkan
 * dan dapat diakses dari perangkat lain (HP/laptop guru).
 */
export async function syncLocalDataToSupabase(): Promise<{
  sessionsSynced: number;
  lkpdSynced: number;
  error?: string;
}> {
  const client = getSupabase();
  if (!client) {
    return { sessionsSynced: 0, lkpdSynced: 0, error: 'Supabase belum terkonfigurasi' };
  }

  let sessionsSynced = 0;
  let lkpdSynced = 0;

  try {
    const localSessions = getLocalSessions();
    if (localSessions.length > 0) {
      const { data: remoteRows } = await client
        .from('student_sessions')
        .select('id')
        .limit(1000);

      const remoteIds = new Set((remoteRows || []).map((r) => r.id));

      const toUpload = localSessions
        .filter((s) => !remoteIds.has(s.id))
        .map((s) => ({
          ...s,
          id: isValidUUID(s.id) ? s.id : generateUUID(),
        }));

      if (toUpload.length > 0) {
        const { error: insertErr } = await client.from('student_sessions').insert(toUpload);
        if (insertErr) {
          console.warn('[SyncService] Gagal upload sesi lokal ke Supabase:', insertErr.message);
        } else {
          sessionsSynced = toUpload.length;
          console.info(`[SyncService] Berhasil mengunggah ${sessionsSynced} sesi lokal ke Supabase`);
        }
      }
    }

    const localLKPD = getLocalLKPDSubmissions();
    if (localLKPD.length > 0) {
      const { data: remoteLKPD } = await client
        .from('lkpd_submissions')
        .select('id')
        .limit(1000);

      const remoteLKPDIds = new Set((remoteLKPD || []).map((r) => r.id));

      const toUploadLKPD = localLKPD
        .filter((l) => !remoteLKPDIds.has(l.id))
        .map((l) => ({
          ...l,
          id: isValidUUID(l.id) ? l.id : generateUUID(),
        }));

      if (toUploadLKPD.length > 0) {
        const { error: insertErr } = await client.from('lkpd_submissions').insert(toUploadLKPD);
        if (insertErr) {
          console.warn('[SyncService] Gagal upload LKPD lokal ke Supabase:', insertErr.message);
        } else {
          lkpdSynced = toUploadLKPD.length;
          console.info(`[SyncService] Berhasil mengunggah ${lkpdSynced} LKPD lokal ke Supabase`);
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[SyncService] Exception saat sync lokal ke Supabase:', msg);
    return { sessionsSynced, lkpdSynced, error: msg };
  }

  return { sessionsSynced, lkpdSynced };
}

// ==============================================================================
// FETCHING & MERGING FOR TEACHER DASHBOARD
// ==============================================================================

export async function fetchAllSessions(): Promise<StudentSessionRecord[]> {
  const local = getLocalSessions();
  const client = getSupabase();

  if (!client) return local;

  try {
    const { data, error } = await client
      .from('student_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (error || !data) {
      console.warn('[SyncService] Supabase fetch error:', error);
      return local;
    }

    // Gabungkan data dari remote dan local, hindari duplikasi ID
    const remoteIds = new Set(data.map((d) => d.id));
    const merged = [...data, ...local.filter((l) => !remoteIds.has(l.id))];
    return merged;
  } catch {
    return local;
  }
}

export async function fetchAllLKPD(): Promise<LKPDSubmissionRecord[]> {
  const local = getLocalLKPDSubmissions();
  const client = getSupabase();

  if (!client) return local;

  try {
    const { data, error } = await client
      .from('lkpd_submissions')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(300);

    if (error || !data) {
      return local;
    }

    const remoteIds = new Set(data.map((d) => d.id));
    const merged = [...data, ...local.filter((l) => !remoteIds.has(l.id))];
    return merged;
  } catch {
    return local;
  }
}

let _cachedUnifiedData: UnifiedStudentRow[] | null = null;
let _lastUnifiedFetch = 0;

/**
 * Menggabungkan data sesi bermain dan LKPD siswa ke dalam satu tabel terpadu.
 * Dilengkapi cache memori 4 detik untuk mereduksi beban query REST ke Supabase.
 */
export async function getUnifiedStudentData(force = false): Promise<UnifiedStudentRow[]> {
  const now = Date.now();
  if (!force && _cachedUnifiedData && now - _lastUnifiedFetch < 4000) {
    return _cachedUnifiedData;
  }

  const [sessions, lkpdList] = await Promise.all([fetchAllSessions(), fetchAllLKPD()]);

  // Indexing map berdasarkan Nama + Kelas
  const studentMap = new Map<string, UnifiedStudentRow>();

  const makeKey = (name: string, cls: string) => `${name.toLowerCase().trim()}_${cls.toLowerCase().trim()}`;

  // Masukkan sesi game
  for (const s of sessions) {
    const key = makeKey(s.student_name, s.student_class);
    const existing = studentMap.get(key);

    if (!existing) {
      studentMap.set(key, {
        student_name: s.student_name,
        student_class: s.student_class,
        student_absent: s.student_absent,
        character_id: s.character_id,
        difficulty: s.difficulty,
        stage_reached: s.stage_reached,
        won: s.won,
        score: s.score,
        accuracy: s.accuracy,
        best_combo: s.best_combo,
        play_duration_seconds: s.play_duration_seconds,
        last_played_at: s.created_at,
        lkpd_submitted: false,
        lkpd_score: null,
        lkpd_lab_count: 0,
        lkpd_submitted_at: null,
      });
    } else {
      // Perbarui jika skor atau stage lebih tinggi
      if (s.score > existing.score) {
        existing.score = s.score;
        existing.accuracy = s.accuracy;
        existing.best_combo = Math.max(existing.best_combo, s.best_combo);
      }
      if (s.stage_reached > existing.stage_reached) {
        existing.stage_reached = s.stage_reached;
      }
      if (s.won) {
        existing.won = true;
      }
    }
  }

  // Masukkan LKPD
  for (const l of lkpdList) {
    const key = makeKey(l.student_name, l.student_class);
    const existing = studentMap.get(key);

    if (existing) {
      existing.lkpd_submitted = true;
      existing.lkpd_score = l.objective_score;
      existing.lkpd_lab_count = Array.isArray(l.lab_solved_ids) ? l.lab_solved_ids.length : 0;
      existing.lkpd_submitted_at = l.submitted_at;
      existing.lab_solved_ids = l.lab_solved_ids;
      existing.reflection_answers = l.reflection_answers;
      existing.quiz_answers = l.quiz_answers;
      if (existing.student_absent === '-' && l.student_absent !== '-') {
        existing.student_absent = l.student_absent;
      }
    } else {
      studentMap.set(key, {
        student_name: l.student_name,
        student_class: l.student_class,
        student_absent: l.student_absent,
        character_id: '-',
        difficulty: '-',
        stage_reached: 0,
        won: false,
        score: 0,
        accuracy: 0,
        best_combo: 0,
        play_duration_seconds: 0,
        last_played_at: l.submitted_at,
        lkpd_submitted: true,
        lkpd_score: l.objective_score,
        lkpd_lab_count: Array.isArray(l.lab_solved_ids) ? l.lab_solved_ids.length : 0,
        lkpd_submitted_at: l.submitted_at,
        lab_solved_ids: l.lab_solved_ids,
        reflection_answers: l.reflection_answers,
        quiz_answers: l.quiz_answers,
      });
    }
  }

  const result = Array.from(studentMap.values()).sort((a, b) => {
    // Urutkan berdasarkan waktu terakhir
    const timeA = new Date(a.lkpd_submitted_at || a.last_played_at).getTime();
    const timeB = new Date(b.lkpd_submitted_at || b.last_played_at).getTime();
    return timeB - timeA;
  });

  _cachedUnifiedData = result;
  _lastUnifiedFetch = now;
  return result;
}

