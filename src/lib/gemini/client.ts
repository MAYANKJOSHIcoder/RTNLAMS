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
import {
  buildPreprocessingContext,
  detectScriptLang,
  indicTransFailure,
  planIndicTrans,
  planTesseract,
  tesseractFailure,
  type PipelineReport,
  type StepStatus,
} from './pipeline';
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

// Provenance of the most recent callGemini() run — consumed by useGemini and
// stored in `documents.ocr_extracted_data.pipeline` so the OCR Review modal can
// say which engine produced the text (Tesseract? IndicTrans2? Gemini alone?).
let lastPipelineReport: PipelineReport | null = null;
export function consumePipelineReport(): PipelineReport | null {
  const r = lastPipelineReport;
  lastPipelineReport = null;
  return r;
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

// tesseract.js defaults workerPath + corePath to cdn.jsdelivr.net, which the
// production CSP blocks → the worker never starts and OCR fails silently in
// exactly the way the MapLibre map used to (see ParcelMap.setWorkerUrl).
// These two assets are self-hosted instead; only the traineddata still comes
// from jsDelivr (allow-listed in vercel.json connect-src) because the 14
// supported language models are far too large to ship.
const TESSERACT_ASSET_BASE = `${import.meta.env.BASE_URL}tesseract`;

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
    // oem stays undefined → OEM.LSTM_ONLY default, matching the copied cores
    return createWorker(langs, undefined, {
      workerPath: `${TESSERACT_ASSET_BASE}/worker.min.js`,
      corePath: TESSERACT_ASSET_BASE,
    });
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

interface OcrOutcome {
  text: string;
  /** Non-null when Tesseract itself threw — recorded in the pipeline report. */
  failure: string | null;
}

async function runTesseract(imageBase64: string, mimeType: string, appLang?: string | null): Promise<OcrOutcome> {
  // PDFs have no raster path here — the caller's plan already knows this, the
  // guard keeps the function safe when called directly.
  if (!imageBase64 || mimeType === 'application/pdf') return { text: '', failure: null };
  const langs = tesseractLangsFor(appLang);
  try {
    const worker = await getTesseractWorker(langs);
    const { data: { text } } = await worker.recognize(`data:${mimeType};base64,${imageBase64}`);
    return { text: text.trim(), failure: null };
  } catch (e) {
    const message = (e as Error).message;
    console.warn('[gemini] Tesseract failed, continuing without local OCR:', message);
    const plan = tesseractFailure(langs, message);
    if (plan.warning) pipelineWarnings.push(plan.warning);
    return { text: '', failure: message };
  }
}

interface IndicTransOutcome {
  detectedLanguage: string;
  translatedText: string;
  status: StepStatus;
  detail: string;
}

// Real IndicTrans2 server call (localhost:8080).
// There is deliberately NO fabricated fallback: the old mock returned
// `Translated(IndicTrans): <first 200 chars>`, which was pasted into the Gemini
// prompt and could be persisted into documents.translated_text as if a real
// translation had happened. An unavailable engine now reports as unavailable
// and Gemini is told explicitly not to invent it.
async function runIndicTrans(rawText: string): Promise<IndicTransOutcome> {
  const plan = planIndicTrans(rawText, isIndicTransConfigured());
  if (plan.status !== 'ran') {
    if (plan.warning) pipelineWarnings.push(plan.warning);
    return { detectedLanguage: detectScriptLang(rawText), translatedText: '', status: plan.status, detail: plan.detail };
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
      detectedLanguage: data.src_lang ?? detectScriptLang(rawText), // server detects via script ranges
      translatedText: String(data.translations?.[0] ?? ''),
      status: 'ran',
      detail: `HTTP ${res.status}`,
    };
  } catch (e) {
    const message = (e as Error).message;
    console.warn('[gemini] IndicTrans server call failed, continuing without translation:', message);
    const fail = indicTransFailure(message);
    if (fail.warning) pipelineWarnings.push(fail.warning);
    return { detectedLanguage: detectScriptLang(rawText), translatedText: '', status: 'failed', detail: message };
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

  // Plan the local preprocessing first: a PDF has no raster path, so saying so
  // out loud (warning + provenance) is better than silently shipping a
  // Gemini-only extraction that looks identical to a hybrid one.
  const tesseractLangs = tesseractLangsFor(language);
  const ocrPlan = planTesseract(imageBase64, mimeType);
  if (ocrPlan.warning) pipelineWarnings.push(ocrPlan.warning);

  let tesseractText = '';
  let ocrStatus: StepStatus = ocrPlan.status;
  let ocrDetail = ocrPlan.detail;
  if (ocrPlan.status === 'ran') {
    const ocr = await runTesseract(imageBase64 as string, mimeType, language);
    tesseractText = ocr.text;
    if (ocr.failure) {
      ocrStatus = 'failed';
      ocrDetail = ocr.failure;
    }
  }

  let indicTransText = '';
  let detectedLanguage = detectScriptLang(tesseractText);
  let indicStatus: StepStatus = 'skipped';
  let indicDetail = 'no local OCR text to translate';
  if (tesseractText) {
    const indic = await runIndicTrans(tesseractText);
    indicTransText = indic.translatedText;
    detectedLanguage = indic.detectedLanguage;
    indicStatus = indic.status;
    indicDetail = indic.detail;
  }

  const combinedPrompt = `${prompt}\n\n${buildPreprocessingContext({
    language,
    tesseractLangs,
    tesseract: ocrStatus,
    tesseractDetail: ocrDetail,
    tesseractText,
    indicTrans: indicStatus,
    indicTransDetail: indicDetail,
    detectedLanguage,
    translatedText: indicTransText,
  })}`;

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
      // Provenance for this run — picked up by useGemini and stored in JSONB.
      lastPipelineReport = {
        tesseract: ocrStatus,
        tesseractDetail: ocrDetail,
        tesseractLangs,
        indicTrans: indicStatus,
        indicTransDetail: indicDetail,
        detectedLanguage,
      };
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
