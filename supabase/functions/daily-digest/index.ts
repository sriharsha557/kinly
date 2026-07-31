// One composed summary per circle per day, replacing the individual
// celebration pushes notify-circle's tier gate now suppresses
// (docs/superpowers/specs/2026-07-31-notifications-design.md).
//
// Reads the last 24h of `events` - no new table is needed to accumulate
// digest content, because every event is already in there for the feed.
//
// Deploy: Supabase Dashboard -> Edge Functions -> New function
// "daily-digest" -> paste digest.ts and this file -> Deploy -> turn OFF
// "Enforce JWT verification" (pg_cron's call carries no user JWT, same as
// check-streaks-at-risk). Schedule comes from migration 0040.
//
// Runs at a fixed 13:30 UTC (19:00 IST) for everyone rather than per-user
// local evening - the same approximation migration 0016 documents for
// check-streaks-at-risk. Per-user timezones are the upgrade path when
// Kinly expands beyond one region.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { composeDigest, type DigestEvent } from './digest.ts';

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: circles, error: circlesError } = await supabase
      .from('circles')
      .select('id, name')
      .is('deleted_at', null);
    if (circlesError) throw circlesError;

    let sent = 0;
    let skipped = 0;

    for (const circle of circles ?? []) {
      const { data: rows } = await supabase
        .from('events')
        .select('type, user_id, payload, profiles(name)')
        .eq('circle_id', circle.id)
        .gte('created_at', since);

      const events: DigestEvent[] = (rows ?? []).map((row) => ({
        type: row.type as string,
        user_id: row.user_id as string,
        actor_name: ((row.profiles as unknown as { name: string } | null)?.name) ?? 'Someone',
        payload: (row.payload ?? {}) as Record<string, unknown>,
      }));

      const { data: members } = await supabase
        .from('circle_members')
        .select('user_id')
        .eq('circle_id', circle.id)
        .eq('status', 'active');
      const memberIds = (members ?? []).map((m) => m.user_id as string);
      if (memberIds.length === 0) continue;

      // composeDigest ignores immediate-tier types on its own by only
      // reading the four it summarises, so no pre-filter is needed here.
      const lines = composeDigest(events, memberIds.length);
      if (!lines) {
        skipped++;
        continue;
      }

      const { data: mutes } = await supabase
        .from('notification_mutes')
        .select('user_id')
        .eq('circle_id', circle.id)
        .eq('category', 'tier_digest')
        .in('user_id', memberIds);
      const muted = new Set((mutes ?? []).map((m) => m.user_id as string));
      const recipients = memberIds.filter((id) => !muted.has(id));
      if (recipients.length === 0) continue;

      const { data: tokens } = await supabase.from('push_tokens').select('token').in('user_id', recipients);
      const messages = (tokens ?? []).map((t) => ({
        to: t.token as string,
        sound: 'default',
        title: `🌱 Today in ${(circle.name as string) ?? 'your circle'}`,
        body: lines.map((line) => `• ${line}`).join('\n'),
        priority: 'high',
        channelId: 'default',
      }));
      if (messages.length === 0) continue;

      // Same 100-message chunking and dead-token pruning as notify-circle:
      // a circle caps at 10 members but each can hold several device tokens.
      for (let i = 0; i < messages.length; i += 100) {
        const chunk = messages.slice(i, i + 100);
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(chunk),
        });
        const result = (await response.json()) as {
          data?: { id?: string; status: string; details?: { error?: string } }[];
          errors?: unknown;
        };
        console.log('digest push tickets', circle.id, JSON.stringify(result.data ?? result.errors));
        const deadTokens = chunk
          .filter((_, idx) => result.data?.[idx]?.details?.error === 'DeviceNotRegistered')
          .map((m) => m.to);
        if (deadTokens.length > 0) {
          await supabase.from('push_tokens').delete().in('token', deadTokens);
        }
      }
      sent++;
    }

    return new Response(JSON.stringify({ circles: circles?.length ?? 0, sent, skipped }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});
