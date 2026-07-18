import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { VisionItem } from '../types/models';

export interface VisionItemWithProfile extends VisionItem {
  profiles: { name: string } | null;
}

export function useVisionItems(circleId: string | undefined) {
  return useQuery({
    queryKey: ['visionItems', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<VisionItemWithProfile[]> => {
      const { data, error } = await supabase
        .from('vision_items')
        .select('*, profiles(name)')
        .eq('circle_id', circleId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as VisionItemWithProfile[];
    },
  });
}

export function useAddVisionItem(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      title,
      imageUrl,
    }: {
      userId: string;
      title: string;
      imageUrl?: string | null;
    }) => {
      const { error } = await supabase
        .from('vision_items')
        .insert({ circle_id: circleId, user_id: userId, title, image_url: imageUrl ?? null });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visionItems', circleId] }),
  });
}

export function useDeleteVisionItem(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vision_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visionItems', circleId] }),
  });
}
