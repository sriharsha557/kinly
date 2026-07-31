export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

// Single source of truth for the hour buckets - the greeting text and the
// greeting icon (components/icons/GreetingIcon.tsx) both derive from this,
// so a moon can never appear next to "Good Morning".
export function timeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

const GREETING: Record<TimeOfDay, string> = {
  morning: 'Good Morning',
  afternoon: 'Good Afternoon',
  evening: 'Good Evening',
};

export function timeOfDayGreeting(): string {
  return GREETING[timeOfDay()];
}

export function todayDateLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
