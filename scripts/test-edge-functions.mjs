// Smoke-tests every deployed Supabase Edge Function used by Kinly.
//
// Usage:
//   node --env-file=.env scripts/test-edge-functions.mjs
//   node --env-file=.env scripts/test-edge-functions.mjs --include-cron   (also exercises check-streaks-at-risk)
//
// Requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (same
// .env the app itself uses). Node 20.6+ for --env-file; this repo runs Node 22.
//
// check-streaks-at-risk is skipped by default: unlike the other four
// functions, it performs a real write (inserts 'reminder' events, which
// fan out to real push notifications) if any goal in your live database is
// genuinely at risk today. Pass --include-cron to run it anyway.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const INCLUDE_CRON = process.argv.includes('--include-cron');
const TIMEOUT_MS = 20_000;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  console.error('Run with: node --env-file=.env scripts/test-edge-functions.mjs');
  process.exit(1);
}

async function callFunction(slug, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${slug}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const ms = Date.now() - started;
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Some functions (notify-circle) return plain text, not JSON - fine.
    }
    return { ok: res.ok, status: res.status, ms, text, json };
  } catch (error) {
    const ms = Date.now() - started;
    const message = error.name === 'AbortError' ? `timed out after ${TIMEOUT_MS}ms` : error.message;
    return { ok: false, status: 0, ms, text: '', json: null, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

const results = [];

function report(name, passed, detail, ms) {
  results.push({ name, passed });
  const status = passed ? 'PASS' : 'FAIL';
  const timing = ms !== undefined ? ` (${ms}ms)` : '';
  console.log(`[${status}] ${name}${timing}`);
  if (detail) console.log(`       ${detail}`);
}

async function testGenerateNudgeMessage() {
  // Real deployed slug is "smooth-responder", not "generate-nudge-message" -
  // see src/lib/nudgeMessage.ts for why.
  const r = await callFunction('smooth-responder', {
    kind: 'cheer',
    recipientName: 'Test Friend',
    context: 'finishing a 5k run',
  });
  if (r.error) return report('generate-nudge-message (smooth-responder)', false, `Request failed: ${r.error}`, r.ms);
  if (!r.ok) return report('generate-nudge-message (smooth-responder)', false, `HTTP ${r.status}: ${r.text}`, r.ms);
  const message = r.json?.message;
  if (typeof message !== 'string' || message.length === 0) {
    return report('generate-nudge-message (smooth-responder)', false, `No message in response: ${r.text}`, r.ms);
  }
  report('generate-nudge-message (smooth-responder)', true, `"${message}"`, r.ms);
}

async function testCircleAIInsight() {
  const r = await callFunction('circle-ai-insight', {
    strongest: 'health',
    weakest: 'learning',
    categoryTotals: { health: 24, learning: 2 },
  });
  if (r.error) return report('circle-ai-insight', false, `Request failed: ${r.error}`, r.ms);
  if (!r.ok) return report('circle-ai-insight', false, `HTTP ${r.status}: ${r.text}`, r.ms);
  const message = r.json?.message;
  if (typeof message !== 'string' || message.length === 0) {
    return report('circle-ai-insight', false, `No message in response: ${r.text}`, r.ms);
  }
  report('circle-ai-insight', true, `"${message}" -> challenge: "${r.json?.suggestedChallenge}"`, r.ms);
}

async function testWeeklyRecap() {
  const r = await callFunction('weekly-recap', {
    goalsCompleted: 4,
    streakMilestones: 1,
    nudgesSent: 6,
    asksPosted: 2,
  });
  if (r.error) return report('weekly-recap', false, `Request failed: ${r.error}`, r.ms);
  if (!r.ok) return report('weekly-recap', false, `HTTP ${r.status}: ${r.text}`, r.ms);
  const highlight = r.json?.highlight;
  if (typeof highlight !== 'string' || highlight.length === 0) {
    return report('weekly-recap', false, `No highlight in response: ${r.text}`, r.ms);
  }
  report('weekly-recap', true, `"${highlight}"`, r.ms);
}

async function testNotifyCircle() {
  // notify-circle is a Database Webhook target, not something the client
  // calls directly with real data. Probing with an unrecognized table name
  // hits the function's "else { return ignored }" branch - zero DB writes,
  // zero push sends - while still proving the function is deployed and that
  // JWT verification is correctly OFF (called here with only the anon key,
  // no user session, exactly like a real Database Webhook call).
  const r = await callFunction('notify-circle', { table: '__edge_function_smoke_test__', record: {} });
  if (r.error) return report('notify-circle', false, `Request failed: ${r.error}`, r.ms);
  if (!r.ok) return report('notify-circle', false, `HTTP ${r.status}: ${r.text}`, r.ms);
  if (r.text.trim() !== 'ignored') {
    return report('notify-circle', false, `Expected "ignored" for an unknown table, got: ${r.text}`, r.ms);
  }
  report('notify-circle', true, 'Reachable, JWT verification correctly disabled, no side effects triggered', r.ms);
}

async function testCheckStreaksAtRisk() {
  if (!INCLUDE_CRON) {
    console.log('[SKIP] check-streaks-at-risk (writes real reminder events - pass --include-cron to run it)');
    return;
  }
  const r = await callFunction('check-streaks-at-risk', {});
  if (r.error) return report('check-streaks-at-risk', false, `Request failed: ${r.error}`, r.ms);
  if (!r.ok) return report('check-streaks-at-risk', false, `HTTP ${r.status}: ${r.text}`, r.ms);
  report('check-streaks-at-risk', true, `Response: ${r.text}`, r.ms);
}

console.log(`Testing Edge Functions against ${SUPABASE_URL}\n`);

await testGenerateNudgeMessage();
await testCircleAIInsight();
await testWeeklyRecap();
await testNotifyCircle();
await testCheckStreaksAtRisk();

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) {
  console.log(`Failed: ${failed.map((f) => f.name).join(', ')}`);
  process.exit(1);
}
