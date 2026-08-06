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
// Usage: node scripts/check-showing-up-parity.mjs
// Requires a running local Supabase (npx supabase start).

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const fixtures = JSON.parse(readFileSync(new URL('../src/lib/showingUp.fixtures.json', import.meta.url), 'utf8'));

function sql(statement) {
  // shell: true is required on Windows: npx resolves to npx.cmd, and
  // execFileSync will not run a .cmd file without a shell.
  return execFileSync('npx', ['supabase', 'db', 'query', '--local', statement], {
    encoding: 'utf8',
    shell: true,
  });
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
  const query = `
    with cadence as (
      select '${fixture.target_type}'::text as target_type,
             ${fixture.target_count ?? 'null'}::int as target_count,
             ${weekdays} as target_weekdays,
             '${fixture.today}'::date as today
    ),
    c(checkin_date) as (${checkins ? `values ${checkins}` : 'select null::date where false'})
    select case when showing_up_at(
      (select target_type from cadence),
      (select target_count from cadence),
      (select target_weekdays from cadence),
      (select array_agg(checkin_date) from c),
      (select today from cadence)
    ) then 'PARITY_TRUE' else 'PARITY_FALSE' end as r;`;
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
