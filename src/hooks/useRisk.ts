import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import type { RiskAssessment, Parcel, Document, AcquisitionStage, AuditLog } from '../lib/types';
import { calculateRisk, type RiskInput } from '../lib/risk';
import toast from 'react-hot-toast';

export function useRiskAssessments(parcelId?: string) {
  return useQuery({
    queryKey: ['risk', parcelId],
    enabled: !!parcelId || parcelId === undefined,
    queryFn: async () => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      let q = supabase.from('risk_assessments').select('*').order('assessed_at', { ascending: false });
      if (parcelId) q = q.eq('parcel_id', parcelId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as RiskAssessment[];
    },
  });
}

// Shared persistence: compute + insert assessment + update parcel risk_score
async function persistRisk(input: RiskInput): Promise<RiskAssessment> {
  const computed = calculateRisk(input);
  if (!isSupabaseConfigured()) throw new Error('Database not connected');
  // Persist to DB
  const { data, error } = await supabase
    .from('risk_assessments')
    .insert({
      parcel_id: input.parcel.id,
      ownership_score: computed.ownership_score,
      litigation_score: computed.litigation_score,
      compensation_sla_score: computed.compensation_sla_score,
      completeness_score: computed.completeness_score,
      document_quality_score: computed.document_quality_score,
      area_discrepancy_score: computed.area_discrepancy_score,
      encroachment_score: computed.encroachment_score,
      overall_risk: computed.overall_risk,
      risk_level: computed.risk_level,
      factors: computed.factors,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  // Also update parcels.risk_score for map coloring — check for errors
  const { error: updateErr } = await supabase.from('parcels').update({ risk_score: computed.overall_risk }).eq('id', input.parcel.id);
  if (updateErr) console.warn('[risk] failed to update parcel risk_score:', updateErr.message);
  return data as RiskAssessment;
}

export function useRecalculateRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: persistRisk,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['risk', data.parcel_id] });
      qc.invalidateQueries({ queryKey: ['risk'] });
      qc.invalidateQueries({ queryKey: ['parcels'] });
      toast.success(`Risk recalculated: ${data.risk_level} (${data.overall_risk})`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Fire-and-forget recalc after upload/verify/stage-advance/audit events
export function useRecalcRiskForParcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (parcelId: string): Promise<RiskAssessment | null> => {
      if (!isSupabaseConfigured() || !parcelId) return null;
      const [parcelRes, docsRes, stagesRes, auditsRes] = await Promise.all([
        supabase.from('parcels').select('*').eq('id', parcelId).single(),
        supabase.from('documents').select('*').eq('parcel_id', parcelId),
        supabase.from('acquisition_stages').select('*').eq('parcel_id', parcelId).order('stage_number'),
        supabase.from('audit_logs').select('*').eq('parcel_id', parcelId),
      ]);
      if (parcelRes.error || !parcelRes.data) throw new Error('Parcel not found for risk recalc');
      if (docsRes.error) console.warn('[risk] docs fetch failed:', docsRes.error.message);
      if (stagesRes.error) console.warn('[risk] stages fetch failed:', stagesRes.error.message);
      if (auditsRes.error) console.warn('[risk] audits fetch failed:', auditsRes.error.message);
      return persistRisk({
        parcel: parcelRes.data as Parcel,
        documents: (docsRes.data ?? []) as Document[],
        stages: (stagesRes.data ?? []) as AcquisitionStage[],
        auditLogs: (auditsRes.data ?? []) as AuditLog[],
      });
    },
    onSuccess: (data) => {
      if (!data) return;
      qc.invalidateQueries({ queryKey: ['risk', data.parcel_id] });
      qc.invalidateQueries({ queryKey: ['risk'] });
      qc.invalidateQueries({ queryKey: ['parcels'] });
      toast.success(`Risk recalculated: ${data.risk_level} (${data.overall_risk})`);
    },
    onError: (e: Error) => console.warn('[risk] auto-recalc failed:', e.message),
  });
}

export function useRiskStats() {
  return useQuery({
    queryKey: ['risk-stats'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return { total: 0, byLevel: { critical: 0, high: 0, medium: 0, low: 0 } };
      const { data, error } = await supabase.from('risk_assessments').select('risk_level');
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Pick<RiskAssessment, 'risk_level'>[];
      const byLevel = { critical: 0, high: 0, medium: 0, low: 0 } as Record<RiskAssessment['risk_level'], number>;
      rows.forEach((r) => {
        if (r.risk_level in byLevel) byLevel[r.risk_level]++;
      });
      return { total: rows.length, byLevel };
    },
  });
}

// Alias for single parcel lookup
export function useParcelRisk(parcel: Parcel | null, documents: RiskInput['documents'], stages: RiskInput['stages'], auditLogs: RiskInput['auditLogs']) {
  const recalc = useRecalculateRisk();
  const trigger = () => {
    if (!parcel) return;
    recalc.mutate({ parcel, documents, stages, auditLogs });
  };
  return { trigger, isPending: recalc.isPending };
}
