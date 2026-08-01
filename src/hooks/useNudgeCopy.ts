import { useCallback } from 'react';
import { useNudgeMessages } from './useNudgeMessages';
import { pickNudgeMessage, type NudgeContext } from '../lib/nudgeMessages';

// Module-level rather than component state, deliberately: both call sites
// send nudges, and a shared memory means a cheer from the Circle tab and one
// from the Today feed cannot each independently repeat the same line. Reset
// on app restart, which is fine - a repeat across launches is not the one
// anybody notices.
const RECENT_LIMIT = 5;
let recentIds: string[] = [];

// Last-resort copy for the moment before the library has loaded, or if the
// query failed. One line, not a per-kind table: the old FALLBACK_MESSAGES
// map existed to paper over a rate-limited API, and there is no rate limit
// now - this only covers a cold cache on a slow connection.
const UNLOADED_FALLBACK = 'Thinking of you!';

export function useNudgeCopy() {
  const { messages } = useNudgeMessages();

  const nudgeCopy = useCallback(
    (kind: string, context: NudgeContext): string => {
      const picked = pickNudgeMessage(messages, kind, context, recentIds, Math.random());
      if (!picked) return UNLOADED_FALLBACK;
      recentIds = [picked.id, ...recentIds].slice(0, RECENT_LIMIT);
      return picked.body;
    },
    [messages],
  );

  return { nudgeCopy };
}
