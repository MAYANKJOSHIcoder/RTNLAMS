import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import type { Hearing } from '../lib/types';
import toast from 'react-hot-toast';

export function useHearings(parcelId?: string) {
  return useQuery({
    queryKey: ['hearings', parcelId],
    enabled: !!parcelId || parcelId === undefined,
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [] as Hearing[];
      let q = supabase.from('hearings').select('*').order('hearing_date', { ascending: true });
      if (parcelId) q = q.eq('parcel_id', parcelId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as Hearing[];
    },
  });
}

export function useUpcomingHearings(limit = 5) {
  return useQuery({
    queryKey: ['hearings', 'upcoming', limit],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [] as Hearing[];
      const { data, error } = await supabase
        .from('hearings')
        .select('*')
        .gte('hearing_date', new Date().toISOString())
        .order('hearing_date', { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as Hearing[];
    },
  });
}

export function useHearingsCalendar(month?: string) {
  // month = "2026-09" → filter by year-month
  return useQuery({
    queryKey: ['hearings', 'calendar', month],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [] as Hearing[];
      let q = supabase.from('hearings').select('*').order('hearing_date');
      if (month) {
        const start = new Date(`${month}-01T00:00:00`).toISOString();
        const end = new Date(new Date(`${month}-01T00:00:00`).getFullYear(), new Date(`${month}-01T00:00:00`).getMonth() + 1, 1).toISOString();
        q = q.gte('hearing_date', start).lt('hearing_date', end);
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as Hearing[];
    },
  });
}

export function useCreateHearing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Hearing> & { parcel_id: string; hearing_date: string; type: Hearing['type'] }) => {
      if (!isSupabaseConfigured()) throw new Error('Supabase not configured — fill .env');
      const sanitized = {
        parcel_id: String(payload.parcel_id).trim(),
        hearing_date: new Date(payload.hearing_date).toISOString(),
        type: String(payload.type).trim() as Hearing['type'],
        outcome: payload.outcome ? String(payload.outcome).trim() : null,
        attendees: payload.attendees ?? null,
        notes: payload.notes ? String(payload.notes).trim() : null,
        minutes_file_url: payload.minutes_file_url ?? null,
      };
      if (!sanitized.parcel_id || !sanitized.hearing_date || !sanitized.type) throw new Error('parcel_id, hearing_date, type required');
      const { data, error } = await supabase.from('hearings').insert(sanitized).select().single();
      if (error) throw new Error(error.message);
      return data as Hearing;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['hearings', data.parcel_id] });
      qc.invalidateQueries({ queryKey: ['hearings'] });
      toast.success('Hearing scheduled');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateHearing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Hearing> & { id: string }) => {
      if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
      const { data, error } = await supabase.from('hearings').update(patch).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return data as Hearing;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['hearings', data.parcel_id] });
      toast.success('Hearing updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteHearing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, parcelId }: { id: string; parcelId?: string }) => {
      if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
      const { error } = await supabase.from('hearings').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return parcelId;
    },
    onSuccess: (parcelId) => {
      qc.invalidateQueries({ queryKey: ['hearings', parcelId] });
      toast.success('Hearing deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
