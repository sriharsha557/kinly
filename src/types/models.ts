export type InterestCategory = 'health' | 'wealth' | 'ideas' | 'learning' | 'relationships';

export interface User {
  id: string;
  name: string;
  avatar: string | null;
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

export interface CircleMember {
  circle_id: string;
  user_id: string;
  role: CircleRole;
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
}

export type EventType = 'goal_completed' | 'streak' | 'reminder' | 'ask';

export interface Event {
  id: string;
  circle_id: string;
  user_id: string;
  type: EventType;
  payload: Record<string, unknown>;
  created_at: string;
}

export type NudgeKind = 'cheer' | 'water' | 'walk' | 'workout' | 'keep_going' | 'streak';

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
