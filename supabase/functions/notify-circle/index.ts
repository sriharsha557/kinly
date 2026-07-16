// Fans out an Expo push notification when a circle-relevant row is inserted.
// Deploy: Supabase Dashboard -> Edge Functions -> New function "notify-circle"
// -> paste this file -> Deploy. Then wire up three Database Webhooks (Database
// -> Webhooks) for INSERT on events / nudges / ask_replies, each pointing at
// this function's URL with header "Authorization: Bearer <anon key>" (Database
// Webhooks send no user JWT, so this function must not require one - either
// set the header above, or turn off "Enforce JWT verification" on the function).
//
// Uses SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, which Supabase injects into
// every Edge Function automatically - no extra secret needed for this one.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface WebhookPayload {
  table: string;
  record: Record<string, unknown>;
}

const EVENT_MESSAGES: Record<string, (actorName: string, payload: Record<string, unknown>) => string> = {
  goal_completed: (name, payload) => `${name} completed "${payload.title ?? 'a goal'}" — send a cheer?`,
  streak: (name) => `${name} is on a streak — keep them going!`,
  reminder: (name, payload) => `${name} could use a nudge: ${payload.message ?? ''}`,
  ask: (name, payload) => `${name} asked: "${payload.question ?? ''}"`,
};

Deno.serve(async (req) => {
  try {
    const { table, record }: WebhookPayload = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let title = 'Kinly';
    let body = '';
    let recipients: string[] = [];

    if (table === 'events') {
      const circleId = record.circle_id as string;
      const actorId = record.user_id as string;
      const type = record.type as string;
      const payload = (record.payload ?? {}) as Record<string, unknown>;

      const { data: actor } = await supabase.from('profiles').select('name').eq('id', actorId).single();
      const actorName = (actor?.name as string) ?? 'Someone';
      body = (EVENT_MESSAGES[type] ?? (() => `${actorName} has an update`))(actorName, payload);

      const { data: members } = await supabase.from('circle_members').select('user_id').eq('circle_id', circleId);
      recipients = (members ?? []).map((m) => m.user_id as string).filter((id) => id !== actorId);
    } else if (table === 'nudges') {
      const { data: event } = await supabase
        .from('events')
        .select('user_id')
        .eq('id', record.event_id as string)
        .single();
      if (!event) return new Response('ok');

      const { data: sender } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', record.from_user_id as string)
        .single();
      title = `${(sender?.name as string) ?? 'A friend'} sent you a nudge`;
      body = (record.message as string) ?? 'Sending you encouragement!';

      const recipientId = event.user_id as string;
      recipients = recipientId !== record.from_user_id ? [recipientId] : [];
    } else if (table === 'ask_replies') {
      const { data: post } = await supabase
        .from('ask_posts')
        .select('user_id')
        .eq('id', record.ask_post_id as string)
        .single();
      if (!post) return new Response('ok');

      const { data: replier } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', record.user_id as string)
        .single();
      title = `${(replier?.name as string) ?? 'Someone'} replied`;
      body = record.body as string;

      const recipientId = post.user_id as string;
      recipients = recipientId !== record.user_id ? [recipientId] : [];
    } else {
      return new Response('ignored');
    }

    if (recipients.length === 0) return new Response('no recipients');

    const { data: tokens } = await supabase.from('push_tokens').select('token').in('user_id', recipients);
    const messages = (tokens ?? []).map((t) => ({ to: t.token as string, sound: 'default', title, body }));

    if (messages.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(messages),
      });
    }

    return new Response('ok');
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});
