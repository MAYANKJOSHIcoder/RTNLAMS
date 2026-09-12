/**
 * Gemini Client — PROMPT 13
 * Hybrid: Tesseract OCR (raw text) → IndicTrans (detect/translate) → Gemini (structured JSON)
 * Rate limit 15/min, retries 3, uses config.ts VITE_GEMINI_API_KEY via import.meta.env
 */
import { config, isGeminiConfigured, isIndicTransConfigured } from '../config';
import type { Worker } from 'tesseract.js';

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

// Real Tesseract OCR (WASM, runs in a Web Worker; eng+hin+urd traineddata cached after first use).
// tesseract.js is ~2MB — dynamically imported only when OCR actually runs, never on page load.
let tesseractWorker: Promise<Worker> | null = null;
async function getTesseractWorker(): Promise<Worker> {
  tesseractWorker ??= (async () => {
    const { createWorker } = await import('tesseract.js');
    return createWorker(['eng', 'hin', 'urd']);
  })();
  return tesseractWorker;
}

async function runTesseract(imageBase64: string, mimeType: string): Promise<string> {
  if (!imageBase64 || mimeType === 'application/pdf') return ''; // PDFs go straight to Gemini vision
  try {
    const worker = await getTesseractWorker();
    const { data: { text } } = await worker.recognize(`data:${mimeType};base64,${imageBase64}`);
    return text.trim();
  } catch (e) {
    console.warn('[gemini] Tesseract failed, continuing without local OCR:', (e as Error).message);
    pipelineWarnings.push('Tesseract OCR failed — Gemini vision used alone');
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
  retries?: number;
}

export async function callGemini({ prompt, imageBase64, mimeType = 'image/jpeg', retries = MAX_RETRIES }: GeminiOptions): Promise<string> {
  if (!isGeminiConfigured() || !config.geminiApiKey) {
    throw new Error('Gemini API key not configured — fill VITE_GEMINI_API_KEY in .env');
  }

  checkRateLimit();

  // Build hybrid context: Tesseract + IndicTrans preprocessing
  let tesseractText = '';
  let indic: { detectedLanguage: string; translatedText: string } = { detectedLanguage: 'en', translatedText: '' };
  if (imageBase64) {
    tesseractText = await runTesseract(imageBase64, mimeType);
    if (tesseractText) indic = await runIndicTrans(tesseractText);
  }

  const combinedPrompt = `${prompt}

--- HYBRID PREPROCESSING CONTEXT (DO NOT RE-OCR, RECONCILE THESE) ---
Tesseract OCR raw: ${tesseractText.slice(0, 4000)}
IndicTrans detected_language: ${indic.detectedLanguage}
IndicTrans translated_text: ${indic.translatedText.slice(0, 4000)}
--- END CONTEXT ---
Reconcile both outputs, preserve original_text, include translated_text, detected language, and structured extracted_fields with confidence per field. Return ONLY valid JSON.`;

  const body: Record<string, unknown> = {
    contents: [
      {
        parts: [
          { text: combinedPrompt },
          ...(imageBase64
            ? [{ inline_data: { mime_type: mimeType, data: imageBase64.replace(/^data:[^;]+;base64,/, '') } }]
            : []),
        ],
      },
    ],
    // ponytail: no temperature — Gemini 3.x rejects non-default values
    generationConfig: { responseMimeType: 'application/json' },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Gemini ${res.status}: ${txt.slice(0, 500)}`);
      }
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!text) throw new Error('Empty Gemini response');
      return text;
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
export async function extractFromFile(file: File, prompt: string): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsDataURL(file);
  });
  const mime = file.type || 'image/jpeg';
  const cleanB64 = base64.replace(/^data:[^;]+;base64,/, '');
  return callGemini({ prompt, imageBase64: cleanB64, mimeType: mime });
}
