/**
 * Typed runtime config — reads from import.meta.env (Vite).
 * Throws descriptive errors if any required key is missing/placeholder.
 * SECURITY: Never hardcode keys — always via VITE_* env.
 * Ref: PROMPTS_indictrans.md PROMPT 2
 */

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  geminiApiKey: string;
  sentinelHubClientId: string;
  sentinelHubClientSecret: string;
}

function requireEnv(key: string, value: string | undefined, placeholder = `your_${key.toLowerCase()}`): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || trimmed === placeholder || trimmed.includes('your_supabase') || trimmed.includes('your_gemini') || trimmed.includes('your_sentinel')) {
    throw new Error(
      `Missing or placeholder env: ${key}. ` +
        `Set ${key} in your .env (see .env.example). ` +
        `All keys must use import.meta.env.VITE_* — never hardcode.`
    );
  }
  return trimmed;
}

function getConfig(): AppConfig {
  // Vite exposes import.meta.env at build time; fallback for non-Vite contexts
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env ?? {};

  return {
    supabaseUrl: requireEnv('VITE_SUPABASE_URL', env.VITE_SUPABASE_URL),
    supabaseAnonKey: requireEnv('VITE_SUPABASE_ANON_KEY', env.VITE_SUPABASE_ANON_KEY),
    geminiApiKey: requireEnv('VITE_GEMINI_API_KEY', env.VITE_GEMINI_API_KEY),
    sentinelHubClientId: requireEnv('VITE_SENTINEL_HUB_CLIENT_ID', env.VITE_SENTINEL_HUB_CLIENT_ID),
    sentinelHubClientSecret: requireEnv('VITE_SENTINEL_HUB_CLIENT_SECRET', env.VITE_SENTINEL_HUB_CLIENT_SECRET),
  };
}

/**
 * Eager validation — throws on import if env missing.
 * For lazy validation (e.g., to allow .env empty in dev), catch at call site
 * or use tryGetConfig().
 */
export const config: AppConfig = (() => {
  try {
    return getConfig();
  } catch (err) {
    // In dev with empty .env, surface warning instead of crashing before user fills it
    if (import.meta.env?.DEV) {
      console.warn('[config] Env not fully configured:', (err as Error).message);
      // Return placeholder that will fail on actual use but allows dev server to start
      return {
        supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string) ?? '',
        supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? '',
        geminiApiKey: (import.meta.env.VITE_GEMINI_API_KEY as string) ?? '',
        sentinelHubClientId: (import.meta.env.VITE_SENTINEL_HUB_CLIENT_ID as string) ?? '',
        sentinelHubClientSecret: (import.meta.env.VITE_SENTINEL_HUB_CLIENT_SECRET as string) ?? '',
      };
    }
    throw err;
  }
})();

/** Strict accessor — always throws if misconfigured */
export function getValidatedConfig(): AppConfig {
  return getConfig();
}

/** Safe check without throwing — useful for health checks */
export function isConfigValid(): boolean {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}

export default config;
