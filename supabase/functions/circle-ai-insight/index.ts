// Writes one coaching sentence + a themed 7-day challenge title, given the
// circle's per-category streak totals the client already computed. No DB
// access here, same shape as generate-nudge-message and weekly-recap.
// Deploy: Supabase Dashboard -> Edge Functions -> New function
// "circle-ai-insight" -> paste this file -> Deploy.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
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
