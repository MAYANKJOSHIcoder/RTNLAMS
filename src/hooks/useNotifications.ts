import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import type { NotificationItem } from '../lib/types';
import toast from 'react-hot-toast';

export function useNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notifications', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!isSupabaseConfigured() || !user?.id) return [] as NotificationItem[];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.warn('[useNotifications] error:', error);
        return [];
      }
      return (data ?? []) as NotificationItem[];
    },
    refetchInterval: 30000,
  });
}

export function useUnreadNotificationsCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['unread-notifications-count', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!isSupabaseConfigured() || !user?.id) return 0;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.warn('[useUnreadNotificationsCount] error:', error);
        return 0;
      }
      return count ?? 0;
    },
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!isSupabaseConfigured()) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', user?.id] });
      qc.invalidateQueries({ queryKey: ['unread-notifications-count', user?.id] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured() || !user?.id) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', user?.id] });
      qc.invalidateQueries({ queryKey: ['unread-notifications-count', user?.id] });
      toast.success('All notifications marked as read');
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Failed to update notifications');
    },
  });
}
