import { describe, it, expect } from 'vitest';
import { WEIGHTS, clamp01, classifyRisk, calculateRisk, parseAreaHa, type RiskInput } from './risk';
import type { Parcel } from './types';

function parcel(partial: Partial<Parcel> = {}): Parcel {
  return {
    id: 'p1',
    project_id: 'proj',
    parcel_number: 'DL-001',
    owner_name: 'Test Owner',
    owner_aadhaar: '100000000001',
    area_hectares: 2,
    status: 'identified',
    risk_score: null,
    geometry: null,
    ...partial,
  } as unknown as Parcel;
}

const emptyInput = (p: Parcel): RiskInput => ({ parcel: p, documents: [], stages: [], auditLogs: [] });

describe('WEIGHTS', () => {
  it('sums to 1.0', () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe('clamp01', () => {
  it('clamps to [0,1]', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(2)).toBe(1);
  });
});

describe('classifyRisk', () => {
  it('applies thresholds', () => {
    expect(classifyRisk(0)).toBe('low');
    expect(classifyRisk(0.29)).toBe('low');
    expect(classifyRisk(0.3)).toBe('medium');
    expect(classifyRisk(0.59)).toBe('medium');
    expect(classifyRisk(0.6)).toBe('high');
    expect(classifyRisk(0.79)).toBe('high');
    expect(classifyRisk(0.8)).toBe('critical');
    expect(classifyRisk(1)).toBe('critical');
  });
});

describe('calculateRisk — missing data', () => {
  it('defaults to middle-of-road with aadhaar but an unverified doc', () => {
    const r = calculateRisk({
      ...emptyInput(parcel()),
      documents: [{ id: 'd1', doc_type: 'deed', status: 'uploaded', ocr_confidence: 0.5 } as never],
    });
    expect(r.ownership_score).toBe(0.5);
  });

  it('scores high ownership risk with no data', () => {
    const r = calculateRisk(emptyInput(parcel()));
    // No docs/stages/audits: ownership 0.8 (no docs), docQuality 0.8 (no docs), litigation 0.2 (identified)
    expect(r.ownership_score).toBe(0.8);
    expect(r.document_quality_score).toBe(0.8);
    expect(r.completeness_score).toBe(0.5); // pendingRatio 0 (no stages) → 0 + 0.3 no docs + 0.2 no geometry
    expect(r.overall_risk).toBeGreaterThanOrEqual(0);
    expect(r.overall_risk).toBeLessThanOrEqual(1);
  });

  it('escalates ownership when owner_aadhaar missing', () => {
    const r = calculateRisk(emptyInput(parcel({ owner_aadhaar: null })));
    expect(r.ownership_score).toBe(0.7);
  });

  it('marks disputed parcels as high litigation', () => {
    const r = calculateRisk(emptyInput(parcel({ status: 'disputed' })));
    expect(r.litigation_score).toBe(0.9);
  });
});

describe('calculateRisk — weighted overall', () => {
  it('computes overall as the weighted sum of factor scores', () => {
    const r = calculateRisk(emptyInput(parcel()));
    const manual =
      r.ownership_score * WEIGHTS.ownership +
      r.litigation_score * WEIGHTS.litigation +
      r.compensation_sla_score * WEIGHTS.compensationSla +
      r.completeness_score * WEIGHTS.completeness +
      r.document_quality_score * WEIGHTS.documentQuality +
      r.area_discrepancy_score * WEIGHTS.areaDiscrepancy +
      r.encroachment_score * WEIGHTS.encroachment;
    expect(r.overall_risk).toBeCloseTo(Number(manual.toFixed(2)), 2);
    expect(r.risk_level).toBe(classifyRisk(r.overall_risk));
  });
});

describe('parseAreaHa + area discrepancy factor', () => {
  it('parses units to hectares', () => {
    expect(parseAreaHa('2.5 ha')).toBe(2.5);
    expect(parseAreaHa('1.2 acres')).toBeCloseTo(0.48564, 4);
    expect(parseAreaHa(3)).toBe(3);
    expect(parseAreaHa('n/a')).toBeNull();
    expect(parseAreaHa(null)).toBeNull();
  });

  it('matching doc area keeps discrepancy low, 2x mismatch maxes it', () => {
    const doc = (land_area: unknown) => ({ id: 'd1', doc_type: 'deed', status: 'verified', ocr_confidence: 0.9, ocr_extracted_data: { extracted_fields: { land_area } } }) as never;
    const match = calculateRisk({ ...emptyInput(parcel({ area_hectares: 2 })), documents: [doc('2.05 ha')], stages: [], auditLogs: [] });
    const mismatch = calculateRisk({ ...emptyInput(parcel({ area_hectares: 2 })), documents: [doc('4 ha')], stages: [], auditLogs: [] });
    expect(match.area_discrepancy_score).toBeLessThan(0.1);
    expect(mismatch.area_discrepancy_score).toBeCloseTo(1, 5);
  });
});
