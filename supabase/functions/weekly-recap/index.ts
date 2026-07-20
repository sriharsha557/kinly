// Writes one warm summary sentence for a circle's week, given stats the
// client already computed (the client's own RLS-scoped queries already
// produced the numbers, so this only needs to turn them into words).
// Deploy: Supabase Dashboard -> Edge Functions -> New function "weekly-recap"
// -> paste this file -> Deploy. Uses the same ANTHROPIC_API_KEY secret as
// generate-nudge-message (project-wide secrets are shared across functions).
// Keep "Enforce JWT verification" ON - increment_ai_usage() needs a real
// caller identity (auth.uid()) to cap per-user. useWeeklyRecap() already
// tolerates a failed/empty response (the highlight line just doesn't
// render), so a capped user still sees the numeric stats, nothing breaks.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Same reasoning as circle-ai-insight: fires on every Circle tab visit,
// not just a deliberate action, so the cap stays generous.
const DAILY_CAP = 20;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const callerClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: allowed, error: capError } = await callerClient.rpc('increment_ai_usage', {
      p_fn: 'weekly_recap',
      p_max: DAILY_CAP,
    });
    if (capError) throw capError;
    if (!allowed) throw new Error('Daily weekly-recap limit reached');

    const { goalsCompleted, streakMilestones, nudgesSent, asksPosted } = await req.json();
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const prompt = `Write ONE warm, encouraging sentence (under 25 words) summarizing a close friend group's week: ${goalsCompleted} goals completed, ${streakMilestones} streak milestones hit, ${nudgesSent} encouragement nudges sent to each other, ${asksPosted} questions asked for advice. No emojis, no quotes, no preamble - just the sentence. If all numbers are 0, gently encourage them to get started this week instead.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 60,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const highlight = data.content?.[0]?.text?.trim() ?? '';

    return new Response(JSON.stringify({ highlight }), {
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  }
});
