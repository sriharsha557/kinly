import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Story, StoryLine } from '../types/models';

export const STORY_LINE_CAP = 8;

export interface StoryLineWithProfile extends StoryLine {
  profiles: { name: string } | null;
}

export interface ActiveStory extends Story {
  story_lines: StoryLineWithProfile[];
}

export function useActiveStory(circleId: string | undefined) {
  return useQuery({
    queryKey: ['activeStory', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<ActiveStory | null> => {
      const { data, error } = await supabase
        .from('stories')
        .select('*, story_lines(*, profiles(name))')
        .eq('circle_id', circleId as string)
        .eq('completed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const lines = (data.story_lines as unknown as StoryLineWithProfile[]) ?? [];
      lines.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return { ...(data as unknown as Story), story_lines: lines };
    },
  });
}

export function useStartStory(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, prompt }: { userId: string; prompt: string }) => {
      const { error } = await supabase.from('stories').insert({ circle_id: circleId, prompt, created_by: userId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activeStory', circleId] }),
  });
}

export function useAddStoryLine(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      storyId,
      userId,
      text,
      currentLineCount,
    }: {
      storyId: string;
      userId: string;
      text: string;
      currentLineCount: number;
    }) => {
      const { error } = await supabase.from('story_lines').insert({ story_id: storyId, user_id: userId, text });
      if (error) throw error;

      if (currentLineCount + 1 >= STORY_LINE_CAP) {
        await supabase.from('stories').update({ completed: true }).eq('id', storyId);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activeStory', circleId] }),
  });
}
