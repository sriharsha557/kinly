export interface User {
  id: string;
  name: string;
  avatar: string | null;
  created_at: string;
}

export interface Circle {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  member_ids: string[];
}

export interface Goal {
  id: string;
  user_id: string;
  circle_id: string;
  title: string;
  target: number;
  progress: number;
  streak_count: number;
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

export type NudgeKind = 'cheer' | 'water' | 'walk' | 'workout' | 'streak';

export interface Nudge {
  id: string;
  event_id: string;
  from_user_id: string;
  kind: NudgeKind;
}

export interface AskPost {
  id: string;
  circle_id: string;
  user_id: string;
  question: string;
  reply_count: number;
}
