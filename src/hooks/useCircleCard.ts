import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { todaysPrompt } from '../lib/circleCardPrompts';
import type { CircleCardAnswer } from '../types/models';

export interface CircleCardAnswerWithProfile extends CircleCardAnswer {
  profiles: { name: string } | null;
}

export function useCircleCard(circleId: string | undefined) {
  const { date, prompt } = circleId ? todaysPrompt(circleId) : { date: '', prompt: '' };

  const query = useQuery({
    queryKey: ['circleCard', circleId, date],
    enabled: !!circleId,
    queryFn: async (): Promise<CircleCardAnswerWithProfile[]> => {
      const { data, error } = await supabase
        .from('circle_card_answers')
        .select('*, profiles(name)')
        .eq('circle_id', circleId as string)
        .eq('prompt_date', date)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as CircleCardAnswerWithProfile[];
    },
  });

  return { ...query, prompt, date };
}

export function useAnswerCircleCard(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      promptDate,
      promptText,
      answer,
    }: {
      userId: string;
      promptDate: string;
      promptText: string;
      answer: string;
    }) => {
      const { error } = await supabase.from('circle_card_answers').insert({
        circle_id: circleId,
        user_id: userId,
        prompt_date: promptDate,
        prompt_text: promptText,
        answer,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['circleCard', circleId] }),
  });
}
