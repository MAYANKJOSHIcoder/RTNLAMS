/**
 * Risk Scoring Engine — PROMPT 15
 * 7-factor weighted model per PROMPTS_indictrans.md:390
 * weights: ownership 0.25, litigation 0.20, compensationSla 0.15, completeness 0.15, documentQuality 0.10, areaDiscrepancy 0.10, encroachment 0.05
 * Thresholds: low 0-0.3, medium 0.3-0.6, high 0.6-0.8, critical 0.8-1.0
 */
import type { Parcel, Document, AcquisitionStage, AuditLog, RiskAssessment, RiskLevel } from './types';
import { isBreached } from './stages';

export const WEIGHTS = {
  ownership: 0.25,
  litigation: 0.2,
  compensationSla: 0.15,
  completeness: 0.15,
  documentQuality: 0.1,
  areaDiscrepancy: 0.1,
  encroachment: 0.05,
} as const;

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function classifyRisk(score: number): RiskLevel {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  return 'low';
}

// Normalize helper: missing data → 0.5 medium
export interface RiskInput {
  parcel: Parcel;
  documents: Document[];
  stages: AcquisitionStage[];
  auditLogs: AuditLog[];
}

// Parse a land_area value ("2.5 ha", "1.2 acres", 2.5, ...) into hectares
const UNIT_TO_HA: Record<string, number> = { acre: 0.4047, bigha: 0.25, guntha: 0.0405 };
export function parseAreaHa(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : NaN;
  if (!isFinite(n) || n <= 0) return null;
  const unit = typeof value === 'string' ? Object.keys(UNIT_TO_HA).find((u) => value.toLowerCase().includes(u)) : undefined;
  return unit ? n * UNIT_TO_HA[unit] : n; // bare number / "ha" / "hectare" → already hectares
}

export function calculateRisk(input: RiskInput): Omit<RiskAssessment, 'id' | 'assessed_at'> & { factors: Record<string, unknown> } {
  const { parcel, documents, stages, auditLogs } = input;

  // 1. Ownership score: 0 = clean (has owner_cnic + verified doc), 1 = risky (missing cnic / no deed)
  let ownership = 0.5;
  if (!parcel.owner_cnic) ownership = 0.7;
  else {
    const hasVerifiedDeed = documents.some((d) => d.doc_type === 'deed' && d.status === 'verified');
    ownership = hasVerifiedDeed ? 0.1 : documents.length === 0 ? 0.8 : 0.5;
  }
  if (auditLogs.some((a) => a.finding.toLowerCase().includes('ownership'))) ownership = Math.min(1, ownership + 0.2);

  // 2. Litigation: disputed status, hearings type objection, audit high severity
  let litigation = parcel.status === 'disputed' ? 0.9 : parcel.status === 'notified' ? 0.4 : 0.2;
  if (auditLogs.some((a) => a.severity === 'critical')) litigation = Math.min(1, litigation + 0.3);
  if (auditLogs.some((a) => a.audit_type === 'field' && !a.resolved)) litigation += 0.15;

  // 3. Compensation SLA: breached stages in 7-9 or compensation pending >30d
  const breachedCount = stages.filter((s) => isBreached(s) || s.status === 'breached').length;
  let compensationSla = clamp01(breachedCount * 0.3);
  // if stages 7-9 in breached, escalate
  const compStages = stages.filter((s) => s.stage_number >= 7 && s.stage_number <= 9 && isBreached(s));
  if (compStages.length) compensationSla = Math.min(1, compensationSla + 0.2);

  // 4. Completeness: missing fields / stages pending
  const pendingRatio = stages.filter((s) => s.status === 'pending').length / Math.max(1, stages.length);
  let completeness = clamp01(pendingRatio * 0.7 + (documents.length === 0 ? 0.3 : 0));
  if (!parcel.geometry) completeness = Math.min(1, completeness + 0.2);

  // 5. Document quality: low confidence / flagged
  let documentQuality = 0.3;
  if (documents.length === 0) documentQuality = 0.8;
  else {
    const flagged = documents.filter((d) => d.status === 'flagged').length;
    const avgConf = documents.reduce((sum, d) => sum + (d.ocr_confidence ?? 0.5), 0) / documents.length;
    documentQuality = clamp01(flagged * 0.3 + (1 - avgConf) * 0.7);
  }

  // 6. Area discrepancy: compare doc-extracted land_area vs parcel.area_hectares
  let areaDiscrepancy = 0.2; // unknown → neutral
  const docAreas = documents
    .map((d) => {
      const ef = d.ocr_extracted_data?.extracted_fields as Record<string, unknown> | undefined;
      return parseAreaHa(ef?.land_area ?? d.ocr_extracted_data?.land_area);
    })
    .filter((v): v is number => v !== null);
  if (docAreas.length && parcel.area_hectares > 0) {
    const avg = docAreas.reduce((a, b) => a + b, 0) / docAreas.length;
    areaDiscrepancy = clamp01((Math.abs(avg - parcel.area_hectares) / parcel.area_hectares) * 2); // 50% off → 1.0
  }
  // Audit mentions area/discrepancy → escalate (never below the flagged level)
  if (auditLogs.some((a) => a.finding.toLowerCase().includes('area') || a.finding.toLowerCase().includes('discrepancy'))) areaDiscrepancy = Math.max(areaDiscrepancy, 0.7);

  // 7. Encroachment: audit type satellite/field with encroachment finding
  let encroachment = 0.1;
  if (auditLogs.some((a) => a.audit_type === 'satellite' && !a.resolved)) encroachment = 0.6;
  if (auditLogs.some((a) => a.finding.toLowerCase().includes('encroach'))) encroachment = Math.min(1, encroachment + 0.3);

  const scores = {
    ownership_score: clamp01(ownership),
    litigation_score: clamp01(litigation),
    compensation_sla_score: clamp01(compensationSla),
    completeness_score: clamp01(completeness),
    document_quality_score: clamp01(documentQuality),
    area_discrepancy_score: clamp01(areaDiscrepancy),
    encroachment_score: clamp01(encroachment),
  };

  const overall =
    scores.ownership_score * WEIGHTS.ownership +
    scores.litigation_score * WEIGHTS.litigation +
    scores.compensation_sla_score * WEIGHTS.compensationSla +
    scores.completeness_score * WEIGHTS.completeness +
    scores.document_quality_score * WEIGHTS.documentQuality +
    scores.area_discrepancy_score * WEIGHTS.areaDiscrepancy +
    scores.encroachment_score * WEIGHTS.encroachment;

  const overallClamped = clamp01(Number(overall.toFixed(2)));
  return {
    parcel_id: parcel.id,
    ...scores,
    overall_risk: overallClamped,
    risk_level: classifyRisk(overallClamped),
    factors: {
      weights: WEIGHTS,
      breachedCount,
      pendingRatio: Number(pendingRatio.toFixed(2)),
      docCount: documents.length,
      auditCount: auditLogs.length,
      thresholds: { low: '0-0.3', medium: '0.3-0.6', high: '0.6-0.8', critical: '0.8-1.0' },
    },
    assessed_by: null,
  };
}

// Auto-reassess trigger: call this after document uploaded or stage changed
export function shouldReassess(event: 'document_uploaded' | 'stage_changed' | 'audit_logged'): boolean {
  return ['document_uploaded', 'stage_changed', 'audit_logged'].includes(event);
}
