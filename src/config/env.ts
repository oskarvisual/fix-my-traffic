/** Typed access to public (VITE_*) environment variables. */
export interface AppEnv {
  mapStyleUrl: string;
  baseUrl: string;
}

const clean = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export const env: AppEnv = {
  mapStyleUrl: clean(import.meta.env.VITE_MAP_STYLE_URL) ?? 'https://tiles.openfreemap.org/styles/dark',
  baseUrl: import.meta.env.BASE_URL ?? '/',
};

/** Debug features (turbo time) are available in dev builds or with ?debug=1. */
export function isDebugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('debug') === '1';
}
