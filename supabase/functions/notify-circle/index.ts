// Fans out an Expo push notification when a circle-relevant row is inserted.
// Deploy: Supabase Dashboard -> Edge Functions -> New function "notify-circle"
// -> paste this file -> Deploy. Then wire up five Database Webhooks (Database
// -> Webhooks): INSERT on events / nudges / ask_replies, plus INSERT and
// UPDATE on circle_members (the latter two for join-request/approval
// notifications, added alongside migration 0022's pending-approval flow) -
// each pointing at this function's URL with header "Authorization: Bearer
// <anon key>" (Database Webhooks send no user JWT, so this function must not
// require one - either set the header above, or turn off "Enforce JWT
// verification" on the function).
//
// Uses SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, which Supabase injects into
// every Edge Function automatically - no extra secret needed for this one.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { tierFor } from './tiers.ts';

interface WebhookPayload {
  table: string;
  record: Record<string, unknown>;
  old_record?: Record<string, unknown>;
}

// Only the event types that still earn a push need copy here. Celebrations
// (goal_completed / streak / challenge_completed / streak_saved /
// progress_photo) and the four Moments-only types return early at the tier
// gate, so their old entries were dead code and are gone. 'reminder' is
// absent too: it needs different copy per recipient, built in the events
// branch below.
const EVENT_MESSAGES: Record<string, (actorName: string, payload: Record<string, unknown>) => string> = {
  ask: (name, payload) => `${name} asked: "${payload.question ?? ''}"`,
  mood_checkin: (name) => `${name} is having a tough day — send some encouragement?`,
};

// Maps each source into the mute category a user can turn off in Circle
// Settings. events.type is used directly except for 'reminder', which
// covers both streak-at-risk and buddy check-ins under one toggle.
function categoryFor(table: string, eventType?: string): string {
  if (table === 'nudges') return 'nudge';
  if (table === 'ask_replies') return 'reply';
  return eventType ?? 'reminder';
}

async function filterMuted(
  supabase: ReturnType<typeof createClient>,
  recipients: string[],
  circleId: string,
  category: string,
): Promise<string[]> {
  if (recipients.length === 0) return recipients;
  const { data: mutes } = await supabase
    .from('notification_mutes')
    .select('user_id')
    .eq('circle_id', circleId)
    .eq('category', category)
    .in('user_id', recipients);
  const muted = new Set((mutes ?? []).map((m) => m.user_id as string));
  return recipients.filter((id) => !muted.has(id));
}

