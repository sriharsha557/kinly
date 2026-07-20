import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { MoodValue } from '../types/models';

export interface MoodCheckinWithProfile {
  user_id: string;
  mood: MoodValue;
  tags: string[];
  profiles: { name: string } | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// One query covers both card states: whether *I've* checked in today (find
// my own user_id in the list) and the circle grid once I have (everyone
// else's mood, or lack of one).
export function useTodayMoodCheckins(circleId: string | undefined) {
  return useQuery({
    queryKey: ['moodCheckins', circleId, todayIso()],
    enabled: !!circleId,
    queryFn: async (): Promise<MoodCheckinWithProfile[]> => {
      const { data, error } = await supabase
        .from('mood_checkins')
        .select('user_id, mood, tags, profiles(name)')
        .eq('circle_id', circleId as string)
        .eq('checkin_date', todayIso());
      if (error) throw error;
      return data as unknown as MoodCheckinWithProfile[];
    },
  });
}

export function useSubmitMoodCheckin(circleId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ mood, tags = [] }: { mood: MoodValue; tags?: string[] }) => {
      const today = todayIso();

      const { error } = await supabase
        .from('mood_checkins')
        .upsert(
          { user_id: userId, circle_id: circleId, mood, tags, checkin_date: today },
          { onConflict: 'user_id,circle_id,checkin_date' },
        );
      if (error) throw error;

      // Changing your mind same-day doesn't create a second feed entry -
      // it overwrites today's existing mood_checkin event's payload in
      // place, so Circle Activity always reflects the latest mood instead
      // of freezing on whatever was picked first. created_at is left
      // alone deliberately: the event shouldn't jump back to the top of
      // the feed just because you changed your mind, only its content
      // should update.
      const startOfDay = `${today}T00:00:00.000Z`;
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id')
        .eq('circle_id', circleId)
        .eq('user_id', userId)
        .eq('type', 'mood_checkin')
        .gte('created_at', startOfDay)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingEvent) {
        await supabase.from('events').update({ payload: { mood } }).eq('id', existingEvent.id);
      } else {
        await supabase.from('events').insert({ circle_id: circleId, user_id: userId, type: 'mood_checkin', payload: { mood } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moodCheckins', circleId] });
      queryClient.invalidateQueries({ queryKey: ['events', circleId] });
    },
  });
}
