import { renderWithProviders } from '../test/renderWithProviders';
import { BuddyCard } from './BuddyCard';

// BuddyCard's whole job is to say one of three different things depending on a
// buddy's recent activity, and each branch is derived through three hooks and
// two pure modules before it reaches a single line of copy. That derivation is
// well covered by the logic suite; what was untested is whether the component
// wired to it renders the branch the derivation selected.
//
// Seeds are the raw rows those hooks fetch - buddy_pairs, circle_members,
// goals, goal_checkins - never the derived GardenState, because
// useGardenState builds that in a useMemo and only the rows are cached. Going
// in at the row level means these tests exercise the real derivation rather
// than a hand-written version of its output.

const CIRCLE_ID = 'circle-1';
const USER_ID = 'user-1';
const BUDDY_ID = 'buddy-1';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// A daily goal is the simplest cadence that produces a streak from consecutive
// dates, which is all these tests need from the showing-up model.
// `status: 'active'` is load-bearing, not decoration: useMemberActivity filters
// on it, so a goal row without it contributes nothing and the buddy reads as
// having done nothing at all. Omitting it here made this file's third test fail
// on its first run, which is the argument for seeding real row shapes rather
// than the derived summary - a hand-written summary cannot catch that.
const BUDDY_GOAL = {
  id: 'goal-1',
  circle_id: CIRCLE_ID,
  user_id: BUDDY_ID,
  title: 'Run every morning',
  status: 'active' as const,
  target_type: 'daily' as const,
  target_count: null,
  target_weekdays: null,
};

interface Seeds {
  buddy?: { buddy_id: string; buddy_name: string } | null;
  goals?: unknown[];
  checkins?: Record<string, string[]>;
}

function seedFor({ buddy = { buddy_id: BUDDY_ID, buddy_name: 'Priya' }, goals = [], checkins = {} }: Seeds = {}) {
  return [
    [['buddy', CIRCLE_ID, USER_ID], buddy] as [readonly unknown[], unknown],
    // The rows useGardenState actually caches. Both members are active, so the
    // garden derives a stage for each from the check-in ledger below.
    [
      ['garden-members', CIRCLE_ID],
      [
        { user_id: BUDDY_ID, profiles: { name: 'Priya' } },
        { user_id: USER_ID, profiles: { name: 'Me' } },
      ],
    ] as [readonly unknown[], unknown],
    [['goals', CIRCLE_ID], goals] as [readonly unknown[], unknown],
    [['goal-checkins', CIRCLE_ID], checkins] as [readonly unknown[], unknown],
  ];
}

describe('BuddyCard', () => {
  it('invites you to pick a buddy when you have none', async () => {
    const { getByText } = await renderWithProviders(
      <BuddyCard circleId={CIRCLE_ID} userId={USER_ID} />,
      { seedQueries: seedFor({ buddy: null }) },
    );

    getByText('Accountability Buddy');
    getByText('Pick a buddy to keep each other going.');
    getByText('Choose a buddy');
  });

  it('offers to check in when the buddy has gone quiet', async () => {
    // No goals and no check-ins, so the buddy's activity is EMPTY_ACTIVITY and
    // stageFor(0, null) wilts them - the branch that surfaces the check-in
    // prompt. This is also the state a brand-new circle is in, which is worth
    // knowing renders sanely rather than accusingly.
    const { getByText } = await renderWithProviders(
      <BuddyCard circleId={CIRCLE_ID} userId={USER_ID} />,
      { seedQueries: seedFor() },
    );

    getByText('Priya');
    getByText("Hasn't logged anything in a few days");
    getByText('Check in on Priya');
  });

  it('stays quiet and encouraging when the buddy checked in recently', async () => {
    // Three consecutive days ending today: recent enough to clear the >3 day
    // wilt threshold, so no check-in prompt and no water offer should appear.
    const { getByText, queryByText } = await renderWithProviders(
      <BuddyCard circleId={CIRCLE_ID} userId={USER_ID} />,
      {
        seedQueries: seedFor({
          goals: [BUDDY_GOAL],
          checkins: { [BUDDY_GOAL.id]: [isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(2)] },
        }),
      },
    );

    getByText('Active recently — keep it up together');
    // The absence assertions are the point of this case: a card that nags
    // someone whose buddy is doing fine is worse than one that says nothing.
    expect(queryByText('Check in on Priya')).toBeNull();
    expect(queryByText(/Water Priya's streak/)).toBeNull();
  });
});
