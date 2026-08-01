// Runs on a daily schedule (see migration 0016's pg_cron job) to find goals
// whose streak breaks if not logged today, and insert a 'reminder' event for
// each - which then flows through the existing events INSERT Database
// Webhook to notify-circle automatically, so no separate push logic is
// needed here.
//
// Also snapshots every active circle's Garden health once a day (migration
// 0027) - Garden health is otherwise computed live with no stored history,
// but the weekly scorecard's "health delta" needs something 7 days old to
// diff against, and reusing this already-scheduled daily run avoids adding
// a second cron just for that.
//
// Deploy: Supabase Dashboard -> Edge Functions -> New function
// "check-streaks-at-risk" -> paste this file -> Deploy -> turn OFF
// "Enforce JWT verification" (pg_cron's call carries no user JWT, same as
// notify-circle's Database Webhook).
//
// Known limitation: last_logged_date has no per-user timezone, so the cron
// fires at one fixed UTC time for everyone rather than "end of day, your
// time" - an approximation, not exact.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    // Every query in this function runs with the service-role key, which
    // bypasses RLS - so the soft-delete filters the app gets for free from
    // its policies have to be written by hand here. Without them a deleted
    // goal, or a goal belonging to someone who left the circle, still
    // generates a reminder event. That was invisible while notify-circle
    // was never invoked; the moment push notifications started working it
    // became a push to someone about a goal they deleted, or about a circle
    // they left.
    const { data: goals, error } = await supabase
      .from('goals')
      .select('id, user_id, circle_id, title, streak_count')
      .eq('last_logged_date', isoDate(yesterday))
      .gt('streak_count', 0)
      .is('deleted_at', null);
    if (error) throw error;

    // Membership is checked per (circle, user) rather than per user: leaving
    // one circle should silence reminders for that circle's goals only.
    const { data: memberships, error: membershipError } = await supabase
      .from('circle_members')
      .select('circle_id, user_id')
      .eq('status', 'active')
      .is('deleted_at', null);
    if (membershipError) throw membershipError;
    const activeMembers = new Set(
      (memberships ?? []).map((m) => `${m.circle_id}:${m.user_id}`),
    );

    const liveGoals = (goals ?? []).filter((goal) =>
      activeMembers.has(`${goal.circle_id}:${goal.user_id}`),
    );

    let inserted = 0;
    // Deliberately no early-return when goals is empty (there used to be
    // one) - the health-snapshot pass below needs to run every day
    // regardless of whether any goal happens to be at risk that day, or
    // the weekly scorecard's history would have gaps.
    if (liveGoals.length > 0) {
      const { data: todaysReminders } = await supabase
        .from('events')
        .select('payload')
        .eq('type', 'reminder')
        .gte('created_at', `${isoDate(today)}T00:00:00Z`);
      const alreadyNotifiedGoalIds = new Set(
        (todaysReminders ?? [])
          .map((e) => (e.payload as Record<string, unknown>)?.goal_id as string | undefined)
          .filter(Boolean),
      );

      for (const goal of liveGoals) {
        if (alreadyNotifiedGoalIds.has(goal.id)) continue;
        const { error: insertError } = await supabase.from('events').insert({
          circle_id: goal.circle_id,
          user_id: goal.user_id,
          type: 'reminder',
          payload: {
            goal_id: goal.id,
            message: `Your ${goal.streak_count}-day streak on "${goal.title}" is at risk - log progress today!`,
          },
        });
        if (!insertError) inserted++;
      }
    }

    // Snapshot every active circle's Garden health - same formula as
    // useGardenState client-side (a member counts as "active" if they
    // logged something within the last 3 days), duplicated here since this
    // Edge Function has no access to that client hook.
    const { data: circles } = await supabase.from('circles').select('id').is('deleted_at', null);
    let snapshotted = 0;
    for (const circle of circles ?? []) {
      const { data: members } = await supabase
        .from('circle_members')
        .select('user_id')
        .eq('circle_id', circle.id)
        .eq('status', 'active')
        // Departed members would otherwise inflate the denominator, so a
        // circle someone left could never reach 100% health again.
        .is('deleted_at', null);
      if (!members || members.length === 0) continue;

      const { data: circleGoals } = await supabase
        .from('goals')
        .select('user_id, last_logged_date')
        .eq('circle_id', circle.id)
        // A deleted goal must not keep a member counting as active.
        .is('deleted_at', null);

      const mostRecentByUser = new Map<string, string>();
      for (const g of circleGoals ?? []) {
        if (!g.last_logged_date) continue;
        const existing = mostRecentByUser.get(g.user_id as string);
        if (!existing || (g.last_logged_date as string) > existing) {
          mostRecentByUser.set(g.user_id as string, g.last_logged_date as string);
        }
      }

      const activeCount = members.filter((m) => {
        const mostRecent = mostRecentByUser.get(m.user_id as string);
        if (!mostRecent) return false;
        const daysSince = Math.floor((today.getTime() - new Date(mostRecent).getTime()) / 86_400_000);
        return daysSince <= 3;
      }).length;

      const health = Math.round((activeCount / members.length) * 100);
      const { error: snapshotError } = await supabase
        .from('circle_health_snapshots')
        .upsert(
          { circle_id: circle.id, health, snapshotted_at: isoDate(today) },
          { onConflict: 'circle_id,snapshotted_at' },
        );
      if (!snapshotError) snapshotted++;
    }

    return new Response(JSON.stringify({ checked: liveGoals.length, notified: inserted, snapshotted }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});
