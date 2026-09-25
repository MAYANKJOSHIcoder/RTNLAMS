/**
 * Tesseract OCR language selection.
 *
 * Pure lookup helpers (no tesseract.js / DOM imports) so they can be unit-tested
 * and reused by the upload UI. `client.ts` builds the actual workers from these.
 *
 * Indian land records are mixed-script: Latin appears in survey numbers, stamp
 * duty and registration dates even when the body is Hindi/Urdu/Tamil. So the
 * regional script is always paired with `eng`, and `eng` stays FIRST because
 * Tesseract resolves ambiguous glyphs using the leading language.
 */

/** App language code (DocumentUpload dropdown / documents.language) → Tesseract traineddata code. */
export const OCR_LANG_MAP: Record<string, string> = {
  en: 'eng',
  hi: 'hin',
  ur: 'urd',
  bn: 'ben',
  as: 'asm',
  pa: 'pan',
  gu: 'guj',
  mr: 'mar',
  ta: 'tam',
  te: 'tel',
  kn: 'kan',
  ml: 'mal',
  or: 'ori',
  sa: 'san',
};

/** Mixed-script fallback when the caller has no language (old docs, auto-detect misses). */
export const OCR_DEFAULT_LANGS = ['eng', 'hin', 'urd'] as const;

/**
 * Tesseract language list for an app language code.
 * Handles region suffixes (`hi-IN`) and unknown codes (→ default set).
 */
export function tesseractLangsFor(appLang?: string | null): string[] {
  const code = (appLang ?? '').trim().toLowerCase();
  const mapped = OCR_LANG_MAP[code] ?? OCR_LANG_MAP[code.slice(0, 2)];
  if (!mapped) return [...OCR_DEFAULT_LANGS];
  return mapped === 'eng' ? ['eng'] : ['eng', mapped];
}
