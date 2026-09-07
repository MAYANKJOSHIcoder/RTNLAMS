import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import type { AuditLog } from '../lib/types';
import toast from 'react-hot-toast';
import { useRecalcRiskForParcel } from './useRisk';

export function useAuditLogs(parcelId?: string) {
  return useQuery({
    queryKey: ['audit', parcelId],
    enabled: !!parcelId || parcelId === undefined,
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [] as AuditLog[];
      let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
      if (parcelId) q = q.eq('parcel_id', parcelId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as AuditLog[];
    },
  });
}

export function useUnresolvedHighSeverity() {
  return useQuery({
    queryKey: ['audit', 'unresolved-high'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [] as AuditLog[];
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('resolved', false)
        .in('severity', ['high', 'critical']);
      if (error) throw new Error(error.message);
      return (data ?? []) as AuditLog[];
    },
  });
}

export function useAuditStats() {
  return useQuery({
    queryKey: ['audit-stats'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return { total: 0, bySeverity: { low: 0, medium: 0, high: 0, critical: 0 }, unresolved: 0 };
      const { data, error } = await supabase.from('audit_logs').select('severity, resolved');
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Pick<AuditLog, 'severity' | 'resolved'>[];
      const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 } as Record<AuditLog['severity'], number>;
      let unresolved = 0;
      rows.forEach((r) => {
        if (r.severity in bySeverity) bySeverity[r.severity]++;
        if (!r.resolved) unresolved++;
      });
      return { total: rows.length, bySeverity, unresolved };
    },
  });
}

export function useCreateAudit() {
  const qc = useQueryClient();
  const recalcRisk = useRecalcRiskForParcel();
  return useMutation({
    mutationFn: async (payload: Partial<AuditLog> & { audit_type: AuditLog['audit_type']; finding: string; severity: AuditLog['severity'] }) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      const sanitized = {
        parcel_id: payload.parcel_id ? String(payload.parcel_id).trim() : null,
        audit_type: String(payload.audit_type).trim() as AuditLog['audit_type'],
        finding: String(payload.finding ?? '').trim(),
        severity: String(payload.severity).trim() as AuditLog['severity'],
        image_url: payload.image_url ?? null,
        resolved: Boolean(payload.resolved),
      };
      if (!sanitized.finding) throw new Error('Finding required');
      const { data, error } = await supabase.from('audit_logs').insert(sanitized).select().single();
      if (error) throw new Error(error.message);
      return data as AuditLog;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['audit', data.parcel_id] });
      qc.invalidateQueries({ queryKey: ['audit'] });
      qc.invalidateQueries({ queryKey: ['audit-stats'] });
      toast.success('Audit logged');
      if (data.parcel_id) recalcRisk.mutate(data.parcel_id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateAudit() {
  const qc = useQueryClient();
  const recalcRisk = useRecalcRiskForParcel();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<AuditLog> & { id: string }) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      const { data, error } = await supabase.from('audit_logs').update(patch).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return data as AuditLog;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['audit', data.parcel_id] });
      toast.success('Audit updated');
      if (data.parcel_id) recalcRisk.mutate(data.parcel_id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, parcelId }: { id: string; parcelId?: string | null }) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      const { error } = await supabase.from('audit_logs').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return parcelId;
    },
    onSuccess: (parcelId) => {
      qc.invalidateQueries({ queryKey: ['audit', parcelId] });
      toast.success('Audit deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
