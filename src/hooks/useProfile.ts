import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import type { UserProfile } from '../lib/types';
import toast from 'react-hot-toast';

// Self-service profile update — role/aadhaar changes blocked by DB trigger
export function useUpdateProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { full_name?: string; phone?: string | null }) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      if (!user) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('user_profiles')
        .update(patch)
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as UserProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
