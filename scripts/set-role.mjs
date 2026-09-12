#!/usr/bin/env node
/**
 * Set a user's role (and optionally aadhaar) in user_profiles via the service_role key.
 * Bypasses RLS and the role-guard trigger (auth.uid() IS NULL for service sessions) —
 * this is the ONLY way to grant staff roles now that registration is citizen-only.
 *
 * Usage:  node scripts/set-role.mjs <email> <admin|field_officer|auditor|citizen> [aadhaar]
 * Env:    scripts/.env  →  SUPABASE_URL=...  SERVICE_ROLE_KEY=...   (gitignored — never commit)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VALID = ['admin', 'field_officer', 'auditor', 'citizen'];

function loadEnv() {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '.env');
  const env = { ...process.env };
  try {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {
    /* fall back to process.env */
  }
  return env;
}

async function main() {
  const [email, role, aadhaar] = process.argv.slice(2);
  if (!email || !role || !VALID.includes(role)) {
    console.error(`Usage: node scripts/set-role.mjs <email> <${VALID.join('|')}> [aadhaar]`);
    process.exit(1);
  }
  const { SUPABASE_URL, SERVICE_ROLE_KEY } = loadEnv();
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL / SERVICE_ROLE_KEY — copy scripts/.env.example to scripts/.env and fill it (Dashboard → API Keys → service_role).');
    process.exit(1);
  }
  const H = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };

  // Find the auth user by email (admin API paginates; 1000 covers any demo project)
  const users = await (await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, { headers: H })).json();
  const user = (users.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`No auth user with email ${email}`);
    process.exit(1);
  }

  // Upsert the profile row (id PK = auth user id; keep existing full_name)
  const existing = await (await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${user.id}&select=full_name`, { headers: H })).json();
  const patch = { id: user.id, full_name: existing[0]?.full_name ?? user.user_metadata?.full_name ?? email.split('@')[0], role };
  if (aadhaar) {
    if (!/^\d{12}$/.test(aadhaar)) {
      console.error('Aadhaar must be exactly 12 digits');
      process.exit(1);
    }
    patch.aadhaar = aadhaar;
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
    method: 'POST',
    headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([patch]),
  });
  if (!res.ok) {
    console.error(`Profile upsert failed (${res.status}):`, await res.text());
    process.exit(1);
  }
  const row = (await res.json())[0];
  console.log(`OK — ${email} → role=${row.role}${row.aadhaar ? ` aadhaar=XXXX-XXXX-${String(row.aadhaar).slice(8)}` : ''}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
