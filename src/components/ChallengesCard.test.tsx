import { renderWithProviders } from '../test/renderWithProviders';
import { ChallengesCard } from './ChallengesCard';
import type { ChallengeWithProgress } from '../hooks/useChallenges';

// The first render tests in the codebase, and they exist because of a specific
// failure: on 2026-08-07 the Circle tab crashed to the error boundary with
// "Cannot read property 'length' of undefined" thrown inside this component.
// That bug typechecked cleanly and passed all 204 logic tests, because nothing
// in the suite rendered a component. These tests close that gap for the
// component that actually broke.

const CIRCLE_ID = 'circle-1';
const USER_ID = 'user-1';

function challenge(overrides: Partial<ChallengeWithProgress> = {}): ChallengeWithProgress {
  return {
    id: 'challenge-1',
    circle_id: CIRCLE_ID,
    title: '30-Day Water Challenge',
    target: 30,
    created_by: USER_ID,
    created_at: '2026-08-01T00:00:00.000Z',
    progress: 12,
    contributors: 2,
    contributions: [
      { user_id: USER_ID, name: 'You', amount: 8 },
      { user_id: 'user-2', name: 'Priya', amount: 4 },
    ],
    ...overrides,
  } as ChallengeWithProgress;
}

// Seeding the cache rather than mocking the hooks keeps the component's real
// data path intact - useChallenges' `enabled` and key are exercised, and a
// change to either breaks these tests, which is the point. The test
// QueryClient uses staleTime: Infinity so no queryFn runs and supabase is
// never reached.
function seedFor(challenges: unknown) {
  return [
    [['challenges', CIRCLE_ID], challenges] as [readonly unknown[], unknown],
    [['circle', CIRCLE_ID], { id: CIRCLE_ID, name: 'Test Circle' }] as [readonly unknown[], unknown],
  ];
}

describe('ChallengesCard', () => {
  it('renders a challenge with realistic data', async () => {
    const { getByText } = await renderWithProviders(
      <ChallengesCard circleId={CIRCLE_ID} userId={USER_ID} />,
      { seedQueries: seedFor([challenge()]) },
    );

    getByText('Circle Challenges');
    getByText('30-Day Water Challenge');
    // Both halves of this string name what they count - a fix for testers
    // reading a bare "12 / 30" as days, members or challenges by turns.
    getByText(/12 of 30 logged/);
    getByText(/2 members/);
  });

  it('renders the empty state when the circle has no challenges', async () => {
    const { getByText } = await renderWithProviders(
      <ChallengesCard circleId={CIRCLE_ID} userId={USER_ID} />,
      { seedQueries: seedFor([]) },
    );

    getByText(/No active challenges/);
  });

  it('names each contributor, using "You" for the current user', async () => {
    const { getByText } = await renderWithProviders(
      <ChallengesCard circleId={CIRCLE_ID} userId={USER_ID} />,
      { seedQueries: seedFor([challenge()]) },
    );

    // The progress bar is a circle total, so without names a member cannot
    // tell their own contribution from everyone else's.
    getByText('You 8  ·  Priya 4');
  });

  // THE REGRESSION TEST. This is the exact shape that crashed the app: a
  // challenge entry produced by a build predating commit c9b377d, rehydrated
  // from the persisted query cache into a component that reads
  // `challenge.contributions.length`. It has progress and contributors but no
  // contributions at all.
  //
  // Written as a cache seed rather than a prop because that is how it reached
  // the component in production - nothing re-derives a persisted entry on
  // rehydration, it is handed to the current build verbatim.
  it('survives a challenge cached by an older build, without a contributions field', async () => {
    const { contributions: _dropped, ...stale } = challenge();
    // Guard the guard: if a future refactor makes `contributions` non-optional
    // in a way that adds it back here, this test would silently stop testing
    // anything.
    expect('contributions' in stale).toBe(false);

    const { getByText } = await renderWithProviders(
      <ChallengesCard circleId={CIRCLE_ID} userId={USER_ID} />,
      { seedQueries: seedFor([stale]) },
    );

    // The card renders, and the contributor line is simply absent rather than
    // taking the whole app down to the error boundary.
    getByText('30-Day Water Challenge');
    getByText(/12 of 30 logged/);
  });
});
