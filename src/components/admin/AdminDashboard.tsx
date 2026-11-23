import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  UnifiedStudentRow,
  getUnifiedStudentData,
} from '../../lib/syncService';
import {
  isSupabaseConfigured,
  getSupabase,
  getSupabaseCredentials,
  saveSupabaseCredentials,
  clearSupabaseCredentials,
} from '../../lib/supabase';
import {
  Search,
  Download,
  RefreshCw,
  ArrowLeft,
  X,
  Settings,
  Check,
  FileSpreadsheet,
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToGame: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToGame }) => {
  const [students, setStudents] = useState<UnifiedStudentRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
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
      const data = await getUnifiedStudentData();
      setStudents(data);
    } catch (err) {
      console.warn('[AdminDashboard] Gagal memuat data siswa:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Supabase Realtime Listener jika terhubung
    const client = getSupabase();
    if (!client) return;

    const channel = client
      .channel('admin_live_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'student_sessions' },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lkpd_submissions' },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [loadData]);

  // Buka modal config & isi field yang ada
  const handleOpenConfig = () => {
    const creds = getSupabaseCredentials();
    setDbUrl(creds.url);
    setDbKey(creds.anonKey);
    setConfigSuccessMsg(null);
    setShowConfigModal(true);
  };

  const handleSaveConfig = () => {
    saveSupabaseCredentials(dbUrl, dbKey);
    setConfigSuccessMsg('Pengaturan Supabase tersimpan.');
    setTimeout(() => {
      setShowConfigModal(false);
      loadData();
    }, 900);
  };

  const handleClearConfig = () => {
    clearSupabaseCredentials();
    setDbUrl('');
    setDbKey('');
    setConfigSuccessMsg('Pengaturan Supabase dibersihkan. Beralih ke penyimpanan lokal.');
    setTimeout(() => {
      setShowConfigModal(false);
      loadData();
    }, 900);
  };

  // Daftar opsi kelas
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
        s.student_absent.toLowerCase().includes(q);

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

    const lkpdDone = students.filter((s) => s.lkpd_score !== null);
    const avgLkpd =
      lkpdDone.length > 0
        ? Math.round(
            lkpdDone.reduce((acc, s) => acc + (s.lkpd_score || 0), 0) / lkpdDone.length
          )
        : 0;

    const wonCount = students.filter((s) => s.won).length;
    const wonRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;

    return { total, avgScore, avgLkpd, wonCount, wonRate };
  }, [students]);

  // Ekspor ke CSV
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) return;

    const headers = [
      'No',
      'Nama Siswa',
      'Kelas',
      'No Absen',
      'Stage Terakhir',
      'Status Game',
      'Skor Game',
      'Akurasi (%)',
      'Kombo Tertinggi',
      'Durasi Bermain (Detik)',
      'Nilai LKPD (0-100)',
      'Waktu Tercatat',
    ];

    const rows = filteredStudents.map((s, idx) => {
      const stageLabel = s.won ? 'Tamat (Boss)' : s.stage_reached > 0 ? `Stage ${s.stage_reached}` : '-';
      const statusLabel = s.won ? 'Menang' : s.stage_reached > 0 ? 'Gugur' : '-';
      const timeStr = s.lkpd_submitted_at || s.last_played_at;
      const dateFormatted = timeStr ? new Date(timeStr).toLocaleString('id-ID') : '-';

      return [
        idx + 1,
        `"${s.student_name.replace(/"/g, '""')}"`,
        `"${s.student_class.replace(/"/g, '""')}"`,
        `"${s.student_absent.replace(/"/g, '""')}"`,
        stageLabel,
        statusLabel,
        s.score,
        s.accuracy,
        s.best_combo,
        s.play_duration_seconds,
        s.lkpd_score !== null ? s.lkpd_score : '-',
        `"${dateFormatted}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap_color_mission_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans select-text">
      {/* ====================================================================
          HEADER UTAMA (RINGKAS & BERSIH)
         ==================================================================== */}
      <header className="border-b border-white/10 bg-[#090e1c] px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToGame}
            title="Kembali ke Game"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight uppercase leading-tight truncate">
              Panel Rekap &amp; Progres Siswa
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400 font-medium">COLOR MISSION</span>
              <span className="text-slate-600">·</span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                  supabaseActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    supabaseActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                {supabaseActive ? 'Supabase Terhubung' : 'Penyimpanan Lokal'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadData}
            title="Muat Ulang Data"
            disabled={isLoading}
            className="h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            title="Unduh Rekap CSV"
            disabled={filteredStudents.length === 0}
            className="h-9 px-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>

          <button
            type="button"
            onClick={handleOpenConfig}
            title="Pengaturan Database Supabase"
            className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ====================================================================
          METRICS BAR: 4 KOTAK RINGKAS (ANTI-SLOP, HIGH DENSITY)
         ==================================================================== */}
      <section className="px-4 sm:px-6 pt-5 pb-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#0c1222] border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Total Siswa
            </span>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-white">
              {stats.total}
            </div>
          </div>

          <div className="bg-[#0c1222] border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Rata-rata Skor Game
            </span>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-cyan-400">
              {stats.avgScore.toLocaleString('id-ID')}
            </div>
          </div>

          <div className="bg-[#0c1222] border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Rata-rata LKPD
            </span>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-emerald-400">
              {stats.avgLkpd}
              <span className="text-xs text-slate-500 font-normal"> / 100</span>
            </div>
          </div>

          <div className="bg-[#0c1222] border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Kelulusan Game (Tamat)
            </span>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-amber-300">
              {stats.wonRate}%
              <span className="text-xs text-slate-500 font-normal"> ({stats.wonCount} siswa)</span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          TOOLBAR PENCARIAN & FILTER
         ==================================================================== */}
      <section className="px-4 sm:px-6 py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama atau nomor absen..."
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#0c1222] border border-white/12 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          {classList.length > 0 && (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="h-9 px-3 rounded-xl bg-[#0c1222] border border-white/12 text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
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
            className="h-9 px-3 rounded-xl bg-[#0c1222] border border-white/12 text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="won">Tamat (Menang)</option>
            <option value="lkpd_done">LKPD Terkumpul</option>
            <option value="lkpd_pending">LKPD Belum</option>
          </select>
        </div>
      </section>

      {/* ====================================================================
          TABEL DATA SISWA
         ==================================================================== */}
      <main className="flex-1 px-4 sm:px-6 py-3 overflow-x-auto">
        <div className="border border-white/10 rounded-2xl bg-[#090e1c] overflow-hidden min-w-[760px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-[#0c1326] text-slate-400 uppercase font-semibold tracking-wider">
                <th className="py-3 px-3.5 w-12 text-center">No</th>
                <th className="py-3 px-4">Nama Siswa</th>
                <th className="py-3 px-3">Kelas</th>
                <th className="py-3 px-3 text-center">Absen</th>
                <th className="py-3 px-3">Stage Terakhir</th>
                <th className="py-3 px-3.5 text-right">Skor Game</th>
                <th className="py-3 px-3 text-right">Akurasi</th>
                <th className="py-3 px-3.5 text-center">Nilai LKPD</th>
                <th className="py-3 px-3.5">Waktu Terakhir</th>
                <th className="py-3 px-3 text-center w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-slate-200 font-normal">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-sm">
                    {isLoading ? 'Memuat data siswa...' : 'Belum ada data siswa yang cocok.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => {
                  const timeFormatted = s.lkpd_submitted_at || s.last_played_at;
                  return (
                    <tr
                      key={`${s.student_name}_${s.student_class}_${idx}`}
                      className="hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="py-3 px-3.5 text-center text-slate-500 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {s.student_name}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {s.student_class}
                      </td>
                      <td className="py-3 px-3 text-center tabular-nums text-slate-400">
                        {s.student_absent}
                      </td>
                      <td className="py-3 px-3">
                        {s.won ? (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
                            Tamat (Menang)
                          </span>
                        ) : s.stage_reached > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[11px] font-medium">
                            Stage {s.stage_reached}
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right tabular-nums font-bold text-white">
                        {s.score > 0 ? s.score.toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-slate-300">
                        {s.accuracy > 0 ? `${s.accuracy}%` : '-'}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        {s.lkpd_submitted && s.lkpd_score !== null ? (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md font-bold text-xs ${
                              s.lkpd_score >= 80
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : s.lkpd_score >= 60
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}
                          >
                            {s.lkpd_score}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Belum</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-slate-400 text-[11px] tabular-nums whitespace-nowrap">
                        {timeFormatted ? new Date(timeFormatted).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setActiveStudent(s)}
                          className="px-2.5 py-1 rounded-lg bg-white/6 hover:bg-white/12 border border-white/10 text-cyan-300 hover:text-cyan-200 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* ====================================================================
          DRAWER DETAIL SISWA (SLIDE-OVER PANEL)
         ==================================================================== */}
      {activeStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-[#0a0f1d] border-l border-white/12 h-full flex flex-col p-6 overflow-y-auto">
            {/* Header Drawer */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">
                  {activeStudent.student_name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kelas {activeStudent.student_class} · No. Absen {activeStudent.student_absent}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveStudent(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Konten Detail */}
            <div className="py-5 flex flex-col gap-5 text-xs">
              {/* Progres Game */}
              <div className="bg-[#0e1526] border border-white/8 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">
                  Ringkasan Game 3D
                </h4>
                <div className="grid grid-cols-2 gap-3 text-slate-300">
                  <div>
                    <span className="text-slate-500 block">Stage Terakhir:</span>
                    <span className="font-semibold text-white text-sm">
                      {activeStudent.won
                        ? 'Tamat (Boss Kalah)'
                        : activeStudent.stage_reached > 0
                        ? `Stage ${activeStudent.stage_reached}`
                        : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Skor Akhir:</span>
                    <span className="font-semibold text-white text-sm tabular-nums">
                      {activeStudent.score.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Akurasi Laser:</span>
                    <span className="font-semibold text-white text-sm tabular-nums">
                      {activeStudent.accuracy}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Kombo Maksimal:</span>
                    <span className="font-semibold text-white text-sm tabular-nums">
                      {activeStudent.best_combo}x
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Karakter / Kesulitan:</span>
                    <span className="font-semibold text-white capitalize">
                      {activeStudent.character_id} / {activeStudent.difficulty}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Durasi Bermain:</span>
                    <span className="font-semibold text-white tabular-nums">
                      {Math.floor(activeStudent.play_duration_seconds / 60)}m {activeStudent.play_duration_seconds % 60}s
                    </span>
                  </div>
                </div>
              </div>

              {/* Progres LKPD */}
              <div className="bg-[#0e1526] border border-white/8 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Lembar Kerja (LKPD)
                  </h4>
                  {activeStudent.lkpd_submitted && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                      Nilai: {activeStudent.lkpd_score}/100
                    </span>
                  )}
                </div>

                {!activeStudent.lkpd_submitted ? (
                  <p className="text-slate-400 italic">Siswa belum mengumpulkan LKPD.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div>
                      <span className="text-slate-500 block mb-1">Eksperimen Lab RYB:</span>
                      <span className="font-medium text-white">
                        {activeStudent.lkpd_lab_count} kombinasi warna primer berhasil dipecahkan.
                      </span>
                    </div>

                    {/* Jawaban Refleksi Esai */}
                    {activeStudent.reflection_answers && (
                      <div className="mt-2 pt-3 border-t border-white/8">
                        <span className="text-slate-400 font-semibold block mb-2">
                          Esai Refleksi Siswa:
                        </span>
                        <div className="flex flex-col gap-2.5">
                          {Object.entries(activeStudent.reflection_answers).map(([key, val]) => (
                            <div key={key} className="bg-black/30 rounded-xl p-3 border border-white/6">
                              <span className="text-[11px] text-slate-500 uppercase block font-mono mb-1">
                                {key}
                              </span>
                              <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                                {val || '-'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setActiveStudent(null)}
                className="w-full py-2.5 rounded-xl bg-white/8 hover:bg-white/12 text-white font-semibold transition-colors cursor-pointer"
              >
                Tutup Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL PENGATURAN SUPABASE
         ==================================================================== */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
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
              Masukkan kredensial project Supabase Anda. Nilai ini akan disimpan secara aman di browser ini atau dapat diatur via file <code className="text-cyan-300">.env</code>.
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
                  placeholder="https://xyzcompany.supabase.co"
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
                Hapus / Mode Lokal
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

