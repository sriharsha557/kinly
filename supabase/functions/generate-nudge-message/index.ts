// Generates a short, warm, personalized nudge message via the Claude API.
// Deploy: paste into Supabase Dashboard -> Edge Functions -> New function
// (name it "generate-nudge-message"), or `supabase functions deploy generate-nudge-message`.
// Requires an ANTHROPIC_API_KEY secret set on the project (never shipped to the client).
// Keep "Enforce JWT verification" ON - increment_ai_usage() needs a real
// caller identity (auth.uid()) to cap per-user, same reasoning as
// delete-account. If this returns an error, generateNudgeMessage() in the
// client already falls back to a canned FALLBACK_MESSAGES string, so a
// capped user still gets a nudge sent, just not an AI-personalized one.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Nudges are meant to be spontaneous and frequent, so this is generous -
// it's a backstop against spam/bugs, not a normal-use limit.
const DAILY_CAP = 30;

const KIND_HINTS: Record<string, string> = {
  cheer: 'celebrating something they just did',
  water: 'reminding them to drink water',
  walk: 'encouraging them to go for a walk',
  workout: 'encouraging them to get their workout in',
  keep_going: 'encouraging them to keep going on their goal',
  streak: "cheering their streak so they don't break it",
};

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
      p_fn: 'nudge',
      p_max: DAILY_CAP,
    });
    if (capError) throw capError;
    if (!allowed) throw new Error('Daily nudge limit reached');

    const { kind, recipientName, context } = await req.json();
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const hint = KIND_HINTS[kind] ?? 'encouraging them';
    const prompt = `Write ONE short text message (under 18 words) from a close friend to ${recipientName}, ${hint}${
      context ? ` about: ${context}` : ''
    }. Warm, casual, specific, no emojis, no quotes, no preamble - just the message itself.`;

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
    const message = data.content?.[0]?.text?.trim() ?? '';

    return new Response(JSON.stringify({ message }), {
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  }
});
