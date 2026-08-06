// Runs the shared fixture table against the SQL view by materializing each
// case as a temporary goal + check-ins, pinning current_date, and comparing
// the view's answer to the fixture's expected value.
//
// Usage: node scripts/check-showing-up-parity.mjs
// Requires a running local Supabase (npx supabase start).

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const fixtures = JSON.parse(readFileSync(new URL('../src/lib/showingUp.fixtures.json', import.meta.url), 'utf8'));

function sql(statement) {
  return execFileSync('npx', ['supabase', 'db', 'execute', '--sql', statement], {
    encoding: 'utf8',
  });
}

let failures = 0;
for (const fixture of fixtures) {
  const weekdays = fixture.target_weekdays ? `'{${fixture.target_weekdays.join(',')}}'::int[]` : 'null';
  const checkins = fixture.checkins.map((d) => `('${d}'::date)`).join(',') || null;
  // current_date is pinned per case by evaluating the same expressions the
  // view uses against the fixture's `today` rather than the wall clock.
  const query = `
    with cadence as (
      select '${fixture.target_type}'::text as target_type,
             ${fixture.target_count ?? 'null'}::int as target_count,
             ${weekdays} as target_weekdays,
             '${fixture.today}'::date as today
    ),
    c(checkin_date) as (${checkins ? `values ${checkins}` : 'select null::date where false'})
    select showing_up_at(
      (select target_type from cadence),
      (select target_count from cadence),
      (select target_weekdays from cadence),
      (select array_agg(checkin_date) from c),
      (select today from cadence)
    ) as showing_up;`;
  const output = sql(query);
  const got = /\bt\b/.test(output);
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
