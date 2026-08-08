import { renderWithProviders } from '../test/renderWithProviders';
import { CircleMembersSection } from './CircleMembersSection';

// This section replaced the garden's row of 56dp plants that you had to
// discover were tappable, so what matters is that every member reads as a
// labelled row with a visible action - and that the two rules about *whose* row
// it is hold: you appear as "You", and you are never offered a Cheer button
// aimed at yourself.

const CIRCLE_ID = 'circle-1';
const USER_ID = 'user-1';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Mirrors the private todayIso() in useMoodCheckins - that hook's query key is
// day-stamped, so a seed under any other date silently never matches and the
// mood half of the detail line goes missing for reasons a reader cannot see.
const TODAY = new Date().toISOString().slice(0, 10);

function activeGoal(id: string, userId: string) {
  return {
    id,
    circle_id: CIRCLE_ID,
    user_id: userId,
    title: `Goal ${id}`,
    status: 'active' as const,
    target_type: 'daily' as const,
    target_count: null,
    target_weekdays: null,
  };
}

interface Seeds {
  members?: { id: string; name: string }[];
  streakingIds?: string[];
  moods?: { user_id: string; mood: string }[];
}

function seedFor({
  members = [
    { id: USER_ID, name: 'Me' },
    { id: 'user-2', name: 'Priya' },
  ],
  streakingIds = [],
  moods = [],
}: Seeds = {}) {
  const goals = streakingIds.map((id, i) => activeGoal(`goal-${i}`, id));
  const checkins = Object.fromEntries(
    goals.map((g) => [g.id, [isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(2)]]),
  );
  return [
    [
      ['garden-members', CIRCLE_ID],
      members.map((m) => ({ user_id: m.id, profiles: { name: m.name } })),
    ] as [readonly unknown[], unknown],
    [['goals', CIRCLE_ID], goals] as [readonly unknown[], unknown],
    [['goal-checkins', CIRCLE_ID], checkins] as [readonly unknown[], unknown],
    [
      ['moodCheckins', CIRCLE_ID, TODAY],
      moods.map((m) => ({ ...m, tags: [], profiles: null })),
    ] as [readonly unknown[], unknown],
  ];
}

describe('CircleMembersSection', () => {
  it('names you "You" and offers no Cheer button aimed at yourself', async () => {
    const { getByText, getAllByText } = await renderWithProviders(
      <CircleMembersSection circleId={CIRCLE_ID} userId={USER_ID} excludeUserIds={[]} />,
      { seedQueries: seedFor() },
    );

    getByText('You');
    getByText('Priya');
    // Exactly one Cheer, on Priya's row. Cheering yourself would send a real
    // push to your own device, so the count is the assertion.
    expect(getAllByText('Cheer')).toHaveLength(1);
  });

  it('says "no streak yet" rather than a zero', async () => {
    const { getAllByText } = await renderWithProviders(
      <CircleMembersSection circleId={CIRCLE_ID} userId={USER_ID} excludeUserIds={[]} />,
      { seedQueries: seedFor() },
    );

    // Both members are new. "no streak yet" is forward-looking where "0-streak"
    // would read as a score, and both rows should say it.
    expect(getAllByText('no streak yet')).toHaveLength(2);
  });

  it('shows a streak without a unit, and the mood beside it', async () => {
    const { getByText } = await renderWithProviders(
      <CircleMembersSection circleId={CIRCLE_ID} userId={USER_ID} excludeUserIds={[]} />,
      {
        seedQueries: seedFor({
          streakingIds: ['user-2'],
          moods: [{ user_id: 'user-2', mood: 'tough' }],
        }),
      },
    );

    // "3-streak", not "3-day streak": a streak is counted in each goal's own
    // cadence periods, so a day unit is simply false for a weekly commitment.
    getByText('3-streak · Tough');
  });

  it('leaves out members already shown in Circle Today', async () => {
    const { getByText, queryByText } = await renderWithProviders(
      <CircleMembersSection circleId={CIRCLE_ID} userId={USER_ID} excludeUserIds={['user-2']} />,
      { seedQueries: seedFor() },
    );

    getByText('You');
    // Priya is excluded because she appears higher up the screen; showing her
    // twice is what made this tab read as a second dashboard.
    expect(queryByText('Priya')).toBeNull();
  });

  it('renders nothing at all when every member is shown elsewhere', async () => {
    const { toJSON } = await renderWithProviders(
      <CircleMembersSection circleId={CIRCLE_ID} userId={USER_ID} excludeUserIds={[USER_ID, 'user-2']} />,
      { seedQueries: seedFor() },
    );

    // Not an empty-state message: a "Members" heading over nothing is worse
    // than no section, so the component returns null.
    expect(toJSON()).toBeNull();
  });
});
