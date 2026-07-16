import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Meetup, RsvpStatus } from '../types/models';

export interface MeetupWithRsvps extends Meetup {
  profiles: { name: string } | null;
  meetup_rsvps: { user_id: string; status: RsvpStatus }[];
}

export function useMeetups(circleId: string | undefined) {
  return useQuery({
    queryKey: ['meetups', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<MeetupWithRsvps[]> => {
      const { data, error } = await supabase
        .from('meetups')
        .select('*, profiles(name), meetup_rsvps(user_id, status)')
        .eq('circle_id', circleId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as MeetupWithRsvps[];
    },
  });
}

export function useProposeMeetup(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      title,
      note,
      proposedDate,
    }: {
      userId: string;
      title: string;
      note?: string;
      proposedDate?: string | null;
    }) => {
      const { error } = await supabase.from('meetups').insert({
        circle_id: circleId,
        created_by: userId,
        title,
        note: note || null,
        proposed_date: proposedDate || null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetups', circleId] }),
  });
}

export function useRsvpMeetup(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      meetupId,
      userId,
      status,
    }: {
      meetupId: string;
      userId: string;
      status: RsvpStatus;
    }) => {
      const { error } = await supabase
        .from('meetup_rsvps')
        .upsert({ meetup_id: meetupId, user_id: userId, status }, { onConflict: 'meetup_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetups', circleId] }),
  });
}
