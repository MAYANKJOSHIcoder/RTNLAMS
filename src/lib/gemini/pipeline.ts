/**
 * OCR / translation pipeline planning + provenance.
 *
 * Pure helpers only (no DOM, no tesseract.js, no fetch) so they can be unit
 * tested and rendered by the UI — the same pattern as `ocr-langs.ts`.
 *
 * Why this module exists:
 *  1. `runTesseract` returns '' for `application/pdf`, which silently disables
 *     IndicTrans too (it needs raw text), so a PDF is 100% Gemini vision. That
 *     used to be invisible: the reviewer only saw "Extracted Fields".
 *  2. The old IndicTrans fallback returned a fabricated
 *     `Translated(IndicTrans): <first 200 chars>` string which was pasted into
 *     the Gemini prompt and could be persisted into `documents.translated_text`
 *     as if it were a real translation.
 *  3. Nobody could tell, per document, which engine produced which output. The
 *     report below is stored in `documents.ocr_extracted_data.pipeline` (JSONB,
 *     no migration needed) and rendered in the OCR Review modal.
 */

export type StepStatus = 'ran' | 'skipped' | 'failed' | 'mock';

/** Persisted inside `documents.ocr_extracted_data.pipeline`. */
export interface PipelineReport {
  tesseract: StepStatus;
  tesseractDetail: string;
  tesseractLangs: string[];
  indicTrans: StepStatus;
  indicTransDetail: string;
  detectedLanguage: string | null;
}

export interface StepPlan {
  status: StepStatus;
  detail: string;
  warning?: string;
}

export const PDF_NO_LOCAL_OCR =
  'PDF input: Tesseract + IndicTrans2 skipped (no local text extraction) — Gemini vision produced these fields alone';

/** Tesseract only runs for raster images — PDFs go straight to Gemini vision. */
export function planTesseract(imageBase64?: string | null, mimeType?: string | null): StepPlan {
  if (!imageBase64) return { status: 'skipped', detail: 'no image payload' };
  if (mimeType === 'application/pdf') {
    return { status: 'skipped', detail: 'PDF input — local OCR not available', warning: PDF_NO_LOCAL_OCR };
  }
  return { status: 'ran', detail: '' };
}

/** IndicTrans needs local OCR text; without it there is nothing to translate. */
export function planIndicTrans(tesseractText: string, configured: boolean): StepPlan {
  if (!tesseractText.trim()) {
    return { status: 'skipped', detail: 'no local OCR text to translate' };
  }
  if (!configured) {
    return {
      status: 'mock',
      detail: 'IndicTrans2 server not configured',
      warning: 'IndicTrans2 not configured — translation left to Gemini (set VITE_INDICTRAN_API_URL)',
    };
  }
  return { status: 'ran', detail: '' };
}

export function tesseractFailure(langs: string[], message: string): StepPlan {
  return {
    status: 'failed',
    detail: message,
    warning: `Tesseract OCR failed (${langs.join('+')}): ${message} — Gemini vision used alone`,
  };
}

export function indicTransFailure(message: string): StepPlan {
  return {
    status: 'failed',
    detail: message,
    warning: `IndicTrans2 unreachable (${message}) — translation left to Gemini`,
  };
}


/**
 * Script-range language detection. Used as a last resort when IndicTrans cannot
 * report a language (server down / not configured) so the report still says
 * something truthful instead of guessing 'en'.
 */
const SCRIPT_LANG: [string, RegExp][] = [
  ['ur', /[\u0600-\u06FF]/],
  ['hi', /[\u0900-\u097F]/],
  ['bn', /[\u0980-\u09FF]/],
  ['pa', /[\u0A00-\u0A7F]/],
  ['gu', /[\u0A80-\u0AFF]/],
  ['or', /[\u0B00-\u0B7F]/],
  ['ta', /[\u0B80-\u0BFF]/],
  ['te', /[\u0C00-\u0C7F]/],
  ['kn', /[\u0C80-\u0CFF]/],
  ['ml', /[\u0D00-\u0D7F]/],
];

export function detectScriptLang(text: string): string {
  for (const [lang, re] of SCRIPT_LANG) {
    if (re.test(text)) return lang;
  }
  return 'en';
}

/**
 * The "translated" channel handed to Gemini. NEVER fabricates text: an
 * unavailable engine says so, and the prompt explicitly forbids inventing it.
 */
export function translationForPrompt(text: string, status: StepStatus): string {
  if (text.trim()) return text.slice(0, 4000);
  if (status === 'ran') return '(IndicTrans2 returned an empty translation)';
  return '(unavailable — do not invent; translate from the original text/image instead)';
}

export interface PreprocessingInput {
  language?: string | null;
  tesseractLangs: string[];
  tesseract: StepStatus;
  tesseractDetail: string;
  tesseractText: string;
  indicTrans: StepStatus;
  indicTransDetail: string;
  detectedLanguage: string;
  translatedText: string;
}

/** The `--- HYBRID PREPROCESSING CONTEXT ---` block appended to every prompt. */
export function buildPreprocessingContext(input: PreprocessingInput): string {
  const raw = input.tesseractText.trim()
    ? input.tesseractText.slice(0, 4000)
    : `(not run — ${input.tesseractDetail || 'no local OCR'})`;
  const langHint = input.language ? String(input.language).trim().toLowerCase() : 'unspecified';
  return [
    '--- HYBRID PREPROCESSING CONTEXT (DO NOT RE-OCR, RECONCILE THESE) ---',
    `Document language hint: ${langHint} (Tesseract langs: ${input.tesseractLangs.join('+') || 'n/a'})`,
    `Tesseract OCR status: ${input.tesseract}`,
    `Tesseract OCR raw: ${raw}`,
    `IndicTrans status: ${input.indicTrans}${input.indicTransDetail ? ` (${input.indicTransDetail})` : ''}`,
    `IndicTrans detected_language: ${input.detectedLanguage}`,
    `IndicTrans translated_text: ${translationForPrompt(input.translatedText, input.indicTrans)}`,
    '--- END CONTEXT ---',
    'Reconcile only the channels provided above, preserve original_text, include translated_text, detected language, and structured extracted_fields with confidence per field.',
    'If a channel above is unavailable or empty, leave its output empty — do not fabricate or paraphrase it. Return ONLY valid JSON.',
  ].join('\n');
}

/** One-line provenance for the UI ("who produced this?"). */
export function describePipeline(report: PipelineReport): { ocr: string; translation: string; extraction: string } {
  const ocr =
    report.tesseract === 'ran'
      ? `Tesseract (${report.tesseractLangs.join('+') || 'eng'})`
      : report.tesseract === 'failed'
        ? 'Tesseract failed'
        : report.tesseractDetail || 'Tesseract not run';

  const translation =
    report.indicTrans === 'ran'
      ? 'IndicTrans2 → English'
      : report.indicTrans === 'skipped'
        ? 'skipped (nothing to translate locally)'
        : `Gemini only (${report.indicTransDetail || 'IndicTrans2 unavailable'})`;

  return { ocr, translation, extraction: 'Gemini structured JSON' };
}
