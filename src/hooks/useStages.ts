import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import type { AcquisitionStage } from '../lib/types';
import toast from 'react-hot-toast';
import { useRecalcRiskForParcel } from './useRisk';

export function useStages(parcelId?: string) {
  return useQuery({
    queryKey: ['stages', parcelId],
    enabled: !!parcelId,
    queryFn: async () => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      if (!parcelId) return [];
      const { data, error } = await supabase.from('acquisition_stages').select('*').eq('parcel_id', parcelId).order('stage_number');
      if (error) throw new Error(error.message);
      return (data ?? []) as AcquisitionStage[];
    },
  });
}

// All stages (board view) — grouped client-side
export function useAllStages(enabled = true) {
  return useQuery({
    queryKey: ['stages', 'board'],
    enabled,
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [] as AcquisitionStage[];
      const { data, error } = await supabase.from('acquisition_stages').select('*');
      if (error) throw new Error(error.message);
      return (data ?? []) as AcquisitionStage[];
    },
  });
}

// Advance: single atomic RPC — completes the in_progress stage, starts the next
export function useAdvanceStage() {
  const qc = useQueryClient();
  const recalcRisk = useRecalcRiskForParcel();
  return useMutation({
    mutationFn: async ({ stageId }: { stageId: string; parcelId: string }) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      const { data, error } = await supabase.rpc('advance_parcel_stage', { p_stage_id: stageId });
      if (error) throw new Error(error.message);
      return data as AcquisitionStage;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['stages'] });
      qc.invalidateQueries({ queryKey: ['parcels'] });
      qc.invalidateQueries({ queryKey: ['stage-counts'] });
      toast.success('Stage advanced');
      recalcRisk.mutate(vars.parcelId);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Resolve a breached stage: back to in_progress with a new deadline + note
export function useResolveBreach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stageId, newDeadline }: { stageId: string; newDeadline: string }) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      const { data, error } = await supabase.rpc('resolve_breached_stage', {
        p_stage_id: stageId,
        p_new_deadline: newDeadline,
      });
      if (error) throw new Error(error.message);
      return data as AcquisitionStage;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stages'] });
      qc.invalidateQueries({ queryKey: ['sla-breaches'] });
      qc.invalidateQueries({ queryKey: ['parcels'] });
      toast.success('Breach resolved — stage back in progress');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// SLA monitoring: mark overdue in_progress → breached via RPC (idempotent),
// then fetch all unresolved breaches. RPC path works for FO sessions
// (they have no direct write on acquisition_stages).
export function useSlaBreaches(enabled = true) {
  return useQuery({
    queryKey: ['sla-breaches'],
    enabled,
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [] as AcquisitionStage[];
      const { error: markErr } = await supabase.rpc('mark_overdue_breached');
      if (markErr) console.warn('[sla] mark_overdue_breached failed:', markErr.message);
      const { data, error } = await supabase.from('acquisition_stages').select('*').eq('status', 'breached');
      if (error) throw new Error(error.message);
      return (data ?? []) as AcquisitionStage[];
    },
    refetchInterval: 60_000,
  });
}
