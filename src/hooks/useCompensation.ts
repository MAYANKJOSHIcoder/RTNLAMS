import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import type { CompensationAward, PaymentStatus } from '../lib/types';
import toast from 'react-hot-toast';

export function useCompensation(parcelId?: string, enabled = true) {
  return useQuery({
    queryKey: ['compensation', parcelId],
    enabled: enabled && (!!parcelId || parcelId === undefined),
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [] as CompensationAward[];
      let q = supabase.from('compensation_awards').select('*').order('created_at', { ascending: false });
      if (parcelId) q = q.eq('parcel_id', parcelId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as CompensationAward[];
    },
  });
}

export function useCreateCompensation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CompensationAward> & { parcel_id: string }) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      const sanitized = {
        parcel_id: String(payload.parcel_id).trim(),
        calculated_amount: payload.calculated_amount != null ? Number(payload.calculated_amount) : null,
        awarded_amount: Number(payload.awarded_amount ?? 0),
        payment_status: (payload.payment_status as PaymentStatus) ?? 'pending',
        circle_rate_per_sqm: payload.circle_rate_per_sqm != null ? Number(payload.circle_rate_per_sqm) : null,
        area_sqm: payload.area_sqm != null ? Number(payload.area_sqm) : null,
        multiplier: payload.multiplier ?? null,
      };
      if (!sanitized.parcel_id || !sanitized.awarded_amount) throw new Error('parcel_id and awarded_amount required');
      const { data, error } = await supabase.from('compensation_awards').insert(sanitized).select().single();
      if (error) throw new Error(error.message);
      return data as CompensationAward;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['compensation', data.parcel_id] });
      qc.invalidateQueries({ queryKey: ['compensation'] });
      toast.success('Compensation award created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCompensation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CompensationAward> & { id: string }) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      const { data, error } = await supabase.from('compensation_awards').update(patch).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return data as CompensationAward;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['compensation', data.parcel_id] });
      toast.success('Compensation updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePaymentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, reference }: { id: string; status: PaymentStatus; reference?: string }) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      const patch: Partial<CompensationAward> = { payment_status: status };
      if (status === 'completed') {
        patch.payment_date = new Date().toISOString();
        if (reference) patch.payment_reference = String(reference).trim();
      }
      if (status === 'initiated') patch.payment_date = new Date().toISOString();
      const { data, error } = await supabase.from('compensation_awards').update(patch).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return data as CompensationAward;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['compensation', data.parcel_id] });
      toast.success(`Payment ${data.payment_status}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCompensationStats(projectId?: string) {
  return useQuery({
    queryKey: ['compensation-stats', projectId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return { totalAwarded: 0, totalPaid: 0, pending: 0, breached: 0 };
      // Simplified: aggregate client-side
      const { data, error } = await supabase.from('compensation_awards').select('awarded_amount, payment_status, created_at');
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Pick<CompensationAward, 'awarded_amount' | 'payment_status' | 'created_at'>[];
      const totalAwarded = rows.reduce((s, r) => s + Number(r.awarded_amount ?? 0), 0);
      const totalPaid = rows.filter((r) => r.payment_status === 'completed').reduce((s, r) => s + Number(r.awarded_amount ?? 0), 0);
      // project filter would need join via parcels; for MVP return global
      void projectId;
      return { totalAwarded, totalPaid, pending: rows.filter((r) => r.payment_status !== 'completed').length, breached: 0 };
    },
  });
}
