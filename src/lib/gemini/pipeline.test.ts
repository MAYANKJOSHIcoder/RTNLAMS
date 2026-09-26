import { describe, it, expect } from 'vitest';
import {
  buildPreprocessingContext,
  describePipeline,
  detectScriptLang,
  indicTransFailure,
  planIndicTrans,
  planTesseract,
  tesseractFailure,
  translationForPrompt,
  type PipelineReport,
  type PreprocessingInput,
} from './pipeline';

const base = (over: Partial<PreprocessingInput> = {}): PreprocessingInput => ({
  language: 'ur',
  tesseractLangs: ['eng', 'urd'],
  tesseract: 'ran',
  tesseractDetail: '',
  tesseractText: 'مشتري زمین',
  indicTrans: 'ran',
  indicTransDetail: '',
  detectedLanguage: 'ur',
  translatedText: 'Land purchaser',
  ...over,
});

describe('planTesseract', () => {
  it('runs for raster images', () => {
    expect(planTesseract('AAAA', 'image/jpeg')).toEqual({ status: 'ran', detail: '' });
  });

  it('runs for PDFs via rasterization', () => {
    const plan = planTesseract('AAAA', 'application/pdf');
    expect(plan.status).toBe('ran');
    expect(plan.detail).toBe('PDF rasterization');
  });

  it('skips when there is no image payload at all', () => {
    const plan = planTesseract(undefined, 'image/png');
    expect(plan.status).toBe('skipped');
    expect(plan.warning).toBeUndefined();
  });
});

describe('planIndicTrans', () => {
  it('runs when there is local OCR text and a configured server', () => {
    expect(planIndicTrans('some text', true)).toEqual({ status: 'ran', detail: '' });
  });

  it('skips when Tesseract produced nothing (e.g. the PDF path)', () => {
    const plan = planIndicTrans('   ', true);
    expect(plan.status).toBe('skipped');
    expect(plan.detail).toMatch(/no local OCR text/);
  });

  it('reports mock + warning when the server is not configured', () => {
    const plan = planIndicTrans('some text', false);
    expect(plan.status).toBe('mock');
    expect(plan.warning).toBeTruthy();
  });
});

describe('failure plans', () => {
  it('names the traineddata set when Tesseract fails', () => {
    const plan = tesseractFailure(['eng', 'urd'], 'boom');
    expect(plan.status).toBe('failed');
    expect(plan.warning).toContain('eng+urd');
    expect(plan.warning).toContain('boom');
  });

  it('surfaces the reason when IndicTrans fails', () => {
    const plan = indicTransFailure('ECONNREFUSED');
    expect(plan.status).toBe('failed');
    expect(plan.detail).toBe('ECONNREFUSED');
    expect(plan.warning).toContain('ECONNREFUSED');
  });
});

describe('detectScriptLang', () => {
  it.each([
    ['hi', 'भूमि अधिग्रहण'],
    ['ur', 'زمین کی خریداری'],
    ['ta', 'நில கையகப்படுத்தல்'],
    ['bn', 'জমি অধিগ্রহণ'],
    ['gu', 'જમીન સંપાદન'],
  ])('detects %s from its script range', (lang, text) => {
    expect(detectScriptLang(text)).toBe(lang);
  });

  it('falls back to en for Latin script', () => {
    expect(detectScriptLang('Survey No. 170/2')).toBe('en');
  });
});

describe('translationForPrompt', () => {
  it('passes real translations through (truncated to 4000 chars)', () => {
    expect(translationForPrompt('Land purchaser', 'ran')).toBe('Land purchaser');
    expect(translationForPrompt('x'.repeat(5000), 'ran')).toHaveLength(4000);
  });

  it('never fabricates a translation when the engine did not run', () => {
    for (const status of ['mock', 'skipped', 'failed'] as const) {
      const out = translationForPrompt('', status);
      expect(out).toMatch(/unavailable/);
      expect(out).not.toMatch(/Translated\(IndicTrans\)/);
    }
  });
});

describe('buildPreprocessingContext', () => {
  it('includes both channels and the language hint', () => {
    const ctx = buildPreprocessingContext(base());
    expect(ctx).toContain('Document language hint: ur');
    expect(ctx).toContain('Tesseract langs: eng+urd');
    expect(ctx).toContain('Land purchaser');
    expect(ctx).toContain('Tesseract OCR raw: مشتري زمین');
  });

  it('marks a skipped OCR channel instead of sending empty text', () => {
    const ctx = buildPreprocessingContext(
      base({ tesseract: 'skipped', tesseractDetail: 'PDF input — local OCR not available', tesseractText: '', indicTrans: 'skipped', translatedText: '' }),
    );
    expect(ctx).toContain('Tesseract OCR status: skipped');
    expect(ctx).toContain('(not run — PDF input — local OCR not available)');
    expect(ctx).toContain('IndicTrans status: skipped');
  });

  it('never leaks a fabricated IndicTrans string into the prompt', () => {
    const ctx = buildPreprocessingContext(base({ indicTrans: 'mock', translatedText: '', detectedLanguage: 'ur' }));
    expect(ctx).not.toContain('Translated(IndicTrans):');
    expect(ctx).toContain('do not invent');
  });

  it('forbids invention explicitly', () => {
    expect(buildPreprocessingContext(base())).toMatch(/do not fabricate or paraphrase it/);
  });
});

describe('describePipeline', () => {
  const report = (over: Partial<PipelineReport> = {}): PipelineReport => ({
    tesseract: 'ran',
    tesseractDetail: '',
    tesseractLangs: ['eng', 'urd'],
    indicTrans: 'ran',
    indicTransDetail: '',
    detectedLanguage: 'ur',
    ...over,
  });

  it('names the OCR language set and the translation engine', () => {
    const out = describePipeline(report());
    expect(out.ocr).toBe('Tesseract (eng+urd)');
    expect(out.translation).toBe('IndicTrans2 → English');
  });

  it('says Gemini did it alone when local OCR never ran (PDF path)', () => {
    const out = describePipeline(report({ tesseract: 'skipped', tesseractDetail: 'PDF input — local OCR not available', indicTrans: 'skipped', indicTransDetail: 'no local OCR text to translate' }));
    expect(out.ocr).toContain('PDF input');
    expect(out.translation).toContain('skipped');
  });
});
