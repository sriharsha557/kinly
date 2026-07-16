import { supabase } from './supabase';
import type { NudgeKind } from '../types/models';

const FALLBACK_MESSAGES: Record<NudgeKind, string> = {
  cheer: 'Nice work — proud of you!',
  water: "Don't forget to drink some water!",
  walk: 'Go stretch your legs, you got this!',
  workout: "Let's get that workout in!",
  keep_going: "You're doing great, keep going!",
  streak: "Don't break the streak now!",
};

export async function generateNudgeMessage(
  kind: NudgeKind,
  recipientName: string,
  context?: string,
): Promise<string> {
  try {
    // Supabase Edge Function slug is fixed at creation as "smooth-responder";
    // the dashboard display name was changed to "generate-nudge-message" but
    // the invocable route did not follow, so this must match the real slug.
    const { data, error } = await supabase.functions.invoke('smooth-responder', {
      body: { kind, recipientName, context },
    });
    if (error || !data?.message) throw error ?? new Error('empty response');
    return data.message as string;
  } catch {
    return FALLBACK_MESSAGES[kind];
  }
}
