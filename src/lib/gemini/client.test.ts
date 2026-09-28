/**
 * Hand-off of the provenance report from callGemini() to useGemini().
 *
 * Regression guard: the report used to be consumed before the Supabase write, so
 * a failed write silently discarded the only record of which engine produced the
 * bytes — the next retry then had nothing to persist.
 */
import { describe, it, expect } from 'vitest';
import { consumePipelineReport, restorePipelineReport } from './client';
import type { PipelineReport } from './pipeline';

const report = (over: Partial<PipelineReport> = {}): PipelineReport => ({
  tesseract: 'ran',
  tesseractDetail: 'PDF (1 page)',
  tesseractLangs: ['eng', 'hin'],
  indicTrans: 'ran',
  indicTransDetail: 'HTTP 200',
  detectedLanguage: 'hi',
  ...over,
});

describe('pipeline report hand-off', () => {
  it('consumes a restored report exactly once', () => {
    restorePipelineReport(report());
    expect(consumePipelineReport()?.detectedLanguage).toBe('hi');
    expect(consumePipelineReport()).toBeNull();
  });

  it('never clobbers a report that is already pending', () => {
    restorePipelineReport(report());
    restorePipelineReport(report({ indicTrans: 'failed' }));
    expect(consumePipelineReport()?.indicTrans).toBe('ran');
    expect(consumePipelineReport()).toBeNull();
  });

  it('ignores null so a no-op failure cannot clear a pending report', () => {
    restorePipelineReport(report());
    restorePipelineReport(null);
    expect(consumePipelineReport()).not.toBeNull();
  });
});