import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Circle } from '../types/models';

export function useMyCircles(userId: string | undefined) {
  return useQuery({
    queryKey: ['circles', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Circle[]> => {
      const { data, error } = await supabase
        .from('circle_members')
        .select('circles(*)')
        .eq('user_id', userId as string);
      if (error) throw error;
      return (data ?? []).flatMap((row) => (row.circles ? [row.circles as unknown as Circle] : []));
    },
  });
}

export function useCreateCircle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<Circle> => {
      const { data, error } = await supabase.rpc('create_circle', { circle_name: name });
      if (error) throw error;
      return data as Circle;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['circles'] }),
  });
}

export function useJoinCircle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inviteCode: string): Promise<Circle> => {
      const { data, error } = await supabase.rpc('join_circle_by_invite_code', { code: inviteCode });
      if (error) throw error;
      return data as Circle;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['circles'] }),
  });
}
