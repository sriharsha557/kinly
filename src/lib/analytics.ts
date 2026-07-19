import { supabase } from './supabase';

type AnalyticsEvent = 'circle_created' | 'member_joined';

// Fire-and-forget: analytics must never break the feature it's attached to.
// actor_user_id (who performed the action) fills in server-side via the
// column default (auth.uid()); subjectUserId (who the event is *about*) is
// only different from the actor for member_joined, logged from the
// approving owner/admin's session, not the joining member's own.
export function logAnalyticsEvent(
  eventName: AnalyticsEvent,
  circleId: string | undefined,
  subjectUserId?: string,
) {
  supabase
    .from('analytics_events')
    .insert({ event_name: eventName, circle_id: circleId, subject_user_id: subjectUserId })
    .then(({ error }) => {
      if (error) console.warn(`analytics_events insert failed (${eventName}):`, error.message);
    });
}
