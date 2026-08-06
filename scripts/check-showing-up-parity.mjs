// Runs the shared fixture table (src/lib/showingUp.fixtures.json) against
// the SQL showing_up_at() function by calling it directly with each
// fixture's cadence, check-ins, and pinned `today`, then comparing its
// answer to the fixture's expected value.
//
// This does NOT cover the goal_showing_up VIEW itself: it never creates a
// goal or check-in rows, and never queries the view. In particular, the
// view's `status = 'active' and deleted_at is null` filter and its
// `array_agg` subquery (which returns NULL, not an empty array, for a goal
// with no check-ins) are unverified by this script.
//
// Usage: node scripts/check-showing-up-parity.mjs            (linked project)
//        PARITY_TARGET=local node scripts/check-showing-up-parity.mjs
//
// Defaults to --linked, because this repo has no local Postgres: migrations
// are applied by hand through the Supabase Dashboard, so the only database
// that actually has showing_up_at() on it is the linked project. Requires
// `npx supabase link` once. Set PARITY_TARGET=local to run against a local
// stack instead (npx supabase start), if one ever exists.
//
// This script has never actually been executed against a database in this
// environment (no Docker, no Postgres available here) - treat a first real
// run as unverified, not as a rerun of something already proven to work.
//
// Coverage note: streak() and consistency() (src/lib/showingUp.ts) have NO
// SQL counterpart anywhere in this repo and are NOT covered by this parity
// check - showing_up_at() only restates isShowingUp(). The fixture table's
// `expected` is a single boolean and only ever drives that one comparison;
// binding streak()/consistency() the same way would need a richer `expected`
// shape (a number, or a {done, of} pair) than this table has today. Anyone
// who needs a streak computed server-side (check-streaks-at-risk is a Deno
// function and cannot import src/lib) will otherwise write a third,
// unverified implementation with nothing tying it back to the other two.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const fixtures = JSON.parse(readFileSync(new URL('../src/lib/showingUp.fixtures.json', import.meta.url), 'utf8'));

// shell: false (the default - no `shell` option passed at all): with
// shell: true, Node joins the argv array into a single command string
// WITHOUT quoting any element. `statement` is multi-line, full of spaces and
// parentheses, and would be word-split before the CLI ever saw it - the
// callee would receive `with` as its first argument, and POSIX sh would
// additionally choke on the unquoted `(`. Passing argv as a real array with
// no shell keeps the SQL intact as one argument on every platform.
//
// Windows still needs special handling: npx resolves to npx.cmd, and
// execFileSync refuses to run a .cmd file directly without a shell. `cmd /c`
// supplies that shell just for locating/launching npx.cmd, while the SQL
// argument itself is still passed as one untouched array element - it is
// never re-joined into a string, so it survives.
const TARGET = process.env.PARITY_TARGET === 'local' ? '--local' : '--linked';

function sql(statement) {
  const args = ['supabase', 'db', 'query', TARGET, statement];
  if (process.platform === 'win32') {
    return execFileSync('cmd', ['/c', 'npx', ...args], { encoding: 'utf8' });
  }
  return execFileSync('npx', args, { encoding: 'utf8' });
}

let failures = 0;
for (const fixture of fixtures) {
  const weekdays = fixture.target_weekdays ? `'{${fixture.target_weekdays.join(',')}}'::int[]` : 'null';
  const checkins = fixture.checkins.map((d) => `('${d}'::date)`).join(',') || null;
  // current_date is pinned per case by evaluating the same expressions the
  // view uses against the fixture's `today` rather than the wall clock.
  // The result is rendered as an unambiguous sentinel string rather than a
  // bare boolean: `t`/`f`/psql-table output/JSON output all differ, and a
  // regex over any one of those formats can silently read NULL, an error,
  // or a reformatted true/false as `false` - exactly the failure the
  // coalesce() calls in the SQL exist to prevent.
  // Collapsed to a single line, no leading/trailing whitespace: on Windows
  // the SQL travels through `cmd /c`, which re-tokenizes its whole command
  // line rather than treating each argv element as atomic - an embedded
  // newline there would be read as pressing Enter, splitting the statement
  // into two commands mid-query.
  const query = (
    `with cadence as ( ` +
    `select '${fixture.target_type}'::text as target_type, ` +
    `${fixture.target_count ?? 'null'}::int as target_count, ` +
    `${weekdays} as target_weekdays, ` +
    `'${fixture.today}'::date as today ` +
    `), ` +
    `c(checkin_date) as (${checkins ? `values ${checkins}` : 'select null::date where false'}) ` +
    `select case when showing_up_at( ` +
    `(select target_type from cadence), ` +
    `(select target_count from cadence), ` +
    `(select target_weekdays from cadence), ` +
    `(select array_agg(checkin_date) from c), ` +
    `(select today from cadence) ` +
    `) then 'PARITY_TRUE' else 'PARITY_FALSE' end as r;`
  );
  const output = sql(query);
  const isTrue = output.includes('PARITY_TRUE');
  const isFalse = output.includes('PARITY_FALSE');
  if (isTrue === isFalse) {
    // Neither sentinel appeared (both false) or somehow both did (impossible
    // for a single case-expression, but treated the same either way): the
    // output is not a parseable answer, so fail loudly rather than guessing.
    throw new Error(`Unparseable SQL result for ${fixture.name}:\n${output}`);
  }
  const got = isTrue;
  if (got !== fixture.expected) {
    console.error(`PARITY FAIL: ${fixture.name} — SQL said ${got}, expected ${fixture.expected}`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`\n${failures} parity failure(s): showingUp.ts and goal_showing_up disagree.`);
  process.exit(1);
}
console.log(`All ${fixtures.length} fixtures agree between TypeScript and SQL.`);
