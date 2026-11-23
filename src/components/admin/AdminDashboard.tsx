import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  UnifiedStudentRow,
  getUnifiedStudentData,
  syncLocalDataToSupabase,
} from '../../lib/syncService';
import { getSupabase } from '../../lib/supabase';
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
  Check,
  LogOut,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Trophy,
  BookOpen,
  Gamepad2,
  Users,
  GraduationCap,
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [activeStudent, setActiveStudent] = useState<UnifiedStudentRow | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Sinkronkan data lokal ke cloud di latar belakang tanpa mengganggu tampilan
      await syncLocalDataToSupabase().catch(() => {});
      const data = await getUnifiedStudentData(true);
      setStudents(data);
    } catch (err) {
      console.warn('[AdminDashboard] Gagal memuat data siswa:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Supabase Realtime Listener untuk pembaruan instan
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
      {/* ====================================================================
          HEADER UTAMA (MINIMALIS, BERSIH, HANYA TOMBOL PENTING)
          Area tengah atas sengaja dikosongkan di mobile untuk kamera depan HP / notch
         ==================================================================== */}
      <header className="border-b border-white/10 bg-[#090e1c]/95 backdrop-blur-md px-4 sm:px-8 pt-[max(env(safe-area-inset-top,0px),1.75rem)] sm:pt-4 pb-3 sm:pb-4 sticky top-0 z-40">
        {/* MOBILE LAYOUT: Area tengah atas sengaja dikosongkan untuk kamera depan HP */}
        <div className="flex flex-col sm:hidden w-full gap-2.5">
          {/* Baris 1: Kiri (Ke Game) - Tengah (KOSONG: Kamera Depan) - Kanan (Keluar) */}
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={onBackToGame}
              title="Kembali ke Permainan"
              className="h-9 px-3 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-slate-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Ke Game</span>
            </button>

            {/* AREA TENGAH ATAS: SENGAJA DIKOSONGKAN KARENA AREA KAMERA DEPAN HP / NOTCH */}
            <div className="flex-1 min-w-[70px] pointer-events-none" aria-hidden="true" />

            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                title="Keluar dari Panel Admin"
                className="h-9 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={loadData}
                title="Muat Data Terbaru"
                disabled={isLoading}
                className="h-9 px-3 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
                <span>Segarkan</span>
              </button>
            )}
          </div>

          {/* Baris 2: Judul Panel & Tombol Aksi di bawah area kamera depan */}
          <div className="flex items-center justify-between gap-3 w-full pt-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-400 shrink-0">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-black text-white tracking-tight uppercase leading-tight truncate">
                  Panel Guru
                </h1>
                <p className="text-[10px] text-slate-400 truncate">
                  Rekap Aktivitas &amp; LKPD Siswa
                </p>
              </div>
            </div>

            {/* Tombol Segarkan & Ekspor CSV */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={loadData}
                title="Muat Data Terbaru"
                disabled={isLoading}
                className="h-9 w-9 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-slate-200 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                title="Unduh Rekap Spreadsheet (.CSV)"
                disabled={filteredStudents.length === 0}
                className="h-9 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-slate-950 text-xs font-black uppercase tracking-wide flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* DESKTOP LAYOUT (Horizontal Flex) */}
        <div className="hidden sm:flex items-center justify-between gap-4 w-full">
          {/* Logo & Judul Dashboard */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBackToGame}
              title="Kembali ke Permainan"
              className="h-10 px-3.5 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-slate-200 hover:text-white transition-colors cursor-pointer shrink-0 flex items-center gap-2 text-xs sm:text-sm font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ke Game</span>
            </button>

            <div className="h-6 w-px bg-white/10 shrink-0" />

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-400 shrink-0">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight uppercase leading-tight truncate">
                  Panel Guru
                </h1>
                <p className="text-[11px] text-slate-400 truncate">
                  Rekapitulasi Aktivitas &amp; Evaluasi LKPD Siswa
                </p>
              </div>
            </div>
          </div>

          {/* Action Toolbar Desktop */}
          <div className="flex items-center gap-2.5 justify-end shrink-0">
            <button
              type="button"
              onClick={loadData}
              title="Muat Data Terbaru"
              disabled={isLoading}
              className="h-10 px-3.5 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-slate-200 hover:text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              <span>Segarkan</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              title="Unduh Rekap Spreadsheet (.CSV)"
              disabled={filteredStudents.length === 0}
              className="h-10 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-slate-950 text-xs sm:text-sm font-black uppercase tracking-wide flex items-center gap-2 transition-all cursor-pointer shadow-md shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor CSV</span>
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Keluar dari Panel Admin"
                className="h-10 px-3 sm:px-3.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ====================================================================
          METRICS CARDS: 4 KOTAK RINGKASAN DATA (SPACIOUS & RESPONSIF)
         ==================================================================== */}
      <section className="px-4 sm:px-8 pt-6 pb-2">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Card 1: Total Siswa */}
          <div className="bg-[#0b1020] border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Partisipan</span>
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black tabular-nums text-white">
              {stats.total}
              <span className="text-xs text-slate-400 font-normal ml-2">Siswa</span>
            </div>
          </div>

          {/* Card 2: Tamat / Kelulusan */}
          <div className="bg-[#0b1020] border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Tamat Permainan</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Trophy className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black tabular-nums text-amber-300">
              {stats.wonRate}%
              <span className="text-xs text-slate-400 font-normal ml-2">
                ({stats.wonCount} tamat)
              </span>
            </div>
          </div>

          {/* Card 3: Rata-rata Skor Game */}
          <div className="bg-[#0b1020] border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Rerata Skor Game</span>
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Gamepad2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black tabular-nums text-cyan-400">
              {stats.avgScore.toLocaleString('id-ID')}
              <span className="text-xs text-slate-400 font-normal ml-2">Poin</span>
            </div>
          </div>

          {/* Card 4: Rata-rata Nilai LKPD */}
          <div className="bg-[#0b1020] border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Rerata Nilai LKPD</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black tabular-nums text-emerald-400">
              {stats.avgLkpd}
              <span className="text-xs text-slate-400 font-normal ml-2">/ 100</span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          TOOLBAR PENCARIAN & FILTER (LEGA & MUDAH DIGUNAKAN)
         ==================================================================== */}
      <section className="px-4 sm:px-8 py-3 sm:py-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 bg-[#090e1c] border border-white/10 rounded-2xl p-3 sm:p-4 shadow-md">
          {/* Kolom Cari */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama siswa atau kelas..."
              className="w-full h-11 pl-10 pr-9 rounded-xl bg-[#060913] border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-3">
            {classList.length > 0 && (
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="h-11 px-3.5 rounded-xl bg-[#060913] border border-white/10 text-xs sm:text-sm font-semibold text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer flex-1 md:flex-none"
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
              className="h-11 px-3.5 rounded-xl bg-[#060913] border border-white/10 text-xs sm:text-sm font-semibold text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer flex-1 md:flex-none"
            >
              <option value="all">Semua Status</option>
              <option value="won">Tamat (Menang)</option>
              <option value="lkpd_done">LKPD Terkumpul</option>
              <option value="lkpd_pending">LKPD Belum</option>
            </select>
          </div>
        </div>

        {/* Counter Info */}
        <div className="flex items-center justify-between px-2 mt-2.5 text-xs text-slate-400">
          <span>
            Menampilkan <strong className="text-white font-bold">{filteredStudents.length}</strong> dari{' '}
            <strong className="text-white font-bold">{students.length}</strong> siswa
          </span>
          {isLoading && (
            <span className="text-cyan-400 flex items-center gap-1.5 font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Memuat data...
            </span>
          )}
        </div>
      </section>

      {/* ====================================================================
          DAFTAR SISWA: DUAL VIEW (RESPONSIF MOBILE CARDS + DESKTOP TABLE)
         ==================================================================== */}
      <main className="flex-1 px-4 sm:px-8 py-2 pb-10">
        {/* TAMPILAN 1: MOBILE CARD LIST (Layar HP / Tablet Vertikal) */}
        <div className="block md:hidden flex flex-col gap-3.5">
          {filteredStudents.length === 0 ? (
            <div className="py-14 text-center text-slate-400 text-sm bg-[#090e1c] border border-white/10 rounded-2xl p-6">
              {isLoading ? 'Sedang memuat data siswa...' : 'Belum ada data siswa yang cocok.'}
            </div>
          ) : (
            filteredStudents.map((s, idx) => (
              <div
                key={`m_${s.student_name}_${s.student_class}_${idx}`}
                className="bg-[#0b1020] border border-white/10 rounded-2xl p-5 flex flex-col gap-4 shadow-md"
              >
                {/* Header Kartu Siswa */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[11px] font-mono text-slate-500 block mb-1">
                      #{idx + 1}
                    </span>
                    <h3 className="text-base font-bold text-white truncate leading-tight">
                      {s.student_name}
                    </h3>
                  </div>

                  <span className="px-3 py-1 rounded-lg bg-white/6 text-cyan-300 text-xs font-bold shrink-0 border border-white/10">
                    {s.student_class && s.student_class !== '-' ? `Kelas ${s.student_class}` : 'Tanpa Kelas'}
                  </span>
                </div>

                {/* Badge Status & Skor */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/6 text-xs">
                  <div className="bg-black/30 p-3 rounded-xl border border-white/6">
                    <span className="text-[11px] text-slate-400 block font-medium mb-1">Status Game</span>
                    {s.won ? (
                      <span className="text-emerald-400 font-bold inline-flex items-center gap-1.5 text-xs">
                        <Check className="w-3.5 h-3.5" /> Tamat (Menang)
                      </span>
                    ) : s.stage_reached > 0 ? (
                      <span className="text-cyan-300 font-bold text-xs block">
                        Stage {s.stage_reached} · {s.score.toLocaleString('id-ID')} Poin
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs">Baru Mulai</span>
                    )}
                  </div>

                  <div className="bg-black/30 p-3 rounded-xl border border-white/6">
                    <span className="text-[11px] text-slate-400 block font-medium mb-1">Nilai LKPD</span>
                    {s.lkpd_submitted && s.lkpd_score !== null ? (
                      <span className="text-purple-300 font-black text-sm block">
                        {s.lkpd_score} <span className="text-xs font-normal text-slate-400">/ 100</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 italic text-xs block">Belum Mengisi</span>
                    )}
                  </div>
                </div>

                {/* Tombol Detail Full Width */}
                <button
                  type="button"
                  onClick={() => setActiveStudent(s)}
                  className="w-full h-11 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <span>Lihat Detail Lengkap</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* TAMPILAN 2: DESKTOP TABEL PROFESIONAL (Layar Laptop / Monitor) */}
        <div className="hidden md:block border border-white/10 rounded-2xl bg-[#090e1c] overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-[#0d1428] text-slate-300 uppercase font-black tracking-wider text-[11px] sm:text-xs">
                <th className="py-4.5 px-5 w-16 text-center">No</th>
                <th className="py-4.5 px-6">Nama Siswa</th>
                <th className="py-4.5 px-5">Kelas</th>
                <th className="py-4.5 px-5">Capaian Game 3D</th>
                <th className="py-4.5 px-5">Hasil LKPD</th>
                <th className="py-4.5 px-5">Waktu Tercatat</th>
                <th className="py-4.5 px-5 text-center w-36">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-slate-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 text-sm">
                    {isLoading ? 'Sedang memuat data siswa...' : 'Belum ada data siswa tercatat.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => (
                  <tr
                    key={`d_${s.student_name}_${s.student_class}_${idx}`}
                    className="hover:bg-white/[0.04] transition-colors"
                  >
                    <td className="py-4.5 px-5 text-center text-slate-500 font-mono text-xs">
                      {idx + 1}
                    </td>
                    <td className="py-4.5 px-6 font-bold text-white text-sm">
                      {s.student_name}
                    </td>
                    <td className="py-4.5 px-5 text-slate-300">
                      {s.student_class && s.student_class !== '-' ? (
                        <span className="px-3 py-1 rounded-lg bg-white/6 border border-white/10 font-bold text-xs text-cyan-300">
                          {s.student_class}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic text-xs">Tanpa Kelas</span>
                      )}
                    </td>
                    <td className="py-4.5 px-5">
                      <div className="flex items-center gap-2">
                        {s.won ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                            <Check className="w-3.5 h-3.5" />
                            <span>Tamat (Menang)</span>
                          </span>
                        ) : s.stage_reached > 0 ? (
                          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs font-bold">
                            <span>Stage {s.stage_reached}</span>
                            <span className="text-slate-500">·</span>
                            <span>{s.score.toLocaleString('id-ID')} Poin</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">Baru Mulai</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4.5 px-5">
                      {s.lkpd_submitted && s.lkpd_score !== null ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 text-xs font-black">
                          Nilai: {s.lkpd_score}/100
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs italic">Belum Mengisi</span>
                      )}
                    </td>
                    <td className="py-4.5 px-5 text-slate-400 text-xs">
                      {s.lkpd_submitted_at || s.last_played_at
                        ? new Date(s.lkpd_submitted_at || s.last_played_at!).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </td>
                    <td className="py-4.5 px-5 text-center">
                      <button
                        type="button"
                        onClick={() => setActiveStudent(s)}
                        className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm inline-flex items-center gap-1.5"
                      >
                        <span>Detail</span>
                        <ExternalLink className="w-3.5 h-3.5" />
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
          MODAL DETAIL LENGKAP SISWA (SPACIOUS, LEGA, PROFESIONAL)
         ==================================================================== */}
      {activeStudent && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-3xl bg-[#090e1c] border border-white/15 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto">
            {/* Header Modal Detail */}
            <div className="p-5 sm:p-6 border-b border-white/10 bg-[#060a14] flex items-center justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight truncate">
                    {activeStudent.student_name}
                  </h3>
                  <span className="px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-bold shrink-0 border border-cyan-500/30">
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
                className="p-2.5 rounded-xl bg-white/6 hover:bg-white/12 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Konten Detail Siswa: Scrollable */}
            <div className="p-5 sm:p-6 overflow-y-auto flex flex-col gap-6 text-xs sm:text-sm">
              {/* Seksi 1: Performa Game 3D */}
              <div className="bg-[#0c1222] border border-white/10 rounded-2xl p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-4 text-cyan-400 font-black uppercase tracking-wider text-xs">
                  <Gamepad2 className="w-4 h-4" />
                  <span>Capaian Permainan Game 3D</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-slate-300">
                  <div className="bg-black/30 p-3.5 rounded-xl border border-white/6">
                    <span className="text-slate-400 block text-xs font-medium mb-1">Skor Akhir</span>
                    <span className="text-xl font-black text-cyan-300 tabular-nums">
                      {activeStudent.score.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="bg-black/30 p-3.5 rounded-xl border border-white/6">
                    <span className="text-slate-400 block text-xs font-medium mb-1">Stage Terakhir</span>
                    <span className="text-sm font-bold text-white block">
                      {activeStudent.won
                        ? 'Tamat (Menang)'
                        : activeStudent.stage_reached > 0
                        ? `Stage ${activeStudent.stage_reached}`
                        : '-'}
                    </span>
                  </div>

                  <div className="bg-black/30 p-3.5 rounded-xl border border-white/6">
                    <span className="text-slate-400 block text-xs font-medium mb-1">Akurasi Tembakan</span>
                    <span className="text-xl font-black text-emerald-300 tabular-nums">
                      {activeStudent.accuracy}%
                    </span>
                  </div>

                  <div className="bg-black/30 p-3.5 rounded-xl border border-white/6">
                    <span className="text-slate-400 block text-xs font-medium mb-1">Kombo Tertinggi</span>
                    <span className="text-xl font-black text-amber-300 tabular-nums">
                      {activeStudent.best_combo}x
                    </span>
                  </div>

                  <div className="bg-black/30 p-3.5 rounded-xl border border-white/6">
                    <span className="text-slate-400 block text-xs font-medium mb-1">Agen Karakter</span>
                    <span className="text-xs font-bold text-white capitalize block">
                      {activeStudent.character_id === 'naya' ? 'Agen Rana' : 'Agen Raka'}
                    </span>
                  </div>

                  <div className="bg-black/30 p-3.5 rounded-xl border border-white/6">
                    <span className="text-slate-400 block text-xs font-medium mb-1">Tingkat Kesulitan</span>
                    <span className="text-xs font-bold text-white capitalize block">
                      {activeStudent.difficulty}
                    </span>
                  </div>

                  <div className="bg-black/30 p-3.5 rounded-xl border border-white/6 col-span-2">
                    <span className="text-slate-400 block text-xs font-medium mb-1">Durasi Bermain</span>
                    <span className="text-xs font-bold text-white block">
                      {Math.floor(activeStudent.play_duration_seconds / 60)} Menit{' '}
                      {activeStudent.play_duration_seconds % 60} Detik
                    </span>
                  </div>
                </div>
              </div>

              {/* Seksi 2: Nilai & Evaluasi LKPD */}
              <div className="bg-[#0c1222] border border-white/10 rounded-2xl p-5 sm:p-6">
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/8">
                  <div className="flex items-center gap-2 text-emerald-400 font-black uppercase tracking-wider text-xs">
                    <BookOpen className="w-4 h-4" />
                    <span>Lembar Kerja Siswa (LKPD)</span>
                  </div>
                  {activeStudent.lkpd_submitted && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">Nilai Total:</span>
                      <span className="px-3.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black text-sm tabular-nums">
                        {activeStudent.lkpd_score}/100
                      </span>
                    </div>
                  )}
                </div>

                {!activeStudent.lkpd_submitted ? (
                  <p className="text-slate-400 italic py-4 text-center">
                    Siswa belum mengisi atau mengumpulkan lembar kerja (LKPD).
                  </p>
                ) : (
                  <div className="flex flex-col gap-5">
                    {/* A. Eksperimen Lab RYB */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                        1. Eksperimen Lab Campur Warna (RYB)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {LKPD_LAB_CHALLENGES.map((ch) => {
                          const isSolved = (activeStudent.lab_solved_ids || []).includes(
                            ch.targetColorId
                          );
                          const colorDef = getColorDef(ch.targetColorId);

                          return (
                            <div
                              key={ch.id}
                              className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 ${
                                isSolved
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                                  : 'bg-white/4 border-white/8 text-slate-400'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className="w-4 h-4 rounded-md border border-white/50 shrink-0"
                                  style={{ backgroundColor: colorDef.hex }}
                                />
                                <span className="font-semibold text-xs sm:text-sm truncate">
                                  {colorDef.nameId}
                                </span>
                              </div>
                              <span className="text-xs font-bold shrink-0">
                                {isSolved ? '✔ Berhasil' : 'Belum'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* B. Kuis Pilihan Ganda */}
                    <div className="pt-2">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                        2. Jawaban Kuis Pilihan Ganda
                      </h4>
                      <div className="flex flex-col gap-3">
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
                              className="bg-black/30 rounded-xl p-3.5 border border-white/6 flex flex-col gap-2"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <span className="font-bold text-white text-xs sm:text-sm leading-snug">
                                  {idx + 1}. {q.question}
                                </span>
                                {studentAnswerId ? (
                                  isCorrect ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-md shrink-0 border border-emerald-500/30">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Benar
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/15 px-2.5 py-0.5 rounded-md shrink-0 border border-red-500/30">
                                      <XCircle className="w-3.5 h-3.5" /> Salah
                                    </span>
                                  )
                                ) : (
                                  <span className="text-xs text-slate-500 italic shrink-0">
                                    Tidak Dijawab
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-slate-300">
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
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                        3. Refleksi Pembelajaran Siswa (Esai)
                      </h4>
                      <div className="flex flex-col gap-3">
                        {LKPD_REFLECTION_PROMPTS.map((prompt, idx) => {
                          const anyRef = activeStudent.reflection_answers
                            ? Object.values(activeStudent.reflection_answers).find((v) => (v || '').trim().length > 0)
                            : '';
                          const studentEssay =
                            activeStudent.reflection_answers?.[prompt.id] ||
                            activeStudent.reflection_answers?.['ref_kesan'] ||
                            activeStudent.reflection_answers?.['ref_1_kategori'] ||
                            activeStudent.reflection_answers?.['ref_1_kesan'] ||
                            activeStudent.reflection_answers?.[`q${idx + 1}`] ||
                            anyRef;

                          return (
                            <div
                              key={prompt.id}
                              className="bg-black/35 rounded-xl p-4 border border-white/8 flex flex-col gap-2"
                            >
                              <span className="font-bold text-slate-300 text-xs sm:text-sm">
                                {prompt.question}
                              </span>
                              <div className="p-3.5 rounded-xl bg-black/40 border border-white/6 text-slate-100 leading-relaxed whitespace-pre-wrap text-xs sm:text-sm">
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
            <div className="p-4 sm:p-5 bg-[#060a14] border-t border-white/10 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setActiveStudent(null)}
                className="h-11 px-6 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider transition-all cursor-pointer shadow-md"
              >
                Tutup Papan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
