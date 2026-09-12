/**
 * 12-Stage Lifecycle Engine — PROMPT 14
 * Stages per PROMPTS_indictrans.md:349, SLA days, validation (can't skip), breach detection
 */
import type { StageDefinition, AcquisitionStage, StageStatus } from './types';

export const STAGES: StageDefinition[] = [
  { stage_number: 1, stage_name: 'Corridor Planning', sla_days: null, description: 'Map project corridors and match alignments' },
  { stage_number: 2, stage_name: 'Preliminary Survey', sla_days: 15, description: 'Field survey & plot identification' },
  { stage_number: 3, stage_name: 'Social Impact Assessment', sla_days: 30, description: 'SIA report & affected families count' },
  { stage_number: 4, stage_name: 'Notification U/S 19', sla_days: 30, description: 'Statutory notification under RFCTLARR Section 19' },
  { stage_number: 5, stage_name: 'Objection Handling', sla_days: 30, description: 'Receive & dispose objections' },
  { stage_number: 6, stage_name: 'Public Hearing', sla_days: 15, description: 'Gram sabha / public hearing minutes' },
  { stage_number: 7, stage_name: 'Valuation Report', sla_days: 30, description: 'Land & asset valuation by collector' },
  { stage_number: 8, stage_name: 'Award Declaration', sla_days: 30, description: 'Award under Section 23' },
  { stage_number: 9, stage_name: 'Compensation Deposit', sla_days: 30, description: 'Deposit in escrow / pay to owners' },
  { stage_number: 10, stage_name: 'Possession Handover', sla_days: 15, description: 'Physical possession to acquiring body' },
  { stage_number: 11, stage_name: 'Title Transfer', sla_days: 30, description: 'Mutation & title transfer in records' },
  { stage_number: 12, stage_name: 'Satellite Monitoring', sla_days: null, description: 'Post-acquisition encroachment monitoring' },
];

export function getStageDef(n: number): StageDefinition | undefined {
  return STAGES.find((s) => s.stage_number === n);
}

export function calculateDeadline(startDate: string | Date, slaDays: number | null): string | null {
  if (slaDays == null) return null;
  const d = new Date(startDate);
  d.setDate(d.getDate() + slaDays);
  return d.toISOString();
}

export function isBreached(stage: AcquisitionStage): boolean {
  if (stage.status === 'completed' || stage.status === 'breached') return stage.status === 'breached';
  if (!stage.sla_deadline) return false;
  return new Date() > new Date(stage.sla_deadline);
}

export function getNextStage(currentNumber: number): StageDefinition | undefined {
  return getStageDef(currentNumber + 1);
}

// Validate a board drop: target column vs the parcel's current stage.
// Semantics: drop on own column = no-op; drop on NEXT column = advance;
// anything further lists exactly which stages remain; revert is blocked;
// a breached current stage must be resolved first (resolve-then-advance).
export function canAdvance(stages: AcquisitionStage[], targetNumber: number): { ok: boolean; noop?: boolean; reason?: string } {
  const sorted = [...stages].sort((a, b) => a.stage_number - b.stage_number);
  const inProgress = sorted.find((s) => s.status === 'in_progress');
  const lastCompleted = sorted.filter((s) => s.status === 'completed').reduce((max, s) => Math.max(max, s.stage_number), 0);

  // Breached current stage: must resolve first
  const breached = sorted.find((s) => s.status === 'breached');
  if (breached) {
    return { ok: false, reason: `Stage ${breached.stage_number} (${breached.stage_name}) breached SLA — resolve the breach first` };
  }

  // No in_progress row (legacy data): derive the expected current
  const cur = inProgress?.stage_number ?? Math.min(12, lastCompleted + 1);

  if (targetNumber === cur) return { ok: true, noop: true };
  if (targetNumber === cur + 1) return { ok: true };
  if (targetNumber > cur + 1) {
    const remaining = STAGES.filter((d) => d.stage_number > cur && d.stage_number < targetNumber).map((d) => `${d.stage_number} ${d.stage_name}`);
    return { ok: false, reason: `Cannot skip — ${targetNumber - cur} stage${targetNumber - cur === 1 ? '' : 's'} remain first: ${remaining.join(', ')}` };
  }
  return { ok: false, reason: 'Cannot revert to an earlier stage' };
}

// Which drop targets are legal for a parcel (for board column highlighting)
export function dropTargets(stages: AcquisitionStage[]): { current: number; next: number | null } {
  const sorted = [...stages].sort((a, b) => a.stage_number - b.stage_number);
  const inProgress = sorted.find((s) => s.status === 'in_progress');
  const lastCompleted = sorted.filter((s) => s.status === 'completed').reduce((max, s) => Math.max(max, s.stage_number), 0);
  const cur = inProgress?.stage_number ?? Math.min(12, lastCompleted + 1);
  return { current: cur, next: cur < 12 ? cur + 1 : null };
}

// Initialize stages for new parcel (creates 12 rows with first in_progress, rest pending)
export function initializeStagesForParcel(parcelId: string, startDate = new Date().toISOString()): Omit<AcquisitionStage, 'id' | 'created_at' | 'updated_at'>[] {
  return STAGES.map((def) => ({
    parcel_id: parcelId,
    stage_number: def.stage_number,
    stage_name: def.stage_name,
    status: (def.stage_number === 1 ? 'in_progress' : 'pending') as StageStatus,
    assigned_to: null,
    sla_deadline: def.sla_days != null ? calculateDeadline(startDate, def.sla_days) : null,
    completed_at: null,
    notes: null,
  }));
}

// Advance helper returns patch for DB update
export function advanceStagePatch(stage: AcquisitionStage): Partial<AcquisitionStage> {
  if (stage.status === 'completed') throw new Error('Stage already completed');
  return { status: 'completed' as StageStatus, completed_at: new Date().toISOString() };
}

// SLA auto-mark breached (call periodically)
export function markBreachedIfNeeded(stage: AcquisitionStage): StageStatus {
  if (stage.status !== 'in_progress' && stage.status !== 'pending') return stage.status;
  if (stage.sla_deadline && new Date() > new Date(stage.sla_deadline)) return 'breached';
  return stage.status;
}
