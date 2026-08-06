// How a cadence is worded, and whether a draft one is legal.
//
// One owner for this copy on purpose: the add form, the goal card and the
// Area detail grid all render the same cadence, and three hand-written
// versions drift into "4x/week", "4 times a week" and "4× a week" on three
// screens of the same app.
//
// Dependency-free apart from showingUp.ts so node:test can import it under
// --experimental-strip-types.

import type { Cadence, TargetType } from './showingUp.ts';

// Monday-first, matching WEEK_STARTS_ON in periods.ts. Index i is ISO
// weekday i + 1.
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// A cadence being built in the UI, before it is known to be valid. Mirrors
// Cadence but with target_type nullable, because "nothing picked yet" is the
// starting state of the form.
export interface CadenceDraft {
  target_type: TargetType | null;
  target_count: number | null;
  target_weekdays: number[] | null;
}

export function describeCadence(cadence: Cadence | CadenceDraft): string {
  switch (cadence.target_type) {
    case 'daily':
      return 'Every day';
    case 'times_per_week': {
      const n = cadence.target_count ?? 0;
      return n === 1 ? 'Once a week' : `${n}× a week`;
    }
    case 'specific_weekdays': {
      const days = [...(cadence.target_weekdays ?? [])].sort((a, b) => a - b);
      return days.map((d) => WEEKDAY_LABELS[d - 1]).join(' · ');
    }
    case 'monthly': {
      const n = cadence.target_count ?? 1;
      return n === 1 ? 'Once a month' : `${n}× a month`;
    }
    default:
      // Every goal created before this plan has a null target_type. They are
      // still on screen, so this needs real copy rather than an empty string
      // that renders as a blank line under the title.
      return 'No cadence set';
  }
}

// Returns an error message to show the user, or null if the draft is legal.
// Message strings, not booleans, so the form has something to display and
// the reason lives next to the rule.
export function validateCadence(draft: CadenceDraft): string | null {
  switch (draft.target_type) {
    case 'daily':
      return null;
    case 'times_per_week':
      // The database refuses 0 or less (goals_target_count_positive), and a
      // week cannot hold more than seven.
      if (!draft.target_count || draft.target_count < 1) return 'Pick how many times a week.';
      if (draft.target_count > 7) return 'A week only has seven days.';
      return null;
    case 'specific_weekdays':
      if (!draft.target_weekdays || draft.target_weekdays.length === 0) return 'Pick at least one day.';
      return null;
    case 'monthly':
      if (!draft.target_count || draft.target_count < 1) return 'Pick how many times a month.';
      return null;
    default:
      return 'Pick how often.';
  }
}
