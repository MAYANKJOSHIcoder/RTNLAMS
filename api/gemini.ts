/**
 * Gemini proxy — Vercel serverless function.
 * SECURITY: GEMINI_API_KEY is read here, on the server, per request.
 * It is never prefixed VITE_ and never compiled into the client bundle.
 * Callers must present a valid Supabase JWT (logged-in users only).
 */

interface Req {
  method?: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
}
interface Res {
  status(code: number): Res;
  json(body: unknown): void;
  setHeader(key: string, value: string): Res;
}

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite';
const MAX_PROMPT = 20_000;
const MAX_B64_CHARS = 11_000_000; // ~8 MB decoded
const MIME_ALLOW = /^image\/(jpeg|png|webp|gif|bmp|tiff)$|^application\/pdf$/;
const RATE_LIMIT = 15;
const WINDOW_MS = 60_000;

// ponytail: per-instance in-memory limiter (resets on cold start) — enough
// with JWT gate + Google quota; swap for Upstash if abuse appears.
const hits = new Map<string, number[]>();
function rateOk(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= RATE_LIMIT) {
    hits.set(ip, arr);
    return false;
  }
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 10_000) hits.clear();
  return true;
}

async function verifySupabaseJwt(req: Req): Promise<boolean> {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  // ponytail: reuses the public VITE_SUPABASE_* vars — every env var reaches
  // functions; the prefix only affects the client bundle. These values are
  // public by design; the actual secret (GEMINI_API_KEY) stays unprefixed.
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return false;
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anon },
  });
  return res.ok;
}

async function fetchModels(key: string): Promise<boolean> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${key}`, {
    signal: AbortSignal.timeout(8000),
  });
  return res.ok;
}

async function generate(key: string, body: Record<string, unknown>): Promise<{ status: number; payload: unknown }> {
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
  } catch (e) {
    return { status: 502, payload: { error: `Google unreachable: ${(e as Error).message}` } };
  }
  const json = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  } | null;
  if (!res.ok) {
    return { status: res.status, payload: { error: json?.error?.message ?? `Gemini ${res.status}` } };
  }
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) return { status: 502, payload: { error: 'Empty Gemini response' } };
  return { status: 200, payload: { text } };
}

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
    return;
  }

  if (req.method === 'GET') {
    // health probe for ServiceHealth — reports reachability only, no auth needed
    res.status(200).json({ ok: true, gemini: await fetchModels(key) });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] ?? 'unknown').split(',')[0].trim();
  if (!rateOk(ip)) {
    res.status(429).json({ error: 'Rate limit exceeded — try again in a minute.' });
    return;
  }
  if (!(await verifySupabaseJwt(req))) {
    res.status(401).json({ error: 'Sign in required to use document extraction.' });
    return;
  }

  const { prompt, imageBase64, mimeType } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT) {
    res.status(400).json({ error: 'prompt must be a non-empty string' });
    return;
  }
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  if (imageBase64 !== undefined && imageBase64 !== null && imageBase64 !== '') {
    if (typeof imageBase64 !== 'string' || imageBase64.length > MAX_B64_CHARS) {
      res.status(413).json({ error: 'image too large (max ~8 MB)' });
      return;
    }
    if (typeof mimeType !== 'string' || !MIME_ALLOW.test(mimeType)) {
      res.status(400).json({ error: 'unsupported mimeType' });
      return;
    }
    parts.push({ inline_data: { mime_type: mimeType, data: imageBase64.replace(/^data:[^;]+;base64,/, '') } });
  }

  const { status, payload } = await generate(key, {
    contents: [{ parts }],
    // ponytail: no temperature — Gemini 3.x rejects non-default values
    generationConfig: { responseMimeType: 'application/json' },
  });
  res.status(status).json(payload);
}
