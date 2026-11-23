-- ==============================================================================
-- SKRIP DATABASE SUPABASE: COLOR MISSION
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ==============================================================================

-- 1. Tabel Progres Sesi Bermain Siswa
CREATE TABLE IF NOT EXISTS public.student_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_name TEXT NOT NULL,
    student_class TEXT NOT NULL,
    student_absent TEXT NOT NULL,
    character_id TEXT DEFAULT 'raka',
    difficulty TEXT DEFAULT 'normal',
    stage_reached INTEGER DEFAULT 1,
    won BOOLEAN DEFAULT FALSE,
    score INTEGER DEFAULT 0,
    accuracy NUMERIC DEFAULT 0,
    best_combo INTEGER DEFAULT 0,
    kills INTEGER DEFAULT 0,
    play_duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabel Lembar Kerja Siswa (LKPD)
CREATE TABLE IF NOT EXISTS public.lkpd_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_name TEXT NOT NULL,
    student_class TEXT NOT NULL,
    student_absent TEXT NOT NULL,
    lab_solved_ids JSONB DEFAULT '[]'::jsonb,
    quiz_answers JSONB DEFAULT '{}'::jsonb,
    reflection_answers JSONB DEFAULT '{}'::jsonb,
    objective_score INTEGER DEFAULT 0,
    submitted_at TIMESTAMPTZ DEFAULT now()
);

-- Index untuk mempercepat query berdasarkan kelas dan waktu
CREATE INDEX IF NOT EXISTS idx_sessions_class_created ON public.student_sessions(student_class, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lkpd_class_submitted ON public.lkpd_submissions(student_class, submitted_at DESC);

-- 3. Konfigurasi Row Level Security (RLS)
ALTER TABLE public.student_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lkpd_submissions ENABLE ROW LEVEL SECURITY;

-- Kebijakan INSERT untuk Siswa (Anon / Public)
DROP POLICY IF EXISTS "Siswa dapat mengirim progres sesi" ON public.student_sessions;
CREATE POLICY "Siswa dapat mengirim progres sesi"
ON public.student_sessions FOR INSERT
TO anon, authenticated
WITH CHECK (length(trim(student_name)) > 0);

DROP POLICY IF EXISTS "Siswa dapat mengumpulkan LKPD" ON public.lkpd_submissions;
CREATE POLICY "Siswa dapat mengumpulkan LKPD"
ON public.lkpd_submissions FOR INSERT
TO anon, authenticated
WITH CHECK (length(trim(student_name)) > 0);

-- Kebijakan SELECT untuk Guru / Panel Admin
DROP POLICY IF EXISTS "Akses baca sesi siswa untuk panel admin" ON public.student_sessions;
CREATE POLICY "Akses baca sesi siswa untuk panel admin"
ON public.student_sessions FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Akses baca LKPD siswa untuk panel admin" ON public.lkpd_submissions;
CREATE POLICY "Akses baca LKPD siswa untuk panel admin"
ON public.lkpd_submissions FOR SELECT
TO anon, authenticated
USING (true);

-- 4. Aktifkan Fitur Realtime (Pembaruan Otomatis Live di Layar Guru)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'student_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_sessions;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'lkpd_submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lkpd_submissions;
  END IF;
END $$;

