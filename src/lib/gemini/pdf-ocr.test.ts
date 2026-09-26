import { describe, it, expect } from 'vitest';
import {
  decodeBase64ToBytes,
  pdfPagesToRead,
  pdfRasterScale,
  joinPdfPageText,
  pdfOcrDetail,
  pdfOcrWarning,
} from './pdf-ocr';

describe('pdf-ocr pure helpers', () => {
  describe('decodeBase64ToBytes', () => {
    it('decodes simple base64 strings into Uint8Array', () => {
      const b64 = btoa('Hello PDF');
      const bytes = decodeBase64ToBytes(b64);
      expect(new TextDecoder().decode(bytes)).toBe('Hello PDF');
    });

    it('strips data:application/pdf;base64, prefix', () => {
      const b64 = 'data:application/pdf;base64,' + btoa('%PDF-1.4');
      const bytes = decodeBase64ToBytes(b64);
      expect(new TextDecoder().decode(bytes)).toBe('%PDF-1.4');
    });
  });

  describe('pdfPagesToRead', () => {
    it('returns empty array when totalPages <= 0', () => {
      expect(pdfPagesToRead(0)).toEqual([]);
      expect(pdfPagesToRead(-1)).toEqual([]);
    });

    it('caps pages to maxPages by default (5)', () => {
      expect(pdfPagesToRead(3)).toEqual([1, 2, 3]);
      expect(pdfPagesToRead(10)).toEqual([1, 2, 3, 4, 5]);
    });

    it('supports custom cap', () => {
      expect(pdfPagesToRead(10, 2)).toEqual([1, 2]);
    });

    it('returns all pages if maxPages <= 0', () => {
      expect(pdfPagesToRead(8, 0)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
  });

  describe('pdfRasterScale', () => {
    it('scales normal A4 page (~595pt) to reach targetPx (~1700px)', () => {
      const scale = pdfRasterScale(595, 1700);
      expect(scale).toBeCloseTo(2.9, 1);
    });

    it('clamps to max 3.0', () => {
      expect(pdfRasterScale(300, 1700)).toBe(3.0);
    });

    it('clamps to min 1.0', () => {
      expect(pdfRasterScale(2500, 1700)).toBe(1.0);
    });
  });

  describe('joinPdfPageText', () => {
    it('returns single page text directly if only 1 page', () => {
      expect(joinPdfPageText([{ page: 1, text: 'Single page text' }])).toBe('Single page text');
    });

    it('joins multi-page texts with page markers', () => {
      const joined = joinPdfPageText([
        { page: 1, text: 'Page 1 text' },
        { page: 2, text: 'Page 2 text' },
      ]);
      expect(joined).toContain('--- PAGE 1 ---');
      expect(joined).toContain('Page 1 text');
      expect(joined).toContain('--- PAGE 2 ---');
      expect(joined).toContain('Page 2 text');
    });

    it('omits blank pages', () => {
      const joined = joinPdfPageText([
        { page: 1, text: 'Real text' },
        { page: 2, text: '   ' },
      ]);
      expect(joined).toBe('--- PAGE 1 ---\nReal text');
    });
  });

  describe('pdfOcrDetail and pdfOcrWarning', () => {
    it('produces descriptive detail string', () => {
      expect(pdfOcrDetail(1, 1)).toBe('PDF (1 page)');
      expect(pdfOcrDetail(3, 3)).toBe('PDF (3 pages)');
      expect(pdfOcrDetail(5, 12)).toBe('PDF (pages 1–5 of 12)');
    });

    it('warns only when pages were capped', () => {
      expect(pdfOcrWarning(3, 3)).toBeNull();
      const warning = pdfOcrWarning(5, 12);
      expect(warning).toContain('12 pages; first 5 were processed');
    });
  });
});
