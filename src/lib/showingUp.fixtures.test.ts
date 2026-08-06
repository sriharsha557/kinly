import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Explicit node:url import: React Native's ambient globals (react-native/src/types/globals.d.ts)
// declare their own `URL` interface that collides with the one fs.readFileSync expects,
// so the bare global `URL` fails tsc here even though it runs fine under node.
import { URL } from 'node:url';
import { isShowingUp, type Cadence } from './showingUp.ts';

// The same table runs against the SQL view via
// scripts/check-showing-up-parity.mjs. One rule in two languages is a drift
// risk; this file and that script are what turn drift into a failing test
// rather than a digest that quietly lies to people.
interface Fixture extends Cadence {
  name: string;
  checkins: string[];
  today: string;
  expected: boolean;
}

const fixtures: Fixture[] = JSON.parse(
  readFileSync(new URL('./showingUp.fixtures.json', import.meta.url), 'utf8'),
);

for (const fixture of fixtures) {
  test(`fixture: ${fixture.name}`, () => {
    const [y, m, d] = fixture.today.split('-').map(Number);
    const now = new Date(y, m - 1, d, 12).getTime();
    assert.equal(isShowingUp(fixture, fixture.checkins, now), fixture.expected);
  });
}
