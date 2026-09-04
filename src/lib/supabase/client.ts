import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured } from '../config';

let _client: SupabaseClient | null = null;

function createSafeClient(): SupabaseClient {
  if (_client) return _client;
  if (isSupabaseConfigured()) {
    _client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return _client;
  }
  console.warn('[supabase] Env not configured — using placeholder client. Fill .env then restart dev server.');
  _client = createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export const supabase: SupabaseClient = createSafeClient();
export { isSupabaseConfigured };
export type TypedSupabaseClient = SupabaseClient;
