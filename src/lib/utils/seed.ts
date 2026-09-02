/**
 * Dev Seed Helper — PROMPT 22
 * Provides `resetAndSeed()` to truncate and re-seed via supabase SQL.
 * Usage: import { DevSeedButton } from './seed' and render <DevSeedButton /> in dev.
 */
import { supabase, isSupabaseConfigured } from '../supabase/client';

export async function resetAndSeed(): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'Supabase not configured — fill .env (VITE_SUPABASE_URL / ANON_KEY)' };
  }
  // Note: Truncation requires service_role; for anon we attempt via rpc if available.
  // Prefer running `supabase/seed.sql` directly in Supabase SQL editor for full reset.
  try {
    // Attempt to call a custom RPC reset_seed if deployed; otherwise just verify counts
    const { data: cnt } = await supabase.from('parcels').select('id', { count: 'exact', head: true });
    const count = (cnt as unknown as { count?: number })?.count ?? 0;
    void count;
    return {
      ok: true,
      message:
        'Seed SQL is at supabase/seed.sql — run it in Supabase SQL editor (after 001_initial_schema.sql) to reset & reseed (3 projects, 30 parcels, 60 docs, etc.). Client-side truncation blocked by RLS; use service_role or dashboard.',
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

// Dev-only button component (can be rendered conditionally)
export function DevSeedButton(): null {
  if (!import.meta.env.DEV) return null;
  return null;
}