Deno.serve(async (req) => {
  try {
    const { table, record, old_record }: WebhookPayload = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // One push text per recipient group. A streak-at-risk reminder goes to
    // two groups with different copy ("your streak" vs "your buddy's
    // streak"), which a single shared title/body could not express.
    const deliveries: { recipients: string[]; title: string; body: string }[] = [];
    let circleId = '';
    let category = '';

    if (table === 'events') {
      circleId = record.circle_id as string;
      const subjectId = record.user_id as string;
      const type = record.type as string;
      const payload = (record.payload ?? {}) as Record<string, unknown>;
      category = categoryFor(table, type);

      // The volume fix: everything lands in the feed via the events row
      // that triggered this webhook, and pushing is a deliberate promotion
      // out of it. Returning here leaves the feed completely unaffected.
      if (tierFor(table, type, payload) === 'feed') return new Response('feed only');

      const { data: subject } = await supabase.from('profiles').select('name').eq('id', subjectId).single();
      const subjectName = (subject?.name as string) ?? 'Someone';

      if (type === 'reminder') {
        // events.user_id on a reminder is the goal *owner* - the row is
        // about them, not by them. This branch used to fall through to the
        // generic "notify every active member except user_id", which sent
        // "X could use a nudge" to the whole circle and to nobody who could
        // act on it. Narrowed to the owner plus their watcher(s); the spec
        // records this as an intentional reduction in reach.
        //
        // buddy_pairs is one-directional (migration 0011): a row
        // (user_id: A, buddy_id: B) means A picked B to watch, not the
        // reverse, and reciprocation isn't required. So the people who
        // should be nudged about subjectId's at-risk streak are the rows
        // pointing AT subjectId (buddy_id = subjectId) - the watchers - not
        // whoever subjectId themselves picked. The primary key is
        // (circle_id, user_id), so buddy_id isn't unique: several members
        // can all watch the same person, and all of them should be notified.
        const { data: watchers } = await supabase
          .from('buddy_pairs')
          .select('user_id')
          .eq('circle_id', circleId)
          .eq('buddy_id', subjectId);

        // payload.message is already written in the second person by
        // check-streaks-at-risk ("Your 5-day streak on X is at risk..."),
        // so it needs no wrapping for the owner.
        deliveries.push({
          recipients: [subjectId],
          title: 'Kinly',
          body: (payload.message as string) ?? 'Your streak is at risk — log progress today!',
        });

        const watcherIds = (watchers ?? [])
          .map((w) => w.user_id as string)
          .filter((id) => id !== subjectId);
        if (watcherIds.length > 0) {
          deliveries.push({
            recipients: watcherIds,
            title: 'Kinly',
            body: `${subjectName}'s streak is at risk — nudge them?`,
          });
        }
      } else {
        // ask and tough-day mood_checkin: the circle, minus the actor.
        // Pending members (migration 0022) can't see anything circle-scoped
        // yet, so they must not be notified about it either.
        //
        // Leaving a circle (migration 0019) only sets deleted_at - it never
        // flips status away from 'active' - and this function runs with
        // SUPABASE_SERVICE_ROLE_KEY, which bypasses the RLS that hides
        // those rows from the app. Without this filter, ex-members would
        // keep getting pushed about asks and tough-day check-ins.
        const { data: members } = await supabase
          .from('circle_members')
          .select('user_id')
          .eq('circle_id', circleId)
          .eq('status', 'active')
          .is('deleted_at', null);
        deliveries.push({
          recipients: (members ?? []).map((m) => m.user_id as string).filter((id) => id !== subjectId),
          title: 'Kinly',
          body: (EVENT_MESSAGES[type] ?? (() => `${subjectName} has an update`))(subjectName, payload),
        });
      }
    } else if (table === 'nudges') {
      const { data: event } = await supabase
        .from('events')
        .select('user_id, circle_id')
        .eq('id', record.event_id as string)
        .single();
      if (!event) return new Response('ok');
      circleId = event.circle_id as string;
      category = categoryFor(table);

      const { data: sender } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', record.from_user_id as string)
        .single();
      const recipientId = event.user_id as string;
      deliveries.push({
        recipients: recipientId !== record.from_user_id ? [recipientId] : [],
        title: `${(sender?.name as string) ?? 'A friend'} sent you a nudge`,
        body: (record.message as string) ?? 'Sending you encouragement!',
      });
    } else if (table === 'ask_replies') {
      const { data: post } = await supabase
        .from('ask_posts')
        .select('user_id, circle_id')
        .eq('id', record.ask_post_id as string)
        .single();
      if (!post) return new Response('ok');
      circleId = post.circle_id as string;
      category = categoryFor(table);

      const { data: replier } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', record.user_id as string)
        .single();
      const recipientId = post.user_id as string;
      deliveries.push({
        recipients: recipientId !== record.user_id ? [recipientId] : [],
        title: `${(replier?.name as string) ?? 'Someone'} replied`,
        body: record.body as string,
      });
    } else if (table === 'circle_members' && record.status === 'pending' && !old_record) {
      // New join request (INSERT) - notify the circle's owner/admins so
      // they know to approve/decline it.
      circleId = record.circle_id as string;
      category = 'membership'; // not a UI-exposed mute category, so this never gets filtered out below

      const { data: circle } = await supabase.from('circles').select('name').eq('id', circleId).single();
      const { data: joiner } = await supabase.from('profiles').select('name').eq('id', record.user_id as string).single();

      const { data: approvers } = await supabase
        .from('circle_members')
        .select('user_id')
        .eq('circle_id', circleId)
        .eq('status', 'active')
        .in('role', ['owner', 'admin']);
      deliveries.push({
        recipients: (approvers ?? []).map((m) => m.user_id as string),
        title: 'New join request',
        body: `${(joiner?.name as string) ?? 'Someone'} wants to join ${(circle?.name as string) ?? 'your circle'}`,
      });
    } else if (
      table === 'circle_members' &&
      record.status === 'active' &&
      old_record?.status === 'pending'
    ) {
      // Approval (UPDATE pending -> active) - notify the joiner they're in.
      circleId = record.circle_id as string;
      category = 'membership';

      const { data: circle } = await supabase.from('circles').select('name').eq('id', circleId).single();
      deliveries.push({
        recipients: [record.user_id as string],
        title: 'Kinly',
        body: `You're in! Welcome to ${(circle?.name as string) ?? 'the circle'}.`,
      });
    } else {
      return new Response('ignored');
    }

    for (const delivery of deliveries) {
      let recipients = delivery.recipients;

      // Circle management is exempt from every switch: missing "you're in!"
      // or an unanswered join request strands a real person. Everything
      // else clears the tier switch first, then its own category mute -
      // a tier switched off silences that tier entirely, and switched on,
      // the per-category mutes apply exactly as they did before.
      if (category !== 'membership') {
        recipients = await filterMuted(supabase, recipients, circleId, 'tier_immediate');
        recipients = await filterMuted(supabase, recipients, circleId, category);
      }
      if (recipients.length === 0) continue;

      const { data: tokens } = await supabase.from('push_tokens').select('token').in('user_id', recipients);
      const messages = (tokens ?? []).map((t) => ({
        to: t.token as string,
        sound: 'default',
        title: delivery.title,
        body: delivery.body,
        priority: 'high',
        channelId: 'default',
      }));

      // Expo's push API accepts at most 100 messages per request. Circles cap
      // at 10 members but a user can hold multiple device tokens, so chunk
      // defensively rather than assume.
      for (let i = 0; i < messages.length; i += 100) {
        const chunk = messages.slice(i, i + 100);
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(chunk),
        });
        const result = (await response.json()) as {
          data?: { id?: string; status: string; message?: string; details?: { error?: string } }[];
          errors?: unknown;
        };

        // Ticket IDs land in the function's logs (Dashboard -> Edge Functions
        // -> notify-circle -> Logs) so a "did it even send?" question has an
        // answer. Receipts proper need a ~15-min-later poll, which a
        // request-scoped function can't do - but delivery failures that
        // matter (dead tokens) also surface right here in the ticket, so
        // prune those immediately instead.
        console.log('expo push tickets', JSON.stringify(result.data ?? result.errors));
        const deadTokens = chunk
          .filter((_, idx) => result.data?.[idx]?.details?.error === 'DeviceNotRegistered')
          .map((m) => m.to);
        if (deadTokens.length > 0) {
          await supabase.from('push_tokens').delete().in('token', deadTokens);
          console.log('pruned dead push tokens', deadTokens.length);
        }
      }
    }

    return new Response('ok');
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});
