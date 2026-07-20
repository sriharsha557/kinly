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

// Both writes (mood_checkins row + its Circle Activity event) happen
// atomically inside submit_mood_checkin() (migration 0031) - a real
// partial unique index on events backs the upsert there, so two
// concurrent submissions (double-tap, two devices) can't both miss an
// existing row and create duplicates the way a client-side read-then-
// write would. auth.uid() inside the RPC identifies the caller, so this
// no longer needs a userId param at all.
export function useSubmitMoodCheckin(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ mood, tags = [] }: { mood: MoodValue; tags?: string[] }) => {
      const { error } = await supabase.rpc('submit_mood_checkin', {
        p_circle_id: circleId,
        p_mood: mood,
        p_tags: tags,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moodCheckins', circleId] });
      queryClient.invalidateQueries({ queryKey: ['events', circleId] });
    },
  });
}
