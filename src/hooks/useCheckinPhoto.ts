import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// checkin-photos is a private bucket (RLS-gated by circle membership, see
// migration 0026), so a plain public URL doesn't work - every display of a
// photo needs a signed URL. 1 hour is plenty for viewing a feed thumbnail
// or the full-screen view, short enough that a leaked link goes stale soon;
// staleTime refetches a little before actual expiry so a long-open screen
// doesn't show a broken image.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export function useSignedCheckinPhotoUrl(path: string | undefined) {
  return useQuery({
    queryKey: ['checkinPhotoUrl', path],
    enabled: !!path,
    staleTime: (SIGNED_URL_TTL_SECONDS - 60) * 1000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage
        .from('checkin-photos')
        .createSignedUrl(path as string, SIGNED_URL_TTL_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
