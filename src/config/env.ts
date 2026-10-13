/** Typed access to public (VITE_*) environment variables. Never put secrets here. */
export interface AppEnv {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  mapStyleUrl: string;
  baseUrl: string;
}

const clean = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export const env: AppEnv = {
  supabaseUrl: clean(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: clean(import.meta.env.VITE_SUPABASE_ANON_KEY),
  mapStyleUrl: clean(import.meta.env.VITE_MAP_STYLE_URL) ?? 'https://tiles.openfreemap.org/styles/dark',
  baseUrl: import.meta.env.BASE_URL ?? '/',
};

export const isSupabaseConfigured = (): boolean => !!env.supabaseUrl && !!env.supabaseAnonKey;

/** Debug features (turbo time) are available in dev builds or with ?debug=1. */
export function isDebugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('debug') === '1';
}
