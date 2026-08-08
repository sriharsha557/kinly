import { renderWithProviders } from '../test/renderWithProviders';
import { CircleHealthCard } from './CircleHealthCard';

// This card is the first thing the Circle tab says about a group, before it
// asks anything of them, so its wording carries more weight than most. Two
// kinds of thing are worth holding here: that the health thresholds map to the
// right vocabulary, and that the copy stays humane at the edges - singular
// versus plural, and a good day never phrased as an absence.
//
// Health is not a prop. It is derived by useGardenState from the check-in
// ledger, so these tests seed rows and let the real thresholds run.

const CIRCLE_ID = 'circle-1';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function activeGoal(id: string, userId: string) {
  return {
    id,
    circle_id: CIRCLE_ID,
    user_id: userId,
    title: `Goal ${id}`,
    // status: 'active' matters - useMemberActivity filters on it, and without
    // it the member contributes no activity at all.
    status: 'active' as const,
    target_type: 'daily' as const,
    target_count: null,
    target_weekdays: null,
  };
}

// Three consecutive days ending today clears the >3-day wilt threshold and
// produces a streak of 3, so the member counts as both active and streaking.
const RECENT_CHECKINS = [isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(2)];

// `activeUserIds` are the members given recent check-ins; everyone else in
// `userIds` has no goals at all and so wilts. Health is the ratio between them,
// which is how each threshold below is reached.
function seedFor(userIds: string[], activeUserIds: string[] = []) {
  const goals = activeUserIds.map((id, i) => activeGoal(`goal-${i}`, id));
  const checkins = Object.fromEntries(goals.map((g) => [g.id, RECENT_CHECKINS]));
  return [
    [
      ['garden-members', CIRCLE_ID],
      userIds.map((id) => ({ user_id: id, profiles: { name: `Member ${id}` } })),
    ] as [readonly unknown[], unknown],
    [['goals', CIRCLE_ID], goals] as [readonly unknown[], unknown],
    [['goal-checkins', CIRCLE_ID], checkins] as [readonly unknown[], unknown],
  ];
}

describe('CircleHealthCard', () => {
  it('says "Just planted" for a circle where nobody has started yet', async () => {
    const { getByText } = await renderWithProviders(
      <CircleHealthCard circleId={CIRCLE_ID} needsSupportCount={0} checkedInToday={0} />,
      { seedQueries: seedFor(['a', 'b']) },
    );

    // A brand-new circle is at rest, not failing. "Just planted" rather than
    // the 1-39 band's "Needs care" is the difference, and health 0 is its own
    // band precisely so a new group is never accused of neglect.
    getByText('Just planted');
    getByText('0/2 checked in today');
  });

  it('says "Healthy" when half the circle is active', async () => {
    const { getByText } = await renderWithProviders(
      <CircleHealthCard circleId={CIRCLE_ID} needsSupportCount={0} checkedInToday={1} />,
      { seedQueries: seedFor(['a', 'b'], ['a']) },
    );

    getByText('Healthy');
    getByText('1/2 checked in today');
  });

  it('says "Thriving" when everyone is active', async () => {
    const { getByText } = await renderWithProviders(
      <CircleHealthCard circleId={CIRCLE_ID} needsSupportCount={0} checkedInToday={2} />,
      { seedQueries: seedFor(['a', 'b'], ['a', 'b']) },
    );

    getByText('Thriving');
    getByText('2/2 checked in today');
  });

  it('never phrases a good day as an absence', async () => {
    const { queryByText } = await renderWithProviders(
      <CircleHealthCard circleId={CIRCLE_ID} needsSupportCount={0} checkedInToday={2} />,
      { seedQueries: seedFor(['a', 'b'], ['a', 'b']) },
    );

    // The support line is omitted entirely at zero rather than rendered as
    // "0 need support". Asserting the absence is the only way to hold that -
    // a positive assertion elsewhere would still pass if this regressed.
    expect(queryByText(/need support/)).toBeNull();
    expect(queryByText(/0 people/)).toBeNull();
  });

  it('counts one streak and one person in the singular', async () => {
    const { getByText } = await renderWithProviders(
      <CircleHealthCard circleId={CIRCLE_ID} needsSupportCount={1} checkedInToday={1} />,
      { seedQueries: seedFor(['a', 'b'], ['a']) },
    );

    getByText('1 active streak');
    getByText('1 person needs support');
  });

  it('counts several streaks and people in the plural', async () => {
    const { getByText } = await renderWithProviders(
      <CircleHealthCard circleId={CIRCLE_ID} needsSupportCount={2} checkedInToday={2} />,
      { seedQueries: seedFor(['a', 'b', 'c'], ['a', 'b']) },
    );

    getByText('2 active streaks');
    getByText('2 people need support');
  });
});
