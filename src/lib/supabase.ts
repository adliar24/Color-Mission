import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Kunci penyimpanan konfigurasi manual di localStorage jika tidak pakai file .env
const LS_SUPABASE_URL_KEY = 'color_mission_supabase_url';
const LS_SUPABASE_KEY_KEY = 'color_mission_supabase_anon_key';

export function normalizeSupabaseUrl(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

  if (envUrl && envKey) {
    return { url: normalizeSupabaseUrl(envUrl), anonKey: envKey };
  }

  // Fallback ke localStorage jika guru memasukkan kredensial langsung lewat UI Admin
  if (typeof window !== 'undefined') {
    const lsUrl = localStorage.getItem(LS_SUPABASE_URL_KEY)?.trim() || '';
    const lsKey = localStorage.getItem(LS_SUPABASE_KEY_KEY)?.trim() || '';
    if (lsUrl && lsKey) {
      return { url: normalizeSupabaseUrl(lsUrl), anonKey: lsKey };
    }
  }

  return { url: '', anonKey: '' };
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LS_SUPABASE_URL_KEY, url.trim());
    localStorage.setItem(LS_SUPABASE_KEY_KEY, anonKey.trim());
    _cachedClient = null; // Reset instance client
  }
}

export function clearSupabaseCredentials(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LS_SUPABASE_URL_KEY);
    localStorage.removeItem(LS_SUPABASE_KEY_KEY);
    _cachedClient = null;
  }
}

let _cachedClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_cachedClient) return _cachedClient;

  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey) return null;

  try {
    _cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'color_mission_auth_token',
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    return _cachedClient;
  } catch (err) {
    console.warn('[Supabase] Gagal inisialisasi client:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(url && anonKey);
}

// ==============================================================================
// AUTHENTIKASI ADMIN GURU DENGAN SUPABASE
// ==============================================================================

export function resolveAdminEmail(usernameOrEmail: string): string {
  const trimmed = usernameOrEmail.trim().toLowerCase();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  return `${trimmed}@colormission.internal`;
}

export async function loginAdminUser(
  usernameOrEmail: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) {
    return { success: false, error: 'Koneksi database Supabase belum terkonfigurasi.' };
  }

  const email = resolveAdminEmail(usernameOrEmail);

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return { success: false, error: 'Username atau password salah.' };
      }
      if (error.message.includes('Email not confirmed')) {
        return {
          success: false,
          error: 'Email belum dikonfirmasi. Pastikan opsi "Confirm email" di Supabase Auth dinonaktifkan.',
        };
      }
      return { success: false, error: error.message };
    }

    return { success: Boolean(data.session) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal menghubungi server otentikasi.';
    return { success: false, error: msg };
  }
}

export async function registerAdminUser(
  usernameOrEmail: string,
  password: string
): Promise<{ success: boolean; error?: string; needEmailConfirm?: boolean }> {
  const client = getSupabase();
  if (!client) {
    return { success: false, error: 'Koneksi database Supabase belum terkonfigurasi.' };
  }

  if (password.length < 6) {
    return { success: false, error: 'Password minimal 6 karakter.' };
  }

  const email = resolveAdminEmail(usernameOrEmail);

  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: usernameOrEmail.trim(),
          role: 'teacher_admin',
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.session) {
      return { success: true };
    }

    // Jika Supabase mengharuskan konfirmasi email
    return {
      success: true,
      needEmailConfirm: true,
      error: 'Akun berhasil didaftarkan di Supabase. Silakan login.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal mendaftarkan akun di Supabase.';
    return { success: false, error: msg };
  }
}

export async function logoutAdminUser(): Promise<void> {
  const client = getSupabase();
  if (client) {
    try {
      await client.auth.signOut();
    } catch {}
  }
}

export async function checkAdminSession(): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { data } = await client.auth.getSession();
    return Boolean(data.session?.user);
  } catch {
    return false;
  }
}

