/**
 * PDF Rasterization for in-browser Tesseract OCR.
 *
 * Dynamically imports `pdfjs-dist` so the bundle is not loaded until
 * a PDF document is actually processed.
 */
import {
  pdfPagesToRead,
  pdfRasterScale,
  PDF_OCR_DEFAULT_MAX_PAGES,
  PDF_OCR_TARGET_PX,
} from './pdf-ocr';

export interface RasterizedPage {
  page: number;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export interface PdfRasterResult {
  pages: RasterizedPage[];
  totalPages: number;
  pagesRead: number;
}

export interface RasterizeOptions {
  maxPages?: number;
  targetPx?: number;
  onProgress?: (current: number, total: number) => void;
}

let pdfjsInitialized = false;

async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjsInitialized) {
    const base = `${import.meta.env.BASE_URL || '/'}pdfjs`;
    pdfjs.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.mjs`;
    pdfjsInitialized = true;
  }
  return pdfjs;
}

/**
 * Rasterizes pages of a PDF into HTMLCanvasElements ready for Tesseract OCR.
 */
export async function rasterizePdf(
  pdfBytes: Uint8Array,
  opts: RasterizeOptions = {},
): Promise<PdfRasterResult> {
  const maxPages = opts.maxPages ?? PDF_OCR_DEFAULT_MAX_PAGES;
  const targetPx = opts.targetPx ?? PDF_OCR_TARGET_PX;

  const pdfjs = await getPdfjs();
  const base = `${import.meta.env.BASE_URL || '/'}pdfjs`;

  const loadingTask = pdfjs.getDocument({
    data: pdfBytes,
    cMapUrl: `${base}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}/standard_fonts/`,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const pageNumbers = pdfPagesToRead(totalPages, maxPages);
  const rasterized: RasterizedPage[] = [];

  try {
    for (const pageNum of pageNumbers) {
      opts.onProgress?.(pageNum, pageNumbers.length);
      const page = await pdfDoc.getPage(pageNum);
      const baseViewport = page.getViewport({ scale: 1.0 });
      const scale = pdfRasterScale(baseViewport.width, targetPx);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        throw new Error(`Failed to create 2D canvas context for PDF page ${pageNum}`);
      }

      await page.render({
        canvas,
        canvasContext: ctx,
        viewport,
        intent: 'print',
      }).promise;

      page.cleanup();

      rasterized.push({
        page: pageNum,
        canvas,
        width: canvas.width,
        height: canvas.height,
      });
    }

    return {
      pages: rasterized,
      totalPages,
      pagesRead: pageNumbers.length,
    };
  } finally {
    void pdfDoc.cleanup();
    void loadingTask.destroy();
  }
}
