import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Circle, CircleRole } from '../types/models';

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

export function useCircleDetail(circleId: string | undefined) {
  return useQuery({
    queryKey: ['circle', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<Circle> => {
      const { data, error } = await supabase.from('circles').select('*').eq('id', circleId as string).single();
      if (error) throw error;
      return data as Circle;
    },
  });
}

export interface CircleMemberWithProfile {
  user_id: string;
  role: CircleRole;
  joined_at: string;
  profiles: { name: string; avatar: string | null } | null;
}

export function useCircleMembers(circleId: string | undefined) {
  return useQuery({
    queryKey: ['circleMembers', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<CircleMemberWithProfile[]> => {
      const { data, error } = await supabase
        .from('circle_members')
        .select('user_id, role, joined_at, profiles(name, avatar)')
        .eq('circle_id', circleId as string)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return data as unknown as CircleMemberWithProfile[];
    },
  });
}

export function useUpdateMemberRole(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: CircleRole }) => {
      const { error } = await supabase
        .from('circle_members')
        .update({ role })
        .eq('circle_id', circleId as string)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['circleMembers', circleId] }),
  });
}
