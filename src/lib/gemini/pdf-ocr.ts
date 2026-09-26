/**
 * Pure helpers for PDF preprocessing and OCR.
 *
 * No DOM, no pdfjs-dist runtime imports, no fetch — can run in Node/vitest.
 */

export const PDF_OCR_DEFAULT_MAX_PAGES = 5;
export const PDF_OCR_TARGET_PX = 1700; // ~150-170 dpi on A4 (optimal for OCR accuracy/speed)
export const PDF_OCR_MIN_SCALE = 1;
export const PDF_OCR_MAX_SCALE = 3;

/**
 * Decodes a clean base64 string into a Uint8Array buffer without DOM/fetch.
 */
export function decodeBase64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/^data:[^;]+;base64,/, '').trim();
  const binary = atob(clean);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Determines which 1-based page numbers to rasterize and OCR.
 * maxPages <= 0 means uncapped (all pages).
 */
export function pdfPagesToRead(totalPages: number, maxPages = PDF_OCR_DEFAULT_MAX_PAGES): number[] {
  if (totalPages <= 0) return [];
  const limit = maxPages > 0 ? Math.min(totalPages, maxPages) : totalPages;
  const pages: number[] = [];
  for (let i = 1; i <= limit; i++) {
    pages.push(i);
  }
  return pages;
}

/**
 * Computes a canvas rendering scale factor so the rendered page width is
 * around `targetPx` for crisp OCR text, clamped between 1.0 and 3.0.
 */
export function pdfRasterScale(pageWidth: number, targetPx = PDF_OCR_TARGET_PX): number {
  if (!pageWidth || pageWidth <= 0) return 1.5;
  const desired = targetPx / pageWidth;
  return Math.max(PDF_OCR_MIN_SCALE, Math.min(PDF_OCR_MAX_SCALE, Math.round(desired * 10) / 10));
}

/**
 * Joins OCR texts from multiple pages into one structured text string.
 */
export function joinPdfPageText(pages: { page: number; text: string }[]): string {
  const nonBlank = pages.filter((p) => p.text.trim().length > 0);
  if (nonBlank.length === 0) return '';
  if (nonBlank.length === 1 && nonBlank[0].page === 1 && pages.length === 1) {
    return nonBlank[0].text.trim();
  }
  return nonBlank
    .map((p) => `--- PAGE ${p.page} ---\n${p.text.trim()}`)
    .join('\n\n');
}

/**
 * Short descriptive string for the pipeline report / UI.
 */
export function pdfOcrDetail(pagesRead: number, totalPages: number): string {
  if (totalPages <= 0) return 'PDF OCR';
  if (pagesRead >= totalPages) {
    return `PDF (${pagesRead} ${pagesRead === 1 ? 'page' : 'pages'})`;
  }
  return `PDF (pages 1–${pagesRead} of ${totalPages})`;
}

/**
 * Non-fatal pipeline warning when a PDF had more pages than the page cap.
 */
export function pdfOcrWarning(pagesRead: number, totalPages: number): string | null {
  if (totalPages > pagesRead) {
    return `PDF had ${totalPages} pages; first ${pagesRead} were processed by local Tesseract OCR (Gemini analyzed the full document).`;
  }
  return null;
}
