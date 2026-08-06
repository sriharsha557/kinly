import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Area } from '../types/models';

// The Area catalog is seeded by migration 0046 and has no write policy at
// all - members cannot create Areas, and that is enforced by the database
// rather than only by the absence of a button. It changes only when a
// migration changes it, so it is cached hard.
export function useAreas() {
  return useQuery({
    queryKey: ['areas'],
    staleTime: Infinity,
    queryFn: async (): Promise<Area[]> => {
      const { data, error } = await supabase.from('areas').select('*').order('sort_order');
      if (error) throw error;
      return data as Area[];
    },
  });
}

// The Areas a circle has switched on, as full Area rows ready to render.
// Returning join rows instead would make every caller re-join against
// useAreas just to get a label and an emoji.
export function useCircleAreas(circleId: string | undefined) {
  return useQuery({
    queryKey: ['circle-areas', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<Area[]> => {
      const { data, error } = await supabase
        .from('circle_areas')
        .select('area_id, enabled, areas(*)')
        .eq('circle_id', circleId as string)
        .eq('enabled', true);
      if (error) throw error;
      const areas = (data ?? [])
        .map((row) => (row as unknown as { areas: Area }).areas)
        .filter(Boolean);
      return areas.sort((a, b) => a.sort_order - b.sort_order);
    },
  });
}
