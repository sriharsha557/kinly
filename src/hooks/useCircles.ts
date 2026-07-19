import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logAnalyticsEvent } from '../lib/analytics';
import type { Circle, CircleMemberStatus, CircleRole } from '../types/models';

export interface CircleWithMembership extends Circle {
  membershipStatus: CircleMemberStatus;
}

// refetchInterval is opt-in (undefined = no polling) so ordinary screens
// (CircleSettings, the circle switcher) don't poll in the background -
// RootNavigator passes one while a membership is pending, to detect an
// approval without a realtime channel (this codebase uses none elsewhere).
export function useMyCircles(userId: string | undefined, refetchInterval?: number) {
  return useQuery({
    queryKey: ['circles', userId],
    enabled: !!userId,
    refetchInterval,
    queryFn: async (): Promise<CircleWithMembership[]> => {
      const { data, error } = await supabase
        .from('circle_members')
        .select('status, circles(*)')
        .eq('user_id', userId as string);
      if (error) throw error;
      return (data ?? []).flatMap((row) =>
        row.circles ? [{ ...(row.circles as unknown as Circle), membershipStatus: row.status as CircleMemberStatus }] : [],
      );
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
    onSuccess: (circle) => {
      logAnalyticsEvent('circle_created', circle.id);
      queryClient.invalidateQueries({ queryKey: ['circles'] });
    },
  });
}

// Joining always lands the caller in 'pending' status (migration 0022) -
// the returned circle is real, but the caller isn't an active member yet.
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

export function useCancelJoinRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (circleId: string) => {
      const { error } = await supabase.rpc('cancel_join_request', { p_circle_id: circleId });
      if (error) throw error;
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
  status: CircleMemberStatus;
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
        .select('user_id, role, status, joined_at, profiles(name, avatar)')
        .eq('circle_id', circleId as string)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return data as unknown as CircleMemberWithProfile[];
    },
  });
}

export function useLeaveCircle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (circleId: string) => {
      const { error } = await supabase.rpc('leave_circle', { p_circle_id: circleId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['circles'] }),
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

export function useApproveMember(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('approve_member', { p_circle_id: circleId as string, p_user_id: userId });
      if (error) throw error;
      return userId;
    },
    onSuccess: (approvedUserId) => {
      logAnalyticsEvent('member_joined', circleId, approvedUserId);
      queryClient.invalidateQueries({ queryKey: ['circleMembers', circleId] });
    },
  });
}

export function useRejectMember(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('reject_member', { p_circle_id: circleId as string, p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['circleMembers', circleId] }),
  });
}
