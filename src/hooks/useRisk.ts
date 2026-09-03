import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import type { RiskAssessment, Parcel } from '../lib/types';
import { calculateRisk, type RiskInput } from '../lib/risk';
import toast from 'react-hot-toast';

export function useRiskAssessments(parcelId?: string) {
  return useQuery({
    queryKey: ['risk', parcelId],
    enabled: !!parcelId || parcelId === undefined,
    queryFn: async () => {
      if (!isSupabaseConfigured()) {
        // Mock assessments for demo
        if (parcelId) return [] as RiskAssessment[];
        return [] as RiskAssessment[];
      }
      let q = supabase.from('risk_assessments').select('*').order('assessed_at', { ascending: false });
      if (parcelId) q = q.eq('parcel_id', parcelId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as RiskAssessment[];
    },
  });
}

export function useRecalculateRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RiskInput): Promise<RiskAssessment> => {
      const computed = calculateRisk(input);
      if (!isSupabaseConfigured()) {
        // Return computed as mock assessment
        return {
          id: `mock-${input.parcel.id}`,
          ...computed,
          factors: computed.factors as Record<string, unknown>,
          assessed_at: new Date().toISOString(),
        } as RiskAssessment;
      }
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
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['risk', data.parcel_id] });
      qc.invalidateQueries({ queryKey: ['risk'] });
      qc.invalidateQueries({ queryKey: ['parcels'] });
      toast.success(`Risk recalculated: ${data.risk_level} (${data.overall_risk})`);
    },
    onError: (e: Error) => toast.error(e.message),
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
