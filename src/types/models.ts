export type InterestCategory = 'health' | 'wealth' | 'ideas' | 'learning' | 'relationships';

export interface User {
  id: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  interests: InterestCategory[] | null;
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

export interface Goal {
  id: string;
  user_id: string;
  circle_id: string;
  title: string;
  target: number;
  progress: number;
  streak_count: number;
  last_logged_date: string | null;
  category: InterestCategory | null;
}

export type EventType =
  | 'goal_completed'
  | 'streak'
  | 'reminder'
  | 'ask'
  | 'challenge_completed'
  | 'mood_checkin'
  | 'streak_saved';

export interface Event {
  id: string;
  circle_id: string;
  user_id: string;
  type: EventType;
  payload: Record<string, unknown>;
  created_at: string;
}

export type NudgeKind = 'cheer' | 'water' | 'walk' | 'workout' | 'keep_going' | 'streak';

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
