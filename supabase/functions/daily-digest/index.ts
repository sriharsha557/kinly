// One composed summary per circle per day, replacing the individual
// celebration pushes notify-circle's tier gate now suppresses
// (docs/superpowers/specs/2026-07-31-notifications-design.md).
//
// Reads the last 24h of `events` for streaks, completions and garden growth
// - no new table is needed for those, because every event is already in
// there for the feed. Participation also reads `goal_checkins` directly:
// an Areas of Growth check-in never writes an events row, so events alone
// would miss it.
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

// The 13:30 UTC boundary is correctness-critical, not cosmetic: the window
// computed below is anchored to it, and if the pg_cron schedule and these
// constants ever disagree, the window silently misaligns with the actual
// run. They must match the schedule set in migration 0040_daily_digest_cron.sql
// (a forward reference - that migration doesn't exist yet, it's written in
// the next task). Changing one without the other misaligns the window.
const DIGEST_HOUR_UTC = 13;
const DIGEST_MINUTE_UTC = 30;

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Anchored to the most recent 13:30 UTC boundary (the scheduled run
    // time set by migration 0040) instead of "now minus 24h": a sliding
    // window drifts with cron jitter and cold-start time, so a late run
    // permanently drops events and an early run repeats them across two
    // digests, and it makes "Everyone checked in today" cover a window
    // that routinely spans two calendar days. Anchoring makes consecutive
    // runs' windows tile exactly, so a late run is harmless.
    //
    // The window is half-open [anchor - 24h, anchor): the lower bound
    // (`since`, below) and the upper bound (`anchor` itself, applied as
    // `.lt('created_at', ...)` on the events query) together are what make
    // consecutive runs' windows abut exactly with no gap and no overlap.
    // Without the upper bound, events created between the anchor instant
    // and the actual run instant would land in both today's and tomorrow's
    // window and get digested twice.
    const now = new Date();
    const anchor = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DIGEST_HOUR_UTC, DIGEST_MINUTE_UTC, 0, 0),
    );
    if (anchor.getTime() > now.getTime()) {
      anchor.setUTCDate(anchor.getUTCDate() - 1);
    }
    const since = new Date(anchor.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: circles, error: circlesError } = await supabase
      .from('circles')
      .select('id, name')
      .is('deleted_at', null);
    if (circlesError) throw circlesError;

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const circle of circles ?? []) {
      try {
        const { data: rows, error: eventsError } = await supabase
          .from('events')
          .select('type, user_id, payload, profiles(name)')
          .eq('circle_id', circle.id)
          .gte('created_at', since)
          .lt('created_at', anchor.toISOString())
          .order('created_at', { ascending: false });
        if (eventsError) {
          console.log('daily-digest events query failed', circle.id, eventsError.message);
          failed++;
          continue;
        }

        const events: DigestEvent[] = (rows ?? []).map((row) => ({
          type: row.type as string,
          user_id: row.user_id as string,
          actor_name: ((row.profiles as unknown as { name: string } | null)?.name) ?? 'Someone',
          payload: (row.payload ?? {}) as Record<string, unknown>,
        }));

        // Leaving a circle (migration 0019) only sets deleted_at - it never
        // flips status away from 'active' - and this function runs with
        // SUPABASE_SERVICE_ROLE_KEY, which bypasses the RLS that hides
        // those rows from the app. Without this filter, ex-members would
        // keep receiving the digest forever and would inflate the member
        // count passed to composeDigest.
        const { data: members, error: membersError } = await supabase
          .from('circle_members')
          .select('user_id')
          .eq('circle_id', circle.id)
          .eq('status', 'active')
          .is('deleted_at', null);
        if (membersError) {
          console.log('daily-digest members query failed', circle.id, membersError.message);
          failed++;
          continue;
        }
        const memberIds = (members ?? []).map((m) => m.user_id as string);
        if (memberIds.length === 0) continue;

        // Areas of Growth check-ins live in goal_checkins, not in events -
        // nothing writes an events row for a cadence commitment. Read the
        // same half-open [since, anchor) window as the events query above so
        // a check-in counts in exactly one day's digest, never zero or two.
        // goals!inner(circle_id) scopes the join to this circle - goal_checkins
        // itself carries no circle_id, only goal_id.
        const { data: checkinRows, error: checkinsError } = await supabase
          .from('goal_checkins')
          .select('user_id, goals!inner(circle_id)')
          .eq('goals.circle_id', circle.id)
          .gte('created_at', since)
          .lt('created_at', anchor.toISOString());
        if (checkinsError) {
          console.log('daily-digest checkins query failed', circle.id, checkinsError.message);
          failed++;
          continue;
        }
        const checkedInUserIds = [...new Set((checkinRows ?? []).map((r) => r.user_id as string))];

        // composeDigest ignores immediate-tier types on its own by only
        // reading the four it summarises, so no pre-filter is needed here.
        const lines = composeDigest(events, memberIds.length, checkedInUserIds);
        if (!lines) {
          skipped++;
          continue;
        }

        const { data: mutes, error: mutesError } = await supabase
          .from('notification_mutes')
          .select('user_id')
          .eq('circle_id', circle.id)
          .eq('category', 'tier_digest')
          .in('user_id', memberIds);
        if (mutesError) {
          // Mutes must fail closed: on a transient failure the muted set
          // would otherwise come out empty and everyone who muted
          // tier_digest would get the push anyway, silently overriding an
          // explicit user setting.
          console.log('daily-digest mutes query failed', circle.id, mutesError.message);
          failed++;
          continue;
        }
        const muted = new Set((mutes ?? []).map((m) => m.user_id as string));
        const recipients = memberIds.filter((id) => !muted.has(id));
        if (recipients.length === 0) continue;

        const { data: tokens } = await supabase.from('push_tokens').select('token').in('user_id', recipients);
        const messages = (tokens ?? []).map((t) => ({
          to: t.token as string,
          sound: 'default',
          title: `🌱 Today in ${circle.name as string}`,
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
            console.log('pruned dead push tokens', deadTokens.length);
          }
        }
        sent++;
      } catch (circleError) {
        // A throw anywhere in this circle's body (a rejected fetch, or
        // response.json() on a non-JSON body from a 502) must not unwind
        // to the outer catch: this is a once-daily cron with no retry, so
        // that would silently drop the digest for every circle later in
        // the list for the whole day. Isolate the failure to this circle.
        failed++;
        console.log('daily-digest circle failed', circle.id, (circleError as Error).message);
      }
    }

    return new Response(JSON.stringify({ circles: circles?.length ?? 0, sent, skipped, failed }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});
