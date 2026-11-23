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
        persistSession: false,
        autoRefreshToken: false,
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

