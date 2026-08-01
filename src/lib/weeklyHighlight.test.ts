import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklyHighlight, type WeeklyHighlightStats } from './weeklyHighlight.ts';

const QUIET: WeeklyHighlightStats = {
  goalsCompleted: 0,
  streakMilestones: 0,
  nudgesSent: 0,
  asksPosted: 0,
  bestStreak: 0,
  mostWateredFriendName: null,
  healthNow: 0,
  healthWeekAgo: null,
};

function week(overrides: Partial<WeeklyHighlightStats>): WeeklyHighlightStats {
  return { ...QUIET, ...overrides };
}

test('a week where nothing happened is not scolded', () => {
  const line = weeklyHighlight(QUIET);
  assert.equal(line, 'A quiet week. Next one is yours.');
});

test('a saved streak names the person and outranks everything else', () => {
  // Deliberately also a big-streak, high-volume, health-climbing week - the
  // one thing a person did for another person still wins.
  const line = weeklyHighlight(
    week({
      mostWateredFriendName: 'Priya',
      bestStreak: 30,
      goalsCompleted: 20,
      nudgesSent: 20,
      healthNow: 90,
      healthWeekAgo: 10,
    }),
  );
  assert.equal(line, "Someone had Priya's back this week - their streak survived.");
});

test('a long streak leads when nobody needed saving', () => {
  const line = weeklyHighlight(week({ bestStreak: 21, goalsCompleted: 20, nudgesSent: 20 }));
  assert.equal(line, 'A 21-day streak is carrying this circle.');
});

test('fourteen days is long enough to lead', () => {
  assert.equal(weeklyHighlight(week({ bestStreak: 14 })), 'A 14-day streak is carrying this circle.');
});

test('thirteen days is not', () => {
  assert.notEqual(
    weeklyHighlight(week({ bestStreak: 13, goalsCompleted: 6 })),
    'A 13-day streak is carrying this circle.',
  );
});

test('a climbing garden leads over goal volume', () => {
  const line = weeklyHighlight(week({ healthNow: 80, healthWeekAgo: 60, goalsCompleted: 9 }));
  assert.equal(line, 'Your garden is greener than it was last week.');
});

test('a small health change is not a story', () => {
  const line = weeklyHighlight(week({ healthNow: 62, healthWeekAgo: 60, goalsCompleted: 9 }));
  assert.equal(line, '9 goals finished. A strong week.');
});

test('no health history means no health claim', () => {
  // healthWeekAgo is null until circle_health_snapshots has a week of data.
  const line = weeklyHighlight(week({ healthNow: 95, healthWeekAgo: null, goalsCompleted: 9 }));
  assert.equal(line, '9 goals finished. A strong week.');
});

test('goal volume leads over support given', () => {
  assert.equal(weeklyHighlight(week({ goalsCompleted: 5, nudgesSent: 9 })), '5 goals finished. A strong week.');
});

test('support given leads when little was finished', () => {
  assert.equal(
    weeklyHighlight(week({ goalsCompleted: 1, nudgesSent: 6 })),
    'Plenty of encouragement went around this week.',
  );
});

test('a small amount of anything still gets a line', () => {
  assert.equal(weeklyHighlight(week({ goalsCompleted: 1 })), 'Something moved this week. That counts.');
  assert.equal(weeklyHighlight(week({ asksPosted: 1 })), 'Something moved this week. That counts.');
  assert.equal(weeklyHighlight(week({ streakMilestones: 1 })), 'Something moved this week. That counts.');
});

test('a null name can never reach the copy', () => {
  // The saved-streak branch is the only one that interpolates a name, and it
  // must not fire without one.
  const line = weeklyHighlight(week({ mostWateredFriendName: null, bestStreak: 30 }));
  assert.ok(!line.includes('null'));
  assert.ok(!line.includes('undefined'));
});

test('every branch returns a non-empty sentence', () => {
  const cases: Partial<WeeklyHighlightStats>[] = [
    {},
    { mostWateredFriendName: 'Sara' },
    { bestStreak: 40 },
    { healthNow: 90, healthWeekAgo: 50 },
    { goalsCompleted: 12 },
    { nudgesSent: 12 },
    { asksPosted: 1 },
  ];
  for (const c of cases) {
    const line = weeklyHighlight(week(c));
    assert.ok(line.length > 0, JSON.stringify(c));
  }
});

test('a dead week in a circle with health history is still called quiet', () => {
  // Guarding on "healthWeekAgo === null" instead of "health climbed" sent
  // this case past every branch and out the bottom as "Something moved this
  // week" - warm, and false.
  const line = weeklyHighlight(week({ healthNow: 40, healthWeekAgo: 45 }));
  assert.equal(line, 'A quiet week. Next one is yours.');
});
