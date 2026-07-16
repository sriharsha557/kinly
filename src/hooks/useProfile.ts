import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../state/useAuthStore';
import type { InterestCategory, User } from '../types/models';

interface ProfileUpdate {
  name?: string;
  bio?: string | null;
  avatar?: string | null;
  interests?: InterestCategory[];
}

export function useUpdateProfile() {
  const setUser = useAuthStore((state) => state.setUser);
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: async (update: ProfileUpdate): Promise<User> => {
      if (!user) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('profiles')
        .update(update)
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data as User;
    },
    onSuccess: (data) => setUser(data),
  });
}
