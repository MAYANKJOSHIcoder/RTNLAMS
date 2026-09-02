import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, isConfigValid } from '../config';

// Typed Supabase client — uses config.ts (PROMPT 2) strictly via import.meta.env.VITE_*
// If env not configured (fill later), creates a dummy client that warns on use but keeps build alive.

let _client: SupabaseClient | null = null;

function createSafeClient(): SupabaseClient {
  if (_client) return _client;
  if (isConfigValid()) {
    _client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return _client;
  }
  // Deferred-keys mode: create client with placeholder URL that will fail gracefully on auth calls
  // Allows dev server + routing to work before user fills .env
  console.warn('[supabase] Env not configured — using placeholder client. Fill .env then restart dev server.');
  const placeholderUrl = 'https://placeholder.supabase.co';
  const placeholderKey = 'placeholder-anon-key';
  _client = createClient(placeholderUrl, placeholderKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export const supabase: SupabaseClient = createSafeClient();

// Helper to check if supabase is actually configured before making auth calls
export function isSupabaseConfigured(): boolean {
  return isConfigValid();
}

export type TypedSupabaseClient = SupabaseClient;
