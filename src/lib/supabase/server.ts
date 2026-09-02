import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, isConfigValid } from '../config';

/**
 * Server-side / SSR helper — creates an isolated Supabase client per request.
 * For Vite SPA this is unused, but provided for future Next.js/SSR or edge functions.
 * Uses same config.ts validation as client.ts (PROMPT 5).
 */
export function createServerSupabaseClient(): SupabaseClient | null {
  if (!isConfigValid()) {
    console.warn('[supabase/server] Env not configured — server client unavailable. Fill .env');
    return null;
  }
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Alias per PROMPT 5 spec
export const createServerClient = createServerSupabaseClient;
