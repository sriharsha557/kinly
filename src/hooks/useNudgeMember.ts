import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { generateNudgeMessage } from '../lib/nudgeMessage';
import type { NudgeKind } from '../types/models';

// Reaches out to a circle member who has no event to nudge.
//
// Nudges hang off a row in `events` (nudges.event_id), which is fine on
// Today where you nudge something you can see in the feed - but a member row
// on the Circle tab has no such row, and a member who has gone quiet has by
// definition produced none recently. So this inserts the event first: type
// 'buddy_checkin', whose user_id is the person being reached out to rather
// than the sender, exactly as useCheckInOnBuddy has always done.
//
// Migration 0041's RLS policy admits 'buddy_checkin' from any
// is_circle_member(circle_id), not only from the target's buddy, so this
// generalisation needs no schema change.
export function useNudgeMember(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      targetId,
      targetName,
      fromUserId,
      kind,
    }: {
      targetId: string;
      targetName: string;
      fromUserId: string;
      kind: NudgeKind;
    }) => {
      const message = await generateNudgeMessage(kind, targetName);

      const { data: event, error } = await supabase
        .from('events')
        .insert({
          circle_id: circleId,
          user_id: targetId,
          type: 'buddy_checkin',
          payload: { message },
        })
        .select()
        .single();
      if (error) throw error;

      const { error: nudgeError } = await supabase
        .from('nudges')
        .insert({ event_id: event.id, from_user_id: fromUserId, kind, message });
      if (nudgeError) {
        // The event row above is already durable, and without a matching
        // nudge it becomes an orphan: the feed would permanently claim this
        // person "got a check-in from a circle-mate" for a gesture that
        // never happened, with no push ever sent. Compensate by deleting
        // the event we just inserted before surfacing the real error. If
        // the delete itself fails, swallow that failure - the user-facing
        // error must describe why the nudge failed, not why the cleanup did.
        try {
          await supabase.from('events').delete().eq('id', event.id);
        } catch {
          // Cleanup is best-effort - even a thrown/network failure here
          // must not mask the original nudge error below.
        }
        throw nudgeError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', circleId] });
      queryClient.invalidateQueries({ queryKey: ['garden', circleId] });
    },
  });
}
