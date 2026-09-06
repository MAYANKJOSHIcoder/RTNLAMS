import { describe, it, expect } from 'vitest';
import { STAGES, canAdvance, initializeStagesForParcel, isBreached, advanceStagePatch } from './stages';
import type { AcquisitionStage } from './types';

function stage(partial: Partial<AcquisitionStage> & { stage_number: number }): AcquisitionStage {
  return {
    id: `s-${partial.stage_number}`,
    parcel_id: 'p1',
    stage_name: STAGES.find((s) => s.stage_number === partial.stage_number)?.stage_name ?? `Stage ${partial.stage_number}`,
    status: 'pending',
    assigned_to: null,
    sla_deadline: null,
    completed_at: null,
    notes: null,
    ...partial,
  } as AcquisitionStage;
}

describe('STAGES', () => {
  it('defines exactly 12 stages', () => {
    expect(STAGES).toHaveLength(12);
    expect(STAGES.map((s) => s.stage_number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe('canAdvance', () => {
  it('allows starting at stage 1 with no stages', () => {
    expect(canAdvance([], 1)).toEqual({ ok: true });
  });

  it('rejects skipping from empty stages', () => {
    const r = canAdvance([], 2);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/stage 1/i);
  });

  it('allows advancing to the next stage after completion', () => {
    const stages = [stage({ stage_number: 1, status: 'completed' })];
    expect(canAdvance(stages, 2).ok).toBe(true);
  });

  it('rejects skipping ahead', () => {
    const stages = [stage({ stage_number: 1, status: 'completed' })];
    const r = canAdvance(stages, 3);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/skip/i);
  });

  it('rejects reverting to an earlier stage', () => {
    const stages = [
      stage({ stage_number: 1, status: 'completed' }),
      stage({ stage_number: 2, status: 'completed' }),
    ];
    const r = canAdvance(stages, 1);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/revert/i);
  });

  it('allows completing the current in_progress stage', () => {
    const stages = [
      stage({ stage_number: 1, status: 'completed' }),
      stage({ stage_number: 2, status: 'in_progress' }),
    ];
    expect(canAdvance(stages, 2).ok).toBe(true);
  });
});

describe('initializeStagesForParcel', () => {
  it('creates 12 rows with stage 1 in_progress and the rest pending', () => {
    const rows = initializeStagesForParcel('parcel-1');
    expect(rows).toHaveLength(12);
    expect(rows[0].status).toBe('in_progress');
    expect(rows[0].parcel_id).toBe('parcel-1');
    rows.slice(1).forEach((r) => expect(r.status).toBe('pending'));
  });

  it('sets SLA deadlines only for stages that have sla_days', () => {
    const rows = initializeStagesForParcel('parcel-1', '2026-01-01T00:00:00Z');
    expect(rows[0].sla_deadline).toBeNull(); // Corridor Planning
    expect(rows[1].sla_deadline).toBe('2026-01-16T00:00:00.000Z'); // +15 days
    expect(rows[11].sla_deadline).toBeNull(); // Satellite Monitoring
  });
});

describe('isBreached', () => {
  it('is false for completed stages', () => {
    expect(isBreached(stage({ stage_number: 1, status: 'completed', sla_deadline: '2000-01-01T00:00:00Z' }))).toBe(false);
  });

  it('is true for an in_progress stage past its deadline', () => {
    expect(isBreached(stage({ stage_number: 1, status: 'in_progress', sla_deadline: '2000-01-01T00:00:00Z' }))).toBe(true);
  });

  it('is false for an in_progress stage within its deadline', () => {
    expect(isBreached(stage({ stage_number: 1, status: 'in_progress', sla_deadline: '2999-01-01T00:00:00Z' }))).toBe(false);
  });

  it('is false when no deadline exists', () => {
    expect(isBreached(stage({ stage_number: 1, status: 'in_progress' }))).toBe(false);
  });
});

describe('advanceStagePatch', () => {
  it('returns completed patch with timestamp', () => {
    const patch = advanceStagePatch(stage({ stage_number: 2, status: 'in_progress' }));
    expect(patch.status).toBe('completed');
    expect(patch.completed_at).toBeTruthy();
  });

  it('throws when stage already completed', () => {
    expect(() => advanceStagePatch(stage({ stage_number: 2, status: 'completed' }))).toThrow(/already completed/i);
  });
});
