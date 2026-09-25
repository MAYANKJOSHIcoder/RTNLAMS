import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import type { RaisedQuery, QueryMessage, QueryStatus, QueryCategory } from '../lib/types';
import toast from 'react-hot-toast';

export function useQueries(parcelId?: string, status?: string) {
  return useQuery({
    queryKey: ['queries', parcelId, status],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [] as RaisedQuery[];

      let q = supabase
        .from('queries')
        .select(`
          *,
          citizen:user_profiles!queries_citizen_id_fkey(full_name, aadhaar, phone),
          parcel:parcels(parcel_number, village),
          assigned_officer:user_profiles!queries_assigned_to_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (parcelId) q = q.eq('parcel_id', parcelId);
      if (status && status !== 'all') q = q.eq('status', status);

      const { data, error } = await q;
      if (error) {
        console.warn('[useQueries] error:', error);
        return [];
      }
      return (data ?? []) as unknown as RaisedQuery[];
    },
  });
}

export function useQueryDetail(queryId?: string) {
  return useQuery({
    queryKey: ['query', queryId],
    enabled: !!queryId,
    queryFn: async () => {
      if (!isSupabaseConfigured() || !queryId) return null;
      const { data, error } = await supabase
        .from('queries')
        .select(`
          *,
          citizen:user_profiles!queries_citizen_id_fkey(full_name, aadhaar, phone),
          parcel:parcels(parcel_number, village),
          assigned_officer:user_profiles!queries_assigned_to_fkey(full_name)
        `)
        .eq('id', queryId)
        .single();

      if (error) {
        console.warn('[useQueryDetail] error:', error);
        return null;
      }
      return data as unknown as RaisedQuery;
    },
  });
}

export function useQueryMessages(queryId?: string) {
  return useQuery({
    queryKey: ['query-messages', queryId],
    enabled: !!queryId,
    queryFn: async () => {
      if (!isSupabaseConfigured() || !queryId) return [] as QueryMessage[];
      const { data, error } = await supabase
        .from('query_messages')
        .select(`
          *,
          sender:user_profiles!query_messages_sender_id_fkey(full_name, role)
        `)
        .eq('query_id', queryId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[useQueryMessages] error:', error);
        return [];
      }
      return (data ?? []) as unknown as QueryMessage[];
    },
  });
}

export function useCreateQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      parcelId,
      citizenId,
      category,
      subject,
      description,
      attachmentFile,
    }: {
      parcelId: string;
      citizenId: string;
      category: QueryCategory;
      subject: string;
      description: string;
      attachmentFile?: File | null;
    }) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');

      let attachmentPath: string | null = null;
      if (attachmentFile) {
        const sanitized = attachmentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `query-attachments/${parcelId}/${Date.now()}-${sanitized}`;
        const { error: upErr } = await supabase.storage.from('documents').upload(path, attachmentFile, {
          cacheControl: '3600',
          upsert: false,
        });
        if (!upErr) attachmentPath = path;
      }

      const { data: newQuery, error: qErr } = await supabase
        .from('queries')
        .insert({
          parcel_id: parcelId,
          citizen_id: citizenId,
          category,
          subject,
          description,
          status: 'open',
        })
        .select()
        .single();

      if (qErr) throw new Error(qErr.message);

      const { error: mErr } = await supabase.from('query_messages').insert({
        query_id: newQuery.id,
        sender_id: citizenId,
        message: description,
        attachment_path: attachmentPath,
      });

      if (mErr) console.warn('[useCreateQuery] initial message error:', mErr);

      return newQuery as RaisedQuery;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queries'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-notifications-count'] });
      toast.success('Query submitted successfully');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to submit query'),
  });
}

export function useSendQueryMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      queryId,
      senderId,
      message,
      attachmentFile,
      parcelId,
    }: {
      queryId: string;
      senderId: string;
      message: string;
      attachmentFile?: File | null;
      parcelId?: string;
    }) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');

      let attachmentPath: string | null = null;
      if (attachmentFile && parcelId) {
        const sanitized = attachmentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `query-attachments/${parcelId}/${Date.now()}-${sanitized}`;
        const { error: upErr } = await supabase.storage.from('documents').upload(path, attachmentFile, {
          cacheControl: '3600',
          upsert: false,
        });
        if (!upErr) attachmentPath = path;
      }

      const { data, error } = await supabase
        .from('query_messages')
        .insert({
          query_id: queryId,
          sender_id: senderId,
          message,
          attachment_path: attachmentPath,
        })
        .select(`
          *,
          sender:user_profiles!query_messages_sender_id_fkey(full_name, role)
        `)
        .single();

      if (error) throw new Error(error.message);
      return data as unknown as QueryMessage;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['query-messages', vars.queryId] });
      qc.invalidateQueries({ queryKey: ['queries'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-notifications-count'] });
      toast.success('Reply sent');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to send reply'),
  });
}

export function useUpdateQueryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      queryId,
      status,
      assignedTo,
    }: {
      queryId: string;
      status: QueryStatus;
      assignedTo?: string | null;
    }) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');

      const updates: Record<string, unknown> = { status };
      if (assignedTo !== undefined) updates.assigned_to = assignedTo;
      if (status === 'resolved') updates.resolved_at = new Date().toISOString();
      if (status === 'reopened') updates.resolved_at = null;

      const { data, error } = await supabase
        .from('queries')
        .update(updates)
        .eq('id', queryId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as RaisedQuery;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['query', vars.queryId] });
      qc.invalidateQueries({ queryKey: ['queries'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-notifications-count'] });
      toast.success(`Query marked as ${vars.status.replace('_', ' ')}`);
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update query status'),
  });
}

