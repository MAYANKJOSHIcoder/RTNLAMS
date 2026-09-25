/**
 * Gemini Client — PROMPT 13
 * Hybrid: Tesseract OCR (raw text, language-selected traineddata) → IndicTrans
 * (detect/translate) → Gemini (structured JSON).
 * Rate limit 15/min, retries 3. The Gemini call is proxied through the
 * serverless function /api/gemini — the API key never reaches the browser.
 */
import { config, isIndicTransConfigured } from '../config';
import { supabase } from '../supabase/client';
import { tesseractLangsFor } from './ocr-langs';
import type { Worker } from 'tesseract.js';

// Re-exported so callers/tests can keep importing language helpers from the client.
export { OCR_LANG_MAP, OCR_DEFAULT_LANGS, tesseractLangsFor } from './ocr-langs';

const RATE_LIMIT = 15;
const WINDOW_MS = 60_000;
const MAX_RETRIES = 3;

// Non-fatal pipeline warnings (e.g. translation skipped) — consumed + toasted by useGemini
let pipelineWarnings: string[] = [];
export function consumePipelineWarnings(): string[] {
  const w = pipelineWarnings;
  pipelineWarnings = [];
  return w;
}

const timestamps: number[] = [];

function checkRateLimit(): void {
  const now = Date.now();
  while (timestamps.length && now - timestamps[0] > WINDOW_MS) timestamps.shift();
  if (timestamps.length >= RATE_LIMIT) {
    throw new Error(`Rate limit exceeded: max ${RATE_LIMIT} requests/minute. Please wait.`);
  }
  timestamps.push(now);
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Real Tesseract OCR (WASM, runs in a Web Worker).
// tesseract.js is ~2MB — dynamically imported only when OCR actually runs, never on page load.
// Languages are chosen per document (see ocr-langs.ts) so a Tamil deed only pays for
// tam.traineddata instead of every Indic model up front.

// LRU cache of workers keyed by language set — each worker holds its own traineddata in memory.
const MAX_TESSERACT_WORKERS = 3;
const tesseractWorkers = new Map<string, Promise<Worker>>();

function getTesseractWorker(langs: string[]): Promise<Worker> {
  const key = langs.join('+');
  const cached = tesseractWorkers.get(key);
  if (cached) {
    tesseractWorkers.delete(key); // re-insert to refresh LRU order
    tesseractWorkers.set(key, cached);
    return cached;
  }

  const created = (async () => {
    const { createWorker } = await import('tesseract.js');
    return createWorker(langs);
  })().catch((e) => {
    tesseractWorkers.delete(key); // don't cache a failed init — allow retry
    throw e;
  });
  tesseractWorkers.set(key, created);

  // Evict the least-recently-used worker (best-effort terminate, never blocks OCR)
  while (tesseractWorkers.size > MAX_TESSERACT_WORKERS) {
    const oldestKey = tesseractWorkers.keys().next().value as string;
    const oldest = tesseractWorkers.get(oldestKey);
    tesseractWorkers.delete(oldestKey);
    oldest?.then((w) => w.terminate()).catch(() => {});
  }
  return created;
}

async function runTesseract(imageBase64: string, mimeType: string, appLang?: string | null): Promise<string> {
  if (!imageBase64 || mimeType === 'application/pdf') return ''; // PDFs go straight to Gemini vision
  try {
    const worker = await getTesseractWorker(tesseractLangsFor(appLang));
    const { data: { text } } = await worker.recognize(`data:${mimeType};base64,${imageBase64}`);
    return text.trim();
  } catch (e) {
    console.warn('[gemini] Tesseract failed, continuing without local OCR:', (e as Error).message);
    pipelineWarnings.push(`Tesseract OCR failed (${tesseractLangsFor(appLang).join('+')}) — Gemini vision used alone`);
    return '';
  }
}

// Real IndicTrans2 server call (localhost:8080) with mock fallback
async function runIndicTrans(rawText: string): Promise<{ detectedLanguage: string; translatedText: string }> {
  if (!isIndicTransConfigured() || !rawText.trim()) {
    // Mock fallback
    const hasDevanagari = /[\u0900-\u097F]/.test(rawText);
    return {
      detectedLanguage: hasDevanagari ? 'hi' : 'en',
      translatedText: hasDevanagari ? `Translated(IndicTrans): ${rawText.slice(0, 200)}` : rawText,
    };
  }

  try {
    const res = await fetch(`${config.indicTransApiUrl}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentences: [rawText],
        src_lang: 'auto',  // server will handle detection via preprocessing
        tgt_lang: 'en',    // translate to English for Gemini
      }),
    });
    if (!res.ok) throw new Error(`IndicTrans ${res.status}`);
    const data = await res.json();
    return {
      detectedLanguage: data.src_lang ?? 'en', // server auto-detects via script ranges
      translatedText: data.translations?.[0] ?? rawText,
    };
  } catch (e) {
    console.warn('[gemini] IndicTrans server call failed, using mock:', (e as Error).message);
    pipelineWarnings.push('IndicTrans server unreachable — translation skipped (start indictrans-server or check VITE_INDICTRAN_API_URL)');
    const hasDevanagari = /[\u0900-\u097F]/.test(rawText);
    return {
      detectedLanguage: hasDevanagari ? 'hi' : 'en',
      translatedText: hasDevanagari ? `Translated(IndicTrans): ${rawText.slice(0, 200)}` : rawText,
    };
  }
}

interface GeminiOptions {
  prompt: string;
  imageBase64?: string;
  mimeType?: string;
  /** App language code (en/hi/ur/tam/…) — picks the Tesseract traineddata set. */
  language?: string | null;
  retries?: number;
}

export async function callGemini({ prompt, imageBase64, mimeType = 'image/jpeg', language, retries = MAX_RETRIES }: GeminiOptions): Promise<string> {
  checkRateLimit();

  // Build hybrid context: Tesseract + IndicTrans preprocessing (both client-side, free)
  let tesseractText = '';
  let indic: { detectedLanguage: string; translatedText: string } = { detectedLanguage: 'en', translatedText: '' };
  if (imageBase64) {
    tesseractText = await runTesseract(imageBase64, mimeType, language);
    if (tesseractText) indic = await runIndicTrans(tesseractText);
  }

  const combinedPrompt = `${prompt}

--- HYBRID PREPROCESSING CONTEXT (DO NOT RE-OCR, RECONCILE THESE) ---
Document language hint: ${language ? String(language).trim().toLowerCase() : 'unspecified'} (Tesseract langs: ${tesseractLangsFor(language).join('+')})
Tesseract OCR raw: ${tesseractText.slice(0, 4000)}
IndicTrans detected_language: ${indic.detectedLanguage}
IndicTrans translated_text: ${indic.translatedText.slice(0, 4000)}
--- END CONTEXT ---
Reconcile both outputs, preserve original_text, include translated_text, detected language, and structured extracted_fields with confidence per field. Return ONLY valid JSON.`;

  const cleanB64 = imageBase64?.replace(/^data:[^;]+;base64,/, '');
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in required — document extraction runs through an authenticated proxy.');
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prompt: combinedPrompt, imageBase64: cleanB64, mimeType }),
      });
      const json = (await res.json().catch(() => null)) as { text?: string; error?: string } | null;
      if (!res.ok || !json?.text) {
        throw new Error(json?.error ? `Gemini ${res.status}: ${json.error}` : `Gemini ${res.status}`);
      }
      return json.text;
    } catch (e) {
      lastErr = e as Error;
      if (attempt < retries) {
        const backoff = 500 * 2 ** attempt;
        console.warn(`[gemini] retry ${attempt + 1}/${retries} after ${backoff}ms:`, lastErr.message);
        await delay(backoff);
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr!;
}

// Convenience: upload file → base64 → callGemini
export async function extractFromFile(file: File, prompt: string, language?: string | null): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsDataURL(file);
  });
  const mime = file.type || 'image/jpeg';
  const cleanB64 = base64.replace(/^data:[^;]+;base64,/, '');
  return callGemini({ prompt, imageBase64: cleanB64, mimeType: mime, language });
}
