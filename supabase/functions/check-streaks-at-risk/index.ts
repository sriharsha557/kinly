// Runs on a daily schedule (see migration 0016's pg_cron job) to find goals
// whose streak breaks if not logged today, and insert a 'reminder' event for
// each - which then flows through the existing events INSERT Database
// Webhook to notify-circle automatically, so no separate push logic is
// needed here.
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

    const { data: goals, error } = await supabase
      .from('goals')
      .select('id, user_id, circle_id, title, streak_count')
      .eq('last_logged_date', isoDate(yesterday))
      .gt('streak_count', 0);
    if (error) throw error;
    if (!goals || goals.length === 0) return new Response('no goals at risk');

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

    let inserted = 0;
    for (const goal of goals) {
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

    return new Response(JSON.stringify({ checked: goals.length, notified: inserted }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});
