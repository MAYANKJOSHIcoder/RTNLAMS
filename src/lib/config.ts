/**
 * Typed runtime config — reads from import.meta.env (Vite).
 * Each service validated independently so one missing key
 * doesn't break unrelated features.
 * SECURITY: Never hardcode keys — always via VITE_* env.
 */

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  cartoApiKey: string;
  indicTransApiUrl: string;
  pdfOcrMaxPages: number;
}

const env = (): Record<string, string | undefined> =>
  (import.meta as unknown as { env: Record<string, string | undefined> }).env ?? {};

function getVal(key: string): string {
  return env()[key]?.trim() ?? '';
}

function isPlaceholder(key: string, val: string): boolean {
  if (!val) return true;
  const lower = val.toLowerCase();
  return (
    lower.startsWith('your_') ||
    lower === 'nah' ||
    lower === 'nanana' ||
    lower === 'todo' ||
    lower === 'placeholder' ||
    lower.includes(`your_${key.replace('VITE_', '').toLowerCase()}`)
  );
}

/** Supabase — required for core app */
export function isSupabaseConfigured(): boolean {
  const url = getVal('VITE_SUPABASE_URL');
  const key = getVal('VITE_SUPABASE_ANON_KEY');
  return !!url && !!key && !isPlaceholder('VITE_SUPABASE_URL', url) && !isPlaceholder('VITE_SUPABASE_ANON_KEY', key);
}

/** IndicTrans2 — optional, enables real translation (localhost:8080) */
export function isIndicTransConfigured(): boolean {
  const url = getVal('VITE_INDICTRAN_API_URL');
  return !!url && url.startsWith('http');
}

/** All core services configured (Supabase only) */
export function isConfigValid(): boolean {
  return isSupabaseConfigured();
}

/**
 * Eager config — returns values (may be empty strings in dev).
 * Use isXxxConfigured() to check availability before calling services.
 */
export const config: AppConfig = (() => {
  const e = env();
  const maxPagesParsed = parseInt(e.VITE_PDF_OCR_MAX_PAGES ?? '', 10);
  return {
    supabaseUrl: e.VITE_SUPABASE_URL ?? '',
    supabaseAnonKey: e.VITE_SUPABASE_ANON_KEY ?? '',
    cartoApiKey: getVal('VITE_CARTO_API_KEY'),
    indicTransApiUrl: e.VITE_INDICTRAN_API_URL ?? '',
    pdfOcrMaxPages: Number.isFinite(maxPagesParsed) ? maxPagesParsed : 5,
  };
})();

export default config;
