/**
 * Gemini Client — PROMPT 13
 * Hybrid: Tesseract OCR (raw text) → IndicTrans (detect/translate) → Gemini (structured JSON)
 * Rate limit 15/min, retries 3, uses config.ts VITE_GEMINI_API_KEY via import.meta.env
 */
import { config, isGeminiConfigured, isIndicTransConfigured } from '../config';

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

// Simulated Tesseract step (in production use tesseract.js in browser)
async function runTesseractMock(imageBase64: string): Promise<string> {
  if (!imageBase64) return '';
  return `TESSERACT_RAW_TEXT (simulated, ${Math.round(imageBase64.length / 1024)}KB image) — extracted for IndicTrans preprocessing`;
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
    console.warn('[gemini] VITE_GEMINI_API_KEY not configured — returning mock extraction');
    await delay(400);
    return JSON.stringify(
      {
        original_text: 'MOCK_ORIGINAL (fill VITE_GEMINI_API_KEY to enable live)',
        translated_text: 'MOCK_TRANSLATED',
        extracted_fields: { owner_name: 'Mock Singh', survey_number: 'MOCK-001', land_area: '2.5 ha' },
        confidence: 0.72,
        confidence_per_field: { owner_name: 0.85, survey_number: 0.6, land_area: 0.7 },
        document_language: 'hi',
      },
      null,
      2,
    );
  }

  checkRateLimit();

  // Build hybrid context: Tesseract + IndicTrans preprocessing
  let tesseractText = '';
  let indic: { detectedLanguage: string; translatedText: string } = { detectedLanguage: 'en', translatedText: '' };
  if (imageBase64) {
    tesseractText = await runTesseractMock(imageBase64);
    indic = await runIndicTrans(tesseractText);
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
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.geminiApiKey}`;

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
