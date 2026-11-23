import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  UnifiedStudentRow,
  getUnifiedStudentData,
  syncLocalDataToSupabase,
} from '../../lib/syncService';
import {
  isSupabaseConfigured,
  getSupabase,
  getSupabaseCredentials,
  saveSupabaseCredentials,
  clearSupabaseCredentials,
} from '../../lib/supabase';
import {
  LKPD_QUIZ_QUESTIONS,
  LKPD_REFLECTION_PROMPTS,
  LKPD_LAB_CHALLENGES,
} from '../../game/lkpd';
import { getColorDef } from '../../game/colors';
import {
  Search,
  Download,
  RefreshCw,
  ArrowLeft,
  X,
  Settings,
  Check,
  LogOut,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Trophy,
  BookOpen,
  Gamepad2,
  CloudUpload,
  Users,
  Clock,
  Award,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToGame: () => void;
  onLogout?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBackToGame,
  onLogout,
}) => {
  const [students, setStudents] = useState<UnifiedStudentRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [activeStudent, setActiveStudent] = useState<UnifiedStudentRow | null>(null);

  // Modal Pengaturan Supabase
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [dbUrl, setDbUrl] = useState<string>('');
  const [dbKey, setDbKey] = useState<string>('');
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  const supabaseActive = isSupabaseConfigured();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getUnifiedStudentData(true);
      setStudents(data);
    } catch (err) {
      console.warn('[AdminDashboard] Gagal memuat data siswa:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sinkronisasi manual data lokal ke cloud
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncLocalDataToSupabase();
      if (res.error) {
        setSyncToast(`Pemberitahuan: ${res.error}`);
      } else if (res.sessionsSynced > 0 || res.lkpdSynced > 0) {
        setSyncToast(`Berhasil mengunggah ${res.sessionsSynced} sesi & ${res.lkpdSynced} LKPD ke Supabase Cloud!`);
      } else {
        setSyncToast('Semua data lokal di browser ini sudah tersinkronkan ke Supabase Cloud.');
      }
      await loadData();
    } catch (err) {
      console.warn('[AdminDashboard] Sync manual error:', err);
      setSyncToast('Gagal menyinkronkan data ke Cloud.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncToast(null), 4500);
    }
  };

  useEffect(() => {
    // 1. Jalankan auto-sync saat halaman pertama dibuka untuk memastikan data lokal terunggah ke Supabase
    const initialSync = async () => {
      try {
        const res = await syncLocalDataToSupabase();
        if (res.sessionsSynced > 0 || res.lkpdSynced > 0) {
          setSyncToast(`${res.sessionsSynced + res.lkpdSynced} data lokal otomatis disinkronkan ke Supabase Cloud.`);
          setTimeout(() => setSyncToast(null), 4000);
        }
      } catch (err) {
        console.warn('[AdminDashboard] Auto-sync initial error:', err);
      }
      loadData();
    };

    initialSync();

    // 2. Supabase Realtime Listener jika terhubung
    const client = getSupabase();
    if (!client) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const triggerDebouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadData();
      }, 1500);
    };

    const channel = client
      .channel('admin_live_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'student_sessions' },
        triggerDebouncedLoad
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lkpd_submissions' },
        triggerDebouncedLoad
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      client.removeChannel(channel);
    };
  }, [loadData]);

  // Modal konfigurasi database
  const handleOpenConfig = () => {
    const creds = getSupabaseCredentials();
    setDbUrl(creds.url);
    setDbKey(creds.anonKey);
    setConfigSuccessMsg(null);
    setShowConfigModal(true);
  };

  const handleSaveConfig = () => {
    saveSupabaseCredentials(dbUrl, dbKey);
    setConfigSuccessMsg('Kredensial database berhasil disimpan.');
    setTimeout(() => {
      setShowConfigModal(false);
      handleManualSync();
    }, 900);
  };

  const handleClearConfig = () => {
    clearSupabaseCredentials();
    setDbUrl('');
    setDbKey('');
    setConfigSuccessMsg('Kredensial database telah dihapus.');
    setTimeout(() => {
      setShowConfigModal(false);
      loadData();
    }, 900);
  };

  // Daftar kelas unik untuk filter
  const classList = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.student_class && s.student_class !== '-') set.add(s.student_class);
    });
    return Array.from(set).sort();
  }, [students]);

  // Filter siswa
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.student_name.toLowerCase().includes(q) ||
        s.student_class.toLowerCase().includes(q);

      const matchClass = selectedClass === 'all' || s.student_class === selectedClass;

      let matchStatus = true;
      if (selectedStatus === 'won') matchStatus = s.won;
      else if (selectedStatus === 'lkpd_done') matchStatus = s.lkpd_submitted;
      else if (selectedStatus === 'lkpd_pending') matchStatus = !s.lkpd_submitted;

      return matchSearch && matchClass && matchStatus;
    });
  }, [students, searchQuery, selectedClass, selectedStatus]);

  // Statistik Ringkasan
  const stats = useMemo(() => {
    const total = students.length;
    if (total === 0) {
      return { total: 0, avgScore: 0, avgLkpd: 0, wonCount: 0, wonRate: 0 };
    }

    const playedStudents = students.filter((s) => s.score > 0 || s.stage_reached > 0);
    const avgScore =
      playedStudents.length > 0
        ? Math.round(
            playedStudents.reduce((acc, s) => acc + s.score, 0) / playedStudents.length
          )
        : 0;

    const lkpdStudents = students.filter((s) => s.lkpd_submitted && s.lkpd_score !== null);
    const avgLkpd =
      lkpdStudents.length > 0
        ? Math.round(
            lkpdStudents.reduce((acc, s) => acc + (s.lkpd_score || 0), 0) /
              lkpdStudents.length
          )
        : 0;

    const wonCount = students.filter((s) => s.won).length;
    const wonRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;

    return { total, avgScore, avgLkpd, wonCount, wonRate };
  }, [students]);

  // Ekspor Rekap Spreadsheet CSV
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) return;

    const headers = [
      'No',
      'Nama Siswa',
      'Kelas',
      'Karakter',
      'Stage Tercapai',
      'Status Permainan',
      'Skor Akhir',
      'Akurasi (%)',
      'Kombo Tertinggi',
      'Durasi Bermain (Detik)',
      'Status LKPD',
      'Nilai LKPD (0-100)',
      'Tantangan Lab Diselesaikan',
      'Waktu Tercatat',
    ];

    const rows = filteredStudents.map((s, idx) => [
      idx + 1,
      `"${s.student_name.replace(/"/g, '""')}"`,
      `"${(s.student_class || '-').replace(/"/g, '""')}"`,
      `"${s.character_id}"`,
      s.stage_reached,
      s.won ? 'Tamat (Menang)' : s.stage_reached > 0 ? 'Sedang/Gugur' : 'Baru Mulai',
      s.score,
      s.accuracy,
      s.best_combo,
      s.play_duration_seconds,
      s.lkpd_submitted ? 'Terkumpul' : 'Belum',
      s.lkpd_score !== null ? s.lkpd_score : '-',
      s.lkpd_lab_count,
      s.lkpd_submitted_at || s.last_played_at || '-',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap_color_mission_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full min-h-screen bg-[#060913] text-slate-100 flex flex-col font-sans select-text antialiased">
      {/* Toast Notifikasi Sinkronisasi */}
      {syncToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-cyan-950/95 border border-cyan-400/40 text-cyan-200 text-xs sm:text-sm font-semibold shadow-2xl flex items-center gap-2.5 animate-bounce">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* ====================================================================
          HEADER UTAMA (BERSIH, MODERN, RESPONSIF)
         ==================================================================== */}
      <header className="border-b border-white/10 bg-[#090e1c]/95 backdrop-blur-md px-4 sm:px-8 py-3 sticky top-0 z-40">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Logo & Judul Dashboard */}
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onBackToGame}
                title="Kembali ke Permainan"
                className="px-2.5 py-1.5 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 text-xs font-semibold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Ke Game</span>
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                    <GraduationCap className="w-3.5 h-3.5" />
                  </div>
                  <h1 className="text-sm sm:text-base font-black text-white tracking-tight uppercase leading-tight truncate">
                    Panel Guru · Color Mission
                  </h1>
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      supabaseActive
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        supabaseActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                      }`}
                    />
                    {supabaseActive ? 'Cloud Supabase Aktif' : 'Penyimpanan Lokal'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tombol Logout Mobile */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Keluar"
                className="sm:hidden p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action Toolbar di Header */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 shrink-0">
            {/* Tombol Sinkronkan Data Lokal ke Cloud */}
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              title="Unggah semua data lokal yang ada di browser ini ke Supabase Cloud"
              className="h-9 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <CloudUpload className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce text-cyan-200' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sync ke Cloud'}</span>
            </button>

            {/* Segarkan */}
            <button
              type="button"
              onClick={loadData}
              title="Segarkan Data Terbaru"
              disabled={isLoading}
              className="h-9 px-3 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden md:inline">Segarkan</span>
            </button>

            {/* Ekspor CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              title="Unduh Rekap Spreadsheet (.CSV)"
              disabled={filteredStudents.length === 0}
              className="h-9 px-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-black uppercase tracking-wide flex items-center gap-1.5 transition-all cursor-pointer shadow-md shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ekspor CSV</span>
            </button>

            {/* Pengaturan Supabase */}
            <button
              type="button"
              onClick={handleOpenConfig}
              title="Pengaturan Kredensial Database"
              className="h-9 w-9 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Logout Desktop */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Keluar / Logout Akun Admin"
                className="hidden sm:flex h-9 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 text-xs font-semibold items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ====================================================================
          METRICS CARDS: 4 KOTAK RINGKASAN DATA KONTRASTING
         ==================================================================== */}
      <section className="px-4 sm:px-8 pt-5 pb-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Siswa */}
          <div className="bg-[#0b1020] border border-white/10 rounded-2xl p-3.5 sm:p-4.5 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Partisipan</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black tabular-nums text-white">
              {stats.total}
              <span className="text-xs text-slate-500 font-normal ml-1.5">Siswa</span>
            </div>
          </div>

          {/* Card 2: Tamat / Kelulusan */}
          <div className="bg-[#0b1020] border border-white/10 rounded-2xl p-3.5 sm:p-4.5 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Tamat Permainan</span>
              <Trophy className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black tabular-nums text-amber-300">
              {stats.wonRate}%
              <span className="text-xs text-slate-500 font-normal ml-1.5">
                ({stats.wonCount} tamat)
              </span>
            </div>
          </div>

          {/* Card 3: Rata-rata Skor Game */}
          <div className="bg-[#0b1020] border border-white/10 rounded-2xl p-3.5 sm:p-4.5 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Rerata Skor Game</span>
              <Gamepad2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black tabular-nums text-cyan-400">
              {stats.avgScore.toLocaleString('id-ID')}
            </div>
          </div>

          {/* Card 4: Rata-rata Nilai LKPD */}
          <div className="bg-[#0b1020] border border-white/10 rounded-2xl p-3.5 sm:p-4.5 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Rerata Nilai LKPD</span>
              <BookOpen className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black tabular-nums text-emerald-400">
              {stats.avgLkpd}
              <span className="text-xs text-slate-500 font-normal ml-1"> / 100</span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          TOOLBAR PENCARIAN & FILTER
         ==================================================================== */}
      <section className="px-4 sm:px-8 py-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-[#090e1c] border border-white/10 rounded-2xl p-2.5 sm:p-3">
          {/* Kolom Cari */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan nama siswa atau kelas..."
              className="w-full h-9 pl-9 pr-8 rounded-xl bg-[#060913] border border-white/10 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-2">
            {classList.length > 0 && (
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="h-9 px-3 rounded-xl bg-[#060913] border border-white/10 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="all">Semua Kelas ({classList.length})</option>
                {classList.map((cls) => (
                  <option key={cls} value={cls}>
                    Kelas {cls}
                  </option>
                ))}
              </select>
            )}

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 px-3 rounded-xl bg-[#060913] border border-white/10 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="won">Tamat (Menang)</option>
              <option value="lkpd_done">LKPD Terkumpul</option>
              <option value="lkpd_pending">LKPD Belum</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 mt-2 text-[11px] text-slate-400">
          <span>
            Menampilkan <strong className="text-white">{filteredStudents.length}</strong> dari{' '}
            <strong className="text-white">{students.length}</strong> siswa
          </span>
          {isLoading && (
            <span className="text-cyan-400 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Memuat data...
            </span>
          )}
        </div>
      </section>

      {/* ====================================================================
          DAFTAR SISWA: DUAL VIEW (MOBILE CARD LIST + DESKTOP SLEEK TABLE)
         ==================================================================== */}
      <main className="flex-1 px-4 sm:px-8 py-2">
        {/* TAMPILAN 1: MOBILE CARD LIST (Layar HP / Tablet Vertikal) */}
        <div className="block md:hidden flex flex-col gap-3">
          {filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm bg-[#090e1c] border border-white/10 rounded-2xl">
              {isLoading ? 'Sedang memuat data siswa...' : 'Belum ada data siswa yang cocok.'}
            </div>
          ) : (
            filteredStudents.map((s, idx) => (
              <div
                key={`m_${s.student_name}_${s.student_class}_${idx}`}
                className="bg-[#0b1020] border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-md"
              >
                {/* Header Kartu Siswa */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono text-slate-500 block mb-0.5">
                      #{idx + 1}
                    </span>
                    <h3 className="text-base font-bold text-white truncate leading-tight">
                      {s.student_name}
                    </h3>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-cyan-300 text-xs font-bold shrink-0 border border-white/10">
                    {s.student_class && s.student_class !== '-' ? `Kelas ${s.student_class}` : 'Tanpa Kelas'}
                  </span>
                </div>

                {/* Badge Status & Skor */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/6 text-xs">
                  <div className="bg-black/30 p-2 rounded-xl border border-white/6">
                    <span className="text-[10px] text-slate-400 block font-medium">Status Game</span>
                    {s.won ? (
                      <span className="text-emerald-400 font-bold inline-flex items-center gap-1 text-[11px] mt-0.5">
                        <Check className="w-3 h-3" /> Tamat (Menang)
                      </span>
                    ) : s.stage_reached > 0 ? (
                      <span className="text-cyan-300 font-bold text-[11px] mt-0.5 block">
                        Stage {s.stage_reached} · {s.score.toLocaleString('id-ID')} Poin
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">Baru Mulai</span>
                    )}
                  </div>

                  <div className="bg-black/30 p-2 rounded-xl border border-white/6">
                    <span className="text-[10px] text-slate-400 block font-medium">Nilai LKPD</span>
                    {s.lkpd_submitted && s.lkpd_score !== null ? (
                      <span className="text-purple-300 font-black text-sm mt-0.5 block">
                        {s.lkpd_score} <span className="text-[10px] font-normal text-slate-400">/ 100</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 italic text-[11px] mt-0.5 block">Belum Isi</span>
                    )}
                  </div>
                </div>

                {/* Tombol Detail Full Width */}
                <button
                  type="button"
                  onClick={() => setActiveStudent(s)}
                  className="w-full h-10 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer mt-1"
                >
                  <span>Lihat Detail Lengkap</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* TAMPILAN 2: DESKTOP TABEL PROFESIONAL (Layar Laptop / Monitor) */}
        <div className="hidden md:block border border-white/10 rounded-2xl bg-[#090e1c] overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-[#0d1428] text-slate-300 uppercase font-black tracking-wider text-[11px]">
                <th className="py-4 px-4 w-14 text-center">No</th>
                <th className="py-4 px-5">Nama Siswa</th>
                <th className="py-4 px-4">Kelas</th>
                <th className="py-4 px-4">Capaian Game 3D</th>
                <th className="py-4 px-4">Hasil LKPD</th>
                <th className="py-4 px-4">Waktu Tercatat</th>
                <th className="py-4 px-4 text-center w-32">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-slate-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-400 text-sm">
                    {isLoading ? 'Sedang memuat data dari Supabase Cloud...' : 'Belum ada data siswa tercatat.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => (
                  <tr
                    key={`d_${s.student_name}_${s.student_class}_${idx}`}
                    className="hover:bg-white/[0.04] transition-colors"
                  >
                    <td className="py-4 px-4 text-center text-slate-500 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-4 px-5 font-bold text-white text-sm">
                      {s.student_name}
                    </td>
                    <td className="py-4 px-4 text-slate-300">
                      {s.student_class && s.student_class !== '-' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-white/6 border border-white/10 font-bold text-xs text-cyan-300">
                          {s.student_class}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic text-xs">Tanpa Kelas</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {s.won ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                            <Check className="w-3 h-3" />
                            <span>Tamat (Boss Menang)</span>
                          </span>
                        ) : s.stage_reached > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold">
                            <span>Stage {s.stage_reached}</span>
                            <span className="text-slate-500">·</span>
                            <span>{s.score.toLocaleString('id-ID')} Pts</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Baru Mulai</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {s.lkpd_submitted && s.lkpd_score !== null ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 text-xs font-black">
                          Nilai: {s.lkpd_score}/100
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs italic">Belum Mengisi</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-slate-400 text-[11px]">
                      {s.lkpd_submitted_at || s.last_played_at
                        ? new Date(s.lkpd_submitted_at || s.last_played_at!).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setActiveStudent(s)}
                        className="px-3.5 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm inline-flex items-center gap-1.5"
                      >
                        <span>Detail</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* ====================================================================
          MODAL DETAIL LENGKAP SISWA (LEGA, TERSUSUN, ANTI AI-SLOP)
         ==================================================================== */}
      {activeStudent && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-3xl bg-[#090e1c] border border-white/15 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto">
            {/* Header Modal Detail */}
            <div className="p-5 sm:p-6 border-b border-white/10 bg-[#060a14] flex items-center justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight truncate">
                    {activeStudent.student_name}
                  </h3>
                  <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-bold shrink-0 border border-cyan-500/30">
                    {activeStudent.student_class && activeStudent.student_class !== '-'
                      ? `Kelas ${activeStudent.student_class}`
                      : 'Tanpa Kelas'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Waktu Tercatat:{' '}
                  {activeStudent.lkpd_submitted_at || activeStudent.last_played_at
                    ? new Date(
                        activeStudent.lkpd_submitted_at || activeStudent.last_played_at
                      ).toLocaleString('id-ID', {
                        dateStyle: 'full',
                        timeStyle: 'medium',
                      })
                    : '-'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveStudent(null)}
                title="Tutup Papan"
                className="p-2 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Konten Detail Siswa: Scrollable */}
            <div className="p-5 sm:p-6 overflow-y-auto flex flex-col gap-5 text-xs">
              {/* Seksi 1: Performa Game 3D */}
              <div className="bg-[#0c1222] border border-white/10 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3 text-cyan-400 font-black uppercase tracking-wider text-xs">
                  <Gamepad2 className="w-4 h-4" />
                  <span>Capaian Permainan Game 3D</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
                  <div className="bg-black/30 p-3 rounded-xl border border-white/6">
                    <span className="text-slate-400 block text-[11px] font-medium">Skor Akhir</span>
                    <span className="text-lg font-black text-cyan-300 tabular-nums">
                      {activeStudent.score.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="bg-black/30 p-3 rounded-xl border border-white/6">
                    <span className="text-slate-400 block text-[11px] font-medium">Stage Terakhir</span>
                    <span className="text-sm font-bold text-white block mt-1">
                      {activeStudent.won
                        ? 'Tamat (Boss Menang)'
                        : activeStudent.stage_reached > 0
                        ? `Stage ${activeStudent.stage_reached}`
                        : '-'}
                    </span>
                  </div>

                  <div className="bg-black/30 p-3 rounded-xl border border-white/6">
                    <span className="text-slate-400 block text-[11px] font-medium">Akurasi Tembakan</span>
                    <span className="text-lg font-black text-emerald-300 tabular-nums">
                      {activeStudent.accuracy}%
                    </span>
                  </div>

                  <div className="bg-black/30 p-3 rounded-xl border border-white/6">
                    <span className="text-slate-400 block text-[11px] font-medium">Kombo Maksimum</span>
                    <span className="text-lg font-black text-amber-300 tabular-nums">
                      {activeStudent.best_combo}x
                    </span>
                  </div>

                  <div className="bg-black/30 p-3 rounded-xl border border-white/6">
                    <span className="text-slate-400 block text-[11px] font-medium">Agen Karakter</span>
                    <span className="text-xs font-bold text-white capitalize block mt-1">
                      {activeStudent.character_id === 'naya' ? 'Agen Rana' : 'Agen Raka'}
                    </span>
                  </div>

                  <div className="bg-black/30 p-3 rounded-xl border border-white/6">
                    <span className="text-slate-400 block text-[11px] font-medium">Tingkat Kesulitan</span>
                    <span className="text-xs font-bold text-white capitalize block mt-1">
                      {activeStudent.difficulty}
                    </span>
                  </div>

                  <div className="bg-black/30 p-3 rounded-xl border border-white/6 col-span-2">
                    <span className="text-slate-400 block text-[11px] font-medium">Durasi Bermain</span>
                    <span className="text-xs font-bold text-white block mt-1">
                      {Math.floor(activeStudent.play_duration_seconds / 60)} Menit{' '}
                      {activeStudent.play_duration_seconds % 60} Detik
                    </span>
                  </div>
                </div>
              </div>

              {/* Seksi 2: Nilai & Evaluasi LKPD */}
              <div className="bg-[#0c1222] border border-white/10 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/8">
                  <div className="flex items-center gap-2 text-emerald-400 font-black uppercase tracking-wider text-xs">
                    <BookOpen className="w-4 h-4" />
                    <span>Lembar Kerja Siswa (LKPD)</span>
                  </div>
                  {activeStudent.lkpd_submitted && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">Nilai Total:</span>
                      <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black text-sm tabular-nums">
                        {activeStudent.lkpd_score}/100
                      </span>
                    </div>
                  )}
                </div>

                {!activeStudent.lkpd_submitted ? (
                  <p className="text-slate-400 italic py-3 text-center">
                    Siswa belum mengisi atau mengumpulkan lembar kerja (LKPD).
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* A. Eksperimen Lab RYB */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        1. Eksperimen Lab Campur Warna (RYB)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {LKPD_LAB_CHALLENGES.map((ch) => {
                          const isSolved = (activeStudent.lab_solved_ids || []).includes(
                            ch.targetColorId
                          );
                          const colorDef = getColorDef(ch.targetColorId);

                          return (
                            <div
                              key={ch.id}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                                isSolved
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                                  : 'bg-white/4 border-white/8 text-slate-400'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-4 h-4 rounded-md border border-white/50 shrink-0"
                                  style={{ backgroundColor: colorDef.hex }}
                                />
                                <span className="font-semibold text-xs truncate">
                                  {colorDef.nameId}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold shrink-0">
                                {isSolved ? '✔ Berhasil' : 'Belum'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* B. Kuis Pilihan Ganda */}
                    <div className="pt-2">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        2. Jawaban Kuis Pilihan Ganda
                      </h4>
                      <div className="flex flex-col gap-2.5">
                        {LKPD_QUIZ_QUESTIONS.map((q, idx) => {
                          const studentAnswerId = activeStudent.quiz_answers?.[q.id];
                          const isCorrect = studentAnswerId === q.correctOptionId;
                          const studentOption = q.options.find(
                            (opt) => opt.id === studentAnswerId
                          );
                          const correctOption = q.options.find(
                            (opt) => opt.id === q.correctOptionId
                          );

                          return (
                            <div
                              key={q.id}
                              className="bg-black/30 rounded-xl p-3 border border-white/6 flex flex-col gap-1.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-bold text-white text-xs">
                                  {idx + 1}. {q.question}
                                </span>
                                {studentAnswerId ? (
                                  isCorrect ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-md shrink-0 border border-emerald-500/30">
                                      <CheckCircle2 className="w-3 h-3" /> Benar
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/15 px-2 py-0.5 rounded-md shrink-0 border border-red-500/30">
                                      <XCircle className="w-3 h-3" /> Salah
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[11px] text-slate-500 italic shrink-0">
                                    Tidak Dijawab
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-slate-300 mt-0.5">
                                <span className="text-slate-400">Jawaban Siswa: </span>
                                <span
                                  className={
                                    isCorrect ? 'text-emerald-300 font-bold' : 'text-red-300 font-bold'
                                  }
                                >
                                  {studentOption ? studentOption.label : '-'}
                                </span>
                                {!isCorrect && correctOption && (
                                  <span className="text-slate-400 ml-2">
                                    (Kunci: <strong className="text-white">{correctOption.label}</strong>)
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* C. Refleksi Pembelajaran */}
                    <div className="pt-2">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        3. Refleksi Pembelajaran Siswa (Esai)
                      </h4>
                      <div className="flex flex-col gap-2.5">
                        {LKPD_REFLECTION_PROMPTS.map((prompt, idx) => {
                          const studentEssay =
                            activeStudent.reflection_answers?.[prompt.id] ||
                            activeStudent.reflection_answers?.['ref_kesan'] ||
                            activeStudent.reflection_answers?.['ref_1_kategori'] ||
                            activeStudent.reflection_answers?.[`q${idx + 1}`];

                          return (
                            <div
                              key={prompt.id}
                              className="bg-black/35 rounded-xl p-3 border border-white/8 flex flex-col gap-1.5"
                            >
                              <span className="font-bold text-slate-300 text-xs">
                                {prompt.question}
                              </span>
                              <div className="p-2.5 rounded-lg bg-black/40 border border-white/6 text-slate-200 leading-relaxed whitespace-pre-wrap text-xs">
                                {studentEssay && studentEssay.trim().length > 0 ? (
                                  `"${studentEssay.trim()}"`
                                ) : (
                                  <span className="text-slate-500 italic">
                                    (Siswa tidak mengisi jawaban esai ini)
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Modal Detail */}
            <div className="p-4 bg-[#060a14] border-t border-white/10 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setActiveStudent(null)}
                className="px-6 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
              >
                Tutup Papan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL PENGATURAN SUPABASE
         ==================================================================== */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1020] border border-white/15 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white uppercase tracking-tight">
                Pengaturan Database Supabase
              </h3>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-3 leading-relaxed">
              Masukkan kredensial project Supabase Anda jika ingin mengubah pengaturan secara manual.
            </p>

            <div className="mt-4 flex flex-col gap-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Project URL (VITE_SUPABASE_URL)
                </label>
                <input
                  type="text"
                  value={dbUrl}
                  onChange={(e) => setDbUrl(e.target.value)}
                  placeholder="https://mjsvvbhaejiwjqlqplgp.supabase.co"
                  className="w-full h-10 px-3 rounded-xl bg-[#070b14] border border-white/12 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Anon Public Key (VITE_SUPABASE_ANON_KEY)
                </label>
                <input
                  type="password"
                  value={dbKey}
                  onChange={(e) => setDbKey(e.target.value)}
                  placeholder="eyJhbGciOi..."
                  className="w-full h-10 px-3 rounded-xl bg-[#070b14] border border-white/12 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono text-xs"
                />
              </div>

              {configSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{configSuccessMsg}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleClearConfig}
                className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold cursor-pointer transition-colors"
              >
                Hapus
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-white/6 hover:bg-white/10 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold cursor-pointer transition-all"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
