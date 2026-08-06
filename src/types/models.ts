import type { AccentId, ThemeMode } from '../theme/colors';
import type { TargetType } from '../lib/showingUp';

export type { TargetType };

export type InterestCategory = 'health' | 'wealth' | 'ideas' | 'learning' | 'relationships';

// A goal can be tagged with something the five pillars don't cover; an
// *interest* can't. "What are you interested in?" has no sensible "Other"
// answer, and the onboarding picker, the suggestion catalogue and Circle
// Ideas' copy are all built around the five. So the widening lives here,
// on goals alone, rather than in InterestCategory.
//
// goals.category is a plain text column with no check constraint (migration
// 0012), so this needs no migration - the constraint was only ever in
// TypeScript.
export type GoalCategory = InterestCategory | 'misc';

export interface User {
  id: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  interests: InterestCategory[] | null;
  // null = never chose (same "never asked" marker pattern as interests) -
  // the app then falls back to ember/system without writing anything.
  theme_accent: AccentId | null;
  theme_mode: ThemeMode | null;
  created_at: string;
}

export interface Circle {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  member_ids: string[];
}

export type CircleRole = 'owner' | 'admin' | 'member';
export type CircleMemberStatus = 'pending' | 'active';

export interface CircleMember {
  circle_id: string;
  user_id: string;
  role: CircleRole;
  status: CircleMemberStatus;
}

export type GoalSource = 'manual' | 'health_steps';

export type AreaKey =
  | 'health' | 'mind' | 'learning' | 'finance'
  | 'career' | 'family' | 'creativity' | 'community';

export interface Area {
  id: string;
  key: AreaKey;
  label: string;
  emoji: string;
  sort_order: number;
}

export interface CircleArea {
  circle_id: string;
  area_id: string;
  enabled: boolean;
  created_at: string;
}

export type GoalStatus = 'active' | 'ended';
export type EndedReason = 'replaced' | 'migration' | 'deleted' | 'completed';

// 'habit' is the only member today (0046). Challenges, reading plans,
// savings plans and training plans are all commitments and are the intended
// future members of this union, sharing the goals table rather than each
// inventing a parallel one - see 0046's comment on the `kind` column.
export type GoalKind = 'habit';

export interface GoalCheckin {
  id: string;
  goal_id: string;
  user_id: string;
  checkin_date: string;
  created_at: string;
}

export interface GoalHistoryEntry {
  id: string;
  goal_id: string | null;
  circle_id: string;
  user_id: string;
  area_id: string | null;
  title: string;
  target_type: TargetType | null;
  target_count: number | null;
  target_weekdays: number[] | null;
  started_at: string | null;
  ended_at: string;
  best_streak: number;
  ended_reason: EndedReason;
  needs_review: boolean;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  circle_id: string;
  title: string;
  // Nullable since migration 0049: manual commitments have no numeric
  // target, only a cadence. Still set for goal_source = 'health_steps'.
  target: number | null;
  progress: number;
  streak_count: number;
  last_logged_date: string | null;
  category: GoalCategory | null;
  goal_source: GoalSource;
  last_synced_date: string | null;
  area_id: string | null;
  target_type: TargetType | null;
  target_count: number | null;
  target_weekdays: number[] | null;
  status: GoalStatus;
  started_at: string;
  ended_at: string | null;
  ended_reason: EndedReason | null;
  kind: GoalKind;
}

export type EventType =
  | 'goal_completed'
  | 'streak'
  | 'reminder'
  | 'ask'
  | 'challenge_completed'
  | 'mood_checkin'
  | 'streak_saved'
  | 'progress_photo'
  // Moments vocabulary added by migration 0039. All four are feed-only -
  // none of them pushes (docs/superpowers/specs/2026-07-31-notifications-
  // design.md). achievement_unlocked has no emitter yet, by design: every
  // achievement the app creates already emits one of the types above.
  | 'goal_started'
  | 'achievement_unlocked'
  | 'garden_grew'
  | 'buddy_checkin';

export interface Event {
  id: string;
  circle_id: string;
  user_id: string;
  type: EventType;
  payload: Record<string, unknown>;
  created_at: string;
}

// 'support' is for a tough-day check-in, added alongside migration 0044. It
// exists so someone who has just said today was hard is not sent the same
// copy as someone being told to keep going on a goal.
export type NudgeKind = 'cheer' | 'water' | 'walk' | 'workout' | 'keep_going' | 'streak' | 'support';

export type MoodValue = 'great' | 'okay' | 'tough';

export interface MoodCheckin {
  id: string;
  user_id: string;
  circle_id: string;
  mood: MoodValue;
  checkin_date: string;
}

export interface Nudge {
  id: string;
  event_id: string;
  from_user_id: string;
  kind: NudgeKind;
  message: string | null;
  created_at: string;
}

export interface AskPost {
  id: string;
  circle_id: string;
  user_id: string;
  question: string;
  reply_count: number;
  goal_id: string | null;
  created_at: string;
}

export interface AskReply {
  id: string;
  ask_post_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  circle_id: string;
  type: string;
  title: string;
  achieved_at: string;
}

export interface Challenge {
  id: string;
  circle_id: string;
  title: string;
  target: number;
  created_by: string;
  created_at: string;
}

export interface ChallengeLog {
  id: string;
  challenge_id: string;
  user_id: string;
  amount: number;
  created_at: string;
}

export interface FutureLetter {
  id: string;
  user_id: string;
  content: string;
  unlock_date: string;
  created_at: string;
  opened_at: string | null;
}

export interface VisionItem {
  id: string;
  user_id: string;
  circle_id: string;
  title: string;
  image_url: string | null;
  created_at: string;
}

export type RsvpStatus = 'yes' | 'no' | 'maybe';

export interface Meetup {
  id: string;
  circle_id: string;
  created_by: string;
  title: string;
  note: string | null;
  proposed_date: string | null;
  created_at: string;
}

export interface MeetupRsvp {
  meetup_id: string;
  user_id: string;
  status: RsvpStatus;
  responded_at: string;
}

export interface CircleCardAnswer {
  id: string;
  circle_id: string;
  user_id: string;
  prompt_date: string;
  prompt_text: string;
  answer: string;
  created_at: string;
}

export interface Story {
  id: string;
  circle_id: string;
  prompt: string;
  created_by: string;
  completed: boolean;
  created_at: string;
}

export interface StoryLine {
  id: string;
  story_id: string;
  user_id: string;
  text: string;
  created_at: string;
}

export interface WouldYouRatherPoll {
  id: string;
  circle_id: string;
  option_a: string;
  option_b: string;
  created_by: string;
  created_at: string;
}

export type WouldYouRatherChoice = 'a' | 'b';

export interface WouldYouRatherVote {
  poll_id: string;
  user_id: string;
  choice: WouldYouRatherChoice;
  created_at: string;
}

export interface GuessWhoPost {
  id: string;
  circle_id: string;
  fact: string;
  answer_user_id: string;
  created_by: string;
  created_at: string;
}

export interface GuessWhoGuess {
  post_id: string;
  user_id: string;
  guessed_user_id: string;
  created_at: string;
}
