// Generates a short, warm, personalized nudge message via the Claude API.
// Deploy: paste into Supabase Dashboard -> Edge Functions -> New function
// (name it "generate-nudge-message"), or `supabase functions deploy generate-nudge-message`.
// Requires an ANTHROPIC_API_KEY secret set on the project (never shipped to the client).

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
