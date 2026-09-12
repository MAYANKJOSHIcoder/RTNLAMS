import { describe, it, expect } from 'vitest';
import { STAGES, canAdvance, dropTargets, isBreached, advanceStagePatch } from './stages';
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

describe('canAdvance — board drop semantics', () => {
  const p2Active = [
    stage({ stage_number: 1, status: 'completed' }),
    stage({ stage_number: 2, status: 'in_progress' }),
    stage({ stage_number: 3, status: 'pending' }),
  ];

  it('drop on own column is a no-op success', () => {
    const r = canAdvance(p2Active, 2);
    expect(r.ok).toBe(true);
    expect(r.noop).toBe(true);
  });

  it('drop on next column advances', () => {
    const r = canAdvance(p2Active, 3);
    expect(r.ok).toBe(true);
    expect(r.noop).toBeUndefined();
  });

  it('drop further ahead lists the remaining stages', () => {
    const r = canAdvance(p2Active, 6);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/3 Social Impact Assessment/);
    expect(r.reason).toMatch(/4 Notification/);
    expect(r.reason).toMatch(/5 Objection Handling/);
  });

  it('reverting is rejected', () => {
    const r = canAdvance(p2Active, 1);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/revert/i);
  });

  it('a breached stage blocks advancing until resolved', () => {
    const breached = [
      stage({ stage_number: 1, status: 'completed' }),
      stage({ stage_number: 2, status: 'breached', sla_deadline: '2000-01-01T00:00:00Z' }),
      stage({ stage_number: 3, status: 'pending' }),
    ];
    const r = canAdvance(breached, 3);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/breached SLA — resolve/i);
  });

  it('with no in_progress row, derives current from last completed', () => {
    const legacy = [
      stage({ stage_number: 1, status: 'completed' }),
      stage({ stage_number: 2, status: 'pending' }),
    ];
    // derived current = lastCompleted(1) + 1 = 2 (the pending row)
    expect(canAdvance(legacy, 2).ok).toBe(true);
    expect(canAdvance(legacy, 2).noop).toBe(true); // own column = nothing to do
    expect(canAdvance(legacy, 3).ok).toBe(true); // next of derived current
    expect(canAdvance(legacy, 4).ok).toBe(false); // 2 ahead of derived current
    expect(canAdvance(legacy, 1).ok).toBe(false); // revert of derived current
  });

  it('stage 12 completing: next is null, drop on 12 is a no-op', () => {
    const endgame = [
      stage({ stage_number: 11, status: 'completed' }),
      stage({ stage_number: 12, status: 'in_progress' }),
    ];
    expect(canAdvance(endgame, 12).noop).toBe(true);
  });
});

describe('dropTargets', () => {
  it('returns current and next column', () => {
    const t = dropTargets([
      stage({ stage_number: 1, status: 'completed' }),
      stage({ stage_number: 2, status: 'in_progress' }),
    ]);
    expect(t.current).toBe(2);
    expect(t.next).toBe(3);
  });

  it('returns null next at stage 12', () => {
    const t = dropTargets([
      stage({ stage_number: 11, status: 'completed' }),
      stage({ stage_number: 12, status: 'in_progress' }),
    ]);
    expect(t.current).toBe(12);
    expect(t.next).toBeNull();
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
