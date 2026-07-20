// Writes one coaching sentence + a themed 7-day challenge title, given the
// circle's per-category streak totals the client already computed.
// Deploy: Supabase Dashboard -> Edge Functions -> New function
// "circle-ai-insight" -> paste this file -> Deploy.
// Keep "Enforce JWT verification" ON - increment_ai_usage() needs a real
// caller identity (auth.uid()) to cap per-user. useCircleAI() already
// tolerates a failed/empty response (CircleAICard just doesn't render),
// so a capped user simply doesn't see today's AI line, nothing breaks.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This fires on every Circle tab visit (a query, not a deliberate user
// action), so the cap needs to be generous enough not to bite normal use
// across a day of reopening the app, while still stopping runaway loops.
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
      p_fn: 'circle_insight',
      p_max: DAILY_CAP,
    });
    if (capError) throw capError;
    if (!allowed) throw new Error('Daily AI insight limit reached');

    const { strongest, weakest, categoryTotals } = await req.json();
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const prompt = `A close friend group's goal categories and total streak-days: ${JSON.stringify(
      categoryTotals,
    )}. They're strongest at "${strongest}" and weakest at "${weakest}". Reply with exactly two lines, nothing else:
Line 1: ONE encouraging coaching sentence (under 22 words) noting their strength and gently nudging them on the weak area, warm and non-judgmental, no emojis, no quotes.
Line 2: a short catchy 7-day challenge title for the weak category (under 7 words), no emojis, no quotes, no "Line 2:" prefix.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const text: string = data.content?.[0]?.text?.trim() ?? '';
    const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const message = lines[0] ?? '';
    const suggestedChallenge = lines[1] ?? null;

    return new Response(JSON.stringify({ message, suggestedChallenge }), {
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  }
});
