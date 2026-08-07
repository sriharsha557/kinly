// One sentence about a circle's week, assembled from numbers the client has
// already computed (docs/superpowers/specs/2026-08-01-remove-remaining-ai-
// design.md). Replaces a Claude API call that received these same numbers and
// returned only wording.
//
// The ORDER is the design. Several of these are usually true at once, and the
// order decides which true thing is worth saying. A saved streak comes second
// - above longer streaks, above volume - because it is the only line that
// names one person doing something for another, which is what the app is for.
// The empty week comes first and does not scold: MoodCheckinCard's no-shame
// rule applies to what the app says about a whole circle too.
//
// Dependency-free so node:test can import it under --experimental-strip-types.

export interface WeeklyHighlightStats {
  goalsCompleted: number;
  streakMilestones: number;
  nudgesSent: number;
  asksPosted: number;
  bestStreak: number;
  mostWateredFriendName: string | null;
  healthNow: number;
  healthWeekAgo: number | null;
}

const LONG_STREAK = 14;
const HEALTH_CLIMB = 15;
const STRONG_WEEK_GOALS = 5;
const LOTS_OF_SUPPORT = 5;

export function weeklyHighlight(stats: WeeklyHighlightStats): string {
  const {
    goalsCompleted,
    streakMilestones,
    nudgesSent,
    asksPosted,
    bestStreak,
    mostWateredFriendName,
    healthNow,
    healthWeekAgo,
  } = stats;

  // Every signal, not just the four counters: a lone bestStreak, name, or
  // health delta is still something, and must not be swallowed by the quiet
  // fallback before its own branch gets a chance to fire.
  // Health can climb in a week with no completions at all: it tracks how
  // recently people logged anything, while goalsCompleted counts only
  // finished goals. So a week of steady progress without a single completion
  // is a real week, and computing this once lets the quiet-week guard below
  // and the branch further down agree about that.
  const healthClimbed = healthWeekAgo !== null && healthNow - healthWeekAgo >= HEALTH_CLIMB;

  // Every signal absent - not merely "no health history". Testing
  // healthWeekAgo === null here instead would drop a genuinely dead week in
  // a circle that HAS history past every branch and out the bottom as
  // "Something moved this week", which is exactly the kind of warm-sounding
  // falsehood this whole module exists to make impossible.
  const nothingHappened =
    goalsCompleted === 0 &&
    streakMilestones === 0 &&
    nudgesSent === 0 &&
    asksPosted === 0 &&
    bestStreak === 0 &&
    mostWateredFriendName === null &&
    !healthClimbed;
  if (nothingHappened) return 'A quiet week. Next one is yours.';

  // Guarded on the name itself, not on a separate count - this is the only
  // branch that interpolates one, and a null here would render "null's back".
  if (mostWateredFriendName) {
    // "their", not "her": we know a name, never a pronoun.
    return `Someone had ${mostWateredFriendName}'s back this week - their streak survived.`;
  }

  // No unit: bestStreak is counted in each goal's own periods now - days
  // for a daily commitment, weeks for a 4x/week one - so naming one would be
  // false for whichever member's streak is actually the longest.
  if (bestStreak >= LONG_STREAK) return `A ${bestStreak}-streak is carrying this circle.`;

  if (healthClimbed) {
    return 'Your garden is greener than it was last week.';
  }

  if (goalsCompleted >= STRONG_WEEK_GOALS) return `${goalsCompleted} goals finished. A strong week.`;

  if (nudgesSent >= LOTS_OF_SUPPORT) return 'Plenty of encouragement went around this week.';

  return 'Something moved this week. That counts.';
}
