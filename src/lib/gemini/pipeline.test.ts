import { describe, it, expect } from 'vitest';
import {
  buildPreprocessingContext,
  describePipeline,
  describePipelineState,
  detectScriptLang,
  indicTransFailure,
  indicTransInput,
  indicTransTimeout,
  indicTransTruncatedWarning,
  PIPELINE_NONE_COPY,
  PIPELINE_UNRECORDED_COPY,
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
  it('skips when the source document is English (target is English)', () => {
    const plan = planIndicTrans('some text', true, 'en');
    expect(plan.status).toBe('skipped');
    expect(plan.detail).toMatch(/source language is English/);
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

describe('describePipelineState', () => {
  const report = (over: Partial<PipelineReport> = {}): PipelineReport => ({
    tesseract: 'ran',
    tesseractDetail: 'PDF (1 page)',
    tesseractLangs: ['eng', 'hin'],
    indicTrans: 'ran',
    indicTransDetail: 'HTTP 200',
    detectedLanguage: 'hi',
    ...over,
  });

  it('reports "none" for a row that was never extracted', () => {
    expect(describePipelineState(null)).toEqual({ kind: 'none' });
    expect(describePipelineState(undefined)).toEqual({ kind: 'none' });
    expect(describePipelineState({})).toEqual({ kind: 'none' });
  });

  it('reports "unrecorded" only when fields exist without a pipeline report', () => {
    expect(describePipelineState({ extracted_fields: { land_area: '0.4 ha' } })).toEqual({
      kind: 'unrecorded',
      fields: 1,
    });
  });

  it('reports "recorded" with the whole report', () => {
    const state = describePipelineState({ extracted_fields: { land_area: 'x' }, pipeline: report() });
    expect(state).toEqual({ kind: 'recorded', report: report() });
  });

  it('keeps "never extracted" and "extracted before provenance" words apart', () => {
    // Regression: `null` JSONB used to render "extracted before provenance
    // tracking — re-extract", which hid a failed or never-run pipeline behind
    // the claim that an extraction had happened.
    expect(PIPELINE_NONE_COPY).toMatch(/Not extracted yet/);
    expect(PIPELINE_NONE_COPY).not.toMatch(/extracted before provenance/);
    expect(PIPELINE_UNRECORDED_COPY).toMatch(/extracted before provenance tracking/);
  });
});

describe('Gemini validation directive', () => {
  it('tells Gemini to validate the OCR draft against the document', () => {
    const ctx = buildPreprocessingContext(base());
    expect(ctx).toContain('DRAFT transcription to VALIDATE');
    expect(ctx).toContain('corrected text as original_text');
  });

  it('hands the whole step to Gemini when local OCR produced nothing (fallback)', () => {
    const ctx = buildPreprocessingContext(
      base({
        tesseract: 'failed',
        tesseractDetail: 'worker init failed',
        tesseractText: '',
        indicTrans: 'skipped',
        indicTransDetail: 'no local OCR text to translate',
        translatedText: '',
      }),
    );
    expect(ctx).toContain('Tesseract OCR status: failed');
    expect(ctx).toContain('No usable local OCR text');
    expect(ctx).not.toContain('DRAFT transcription to VALIDATE');
  });
});

describe('indicTransInput', () => {
  it('trims but otherwise passes short text through', () => {
    expect(indicTransInput('  land deed  ', 100)).toEqual({ text: 'land deed', truncated: false, chars: 9 });
  });

  it('caps long text at the budget', () => {
    const out = indicTransInput('x'.repeat(5000), 1200);
    expect(out.truncated).toBe(true);
    expect(out.text).toHaveLength(1200);
    expect(out.chars).toBe(1200);
  });

  it('treats a non-positive budget as unlimited', () => {
    expect(indicTransInput('abc', 0)).toEqual({ text: 'abc', truncated: false, chars: 3 });
  });

  it('flags truncation only when characters were actually dropped', () => {
    expect(indicTransInput('x'.repeat(1200), 1200).truncated).toBe(false);
    expect(indicTransInput('x'.repeat(1201), 1200).truncated).toBe(true);
  });
});

describe('indicTransTimeout', () => {
  it('is a failed step that still falls back to Gemini', () => {
    const plan = indicTransTimeout(35);
    expect(plan.status).toBe('failed');
    expect(plan.detail).toBe('timeout after 35s');
    expect(plan.warning).toContain('Gemini');
  });

  it('is worded differently from an unreachable server', () => {
    // A slow engine and a dead one need different fixes — never the same message.
    expect(indicTransTimeout(35).warning).not.toBe(indicTransFailure('ECONNREFUSED').warning);
    expect(indicTransTimeout(35).warning).toContain('timed out');
    expect(indicTransFailure('ECONNREFUSED').warning).toContain('unreachable');
  });
});

describe('indicTransTruncatedWarning', () => {
  it('reports both counts and who covers the rest', () => {
    const warning = indicTransTruncatedWarning(5000, 1200);
    expect(warning).toContain('1200');
    expect(warning).toContain('5000');
    expect(warning).toContain('Gemini');
  });
});
