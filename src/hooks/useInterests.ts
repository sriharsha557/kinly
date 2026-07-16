import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../state/useAuthStore';
import type { InterestCategory } from '../types/models';

export function useSetInterests() {
  const setUser = useAuthStore((state) => state.setUser);
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: async (interests: InterestCategory[]) => {
      if (!user) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('profiles')
        .update({ interests })
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => setUser(data),
  });
}
