import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { NudgeMessage } from '../lib/nudgeMessages';

// The whole library, fetched once per session. Seeded copy does not change
// mid-session, so a long staleTime makes every nudge after the first fetch
// instant and local - which is the point of replacing a per-call API request.
//
// Offline is not a concern: sending a nudge writes rows to Postgres, so the
// network is already required by the time this matters.
const LIBRARY_STALE_TIME = 60 * 60 * 1000;

export function useNudgeMessages() {
  const query = useQuery({
    queryKey: ['nudgeMessages'],
    staleTime: LIBRARY_STALE_TIME,
    queryFn: async (): Promise<NudgeMessage[]> => {
      const { data, error } = await supabase
        .from('nudge_messages')
        .select('id, kind, placeholders, body, weight')
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id as string,
        kind: row.kind as string,
        placeholders: (row.placeholders as string[]) ?? [],
        body: row.body as string,
        weight: (row.weight as number) ?? 1,
      }));
    },
  });

  return { messages: query.data ?? [] };
}
