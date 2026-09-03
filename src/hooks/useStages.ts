import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import type { AcquisitionStage } from '../lib/types';
import { canAdvance, STAGES } from '../lib/stages';
import toast from 'react-hot-toast';

export function useStages(parcelId?: string) {
  return useQuery({
    queryKey: ['stages', parcelId],
    enabled: !!parcelId,
    queryFn: async () => {
      if (!isSupabaseConfigured() || !parcelId) {
        // Mock: generate stages for demo when not configured
        return STAGES.map((def, i) => ({
          id: `mock-${def.stage_number}`,
          parcel_id: parcelId ?? 'mock-parcel',
          stage_number: def.stage_number,
          stage_name: def.stage_name,
          status: (i === 0 ? 'completed' : i === 1 ? 'in_progress' : 'pending') as AcquisitionStage['status'],
          assigned_to: null,
          sla_deadline: def.sla_days ? new Date(Date.now() + def.sla_days * 86400000).toISOString() : null,
          completed_at: i === 0 ? new Date().toISOString() : null,
          notes: null,
          created_at: new Date().toISOString(),
        })) as AcquisitionStage[];
      }
      const { data, error } = await supabase.from('acquisition_stages').select('*').eq('parcel_id', parcelId).order('stage_number');
      if (error) throw new Error(error.message);
      return (data ?? []) as AcquisitionStage[];
    },
  });
}

export function useAdvanceStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stageId, parcelId, currentStages, targetNumber }: { stageId: string; parcelId: string; currentStages: AcquisitionStage[]; targetNumber?: number }) => {
      if (!isSupabaseConfigured()) throw new Error('Supabase not configured — fill .env');
      // Validation: can't skip
      if (targetNumber != null) {
        const check = canAdvance(currentStages, targetNumber);
        if (!check.ok) throw new Error(check.reason);
      }
      const { data, error } = await supabase.from('acquisition_stages').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', stageId).select().single();
      if (error) throw new Error(error.message);
      // Auto-move next stage to in_progress if exists
      const nextNum = (targetNumber ?? (currentStages.find((s) => s.id === stageId)?.stage_number ?? 0)) + 1;
      const next = currentStages.find((s) => s.stage_number === nextNum);
      if (next) {
        const { error: nextErr } = await supabase.from('acquisition_stages').update({ status: 'in_progress' }).eq('id', next.id);
        if (nextErr) console.warn('[stages] failed to advance next stage:', nextErr.message);
      } else if (nextNum <= STAGES.length && isSupabaseConfigured()) {
        // If next not created (e.g., after initialization), create it — fallback: update parcel's current stage logic handles display
      }
      // Invalidate for parcel
      void parcelId;
      return data as AcquisitionStage;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['stages', vars.parcelId] });
      qc.invalidateQueries({ queryKey: ['parcels'] });
      toast.success('Stage advanced');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// SLA monitoring: fetch stages breaching deadline
export function useSlaBreaches() {
  return useQuery({
    queryKey: ['sla-breaches'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [] as AcquisitionStage[];
      const { data, error } = await supabase
        .from('acquisition_stages')
        .select('*')
        .in('status', ['pending', 'in_progress'])
        .lt('sla_deadline', new Date().toISOString());
      if (error) throw new Error(error.message);
      return (data ?? []) as AcquisitionStage[];
    },
    refetchInterval: 60_000,
  });
}
