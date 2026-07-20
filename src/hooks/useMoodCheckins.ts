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

      // Only emit a feed event on the FIRST check-in of the day - changing
      // your mind same-day (a different mood or tags) updates the row
      // silently, so flip-flopping doesn't spam Circle Activity.
      const { data: existing } = await supabase
        .from('mood_checkins')
        .select('id')
        .eq('user_id', userId)
        .eq('circle_id', circleId)
        .eq('checkin_date', today)
        .maybeSingle();

      const { error } = await supabase
        .from('mood_checkins')
        .upsert(
          { user_id: userId, circle_id: circleId, mood, tags, checkin_date: today },
          { onConflict: 'user_id,circle_id,checkin_date' },
        );
      if (error) throw error;

      if (!existing) {
        await supabase.from('events').insert({ circle_id: circleId, user_id: userId, type: 'mood_checkin', payload: { mood } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moodCheckins', circleId] });
      queryClient.invalidateQueries({ queryKey: ['events', circleId] });
    },
  });
}
