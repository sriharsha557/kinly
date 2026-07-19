import { Sentry } from './sentry';

export type AuthContext = 'signIn' | 'signUp' | 'passwordReset';

// User-facing copy never names a field or confirms/denies an account's
// existence. Supabase's own error text (logged separately below) can say
// "Invalid login credentials" or "User already registered" - none of that
// reaches the UI.
const MESSAGES: Record<AuthContext, string> = {
  signIn: 'Incorrect email or password.',
  signUp: "We couldn't create your account with those details. Please check your info and try again.",
  passwordReset: "If that email is registered, you'll receive a reset link.",
};

function isNetworkError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('network') || m.includes('fetch') || m.includes('timeout') || m.includes('offline');
}

function isRateLimited(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('rate limit') || m.includes('too many');
}

// Logs the real Supabase error server-side (Sentry) for monitoring, then
// returns only a generic, non-leaking message for the UI. Never logs the
// password itself - only the error text and context.
export function toSafeAuthMessage(err: unknown, context: AuthContext): string {
  const raw = err instanceof Error ? err.message : String(err);

  Sentry.addBreadcrumb({
    category: 'auth',
    message: `${context} failed: ${raw}`,
    level: 'warning',
  });

  // Network/rate-limit failures aren't account-identifying, so it's fine
  // (and more useful) to say so plainly rather than folding them into the
  // generic per-context message.
  if (isNetworkError(raw)) return 'Connection problem — check your internet and try again.';
  if (isRateLimited(raw)) return 'Too many attempts. Please wait a moment and try again.';

  // Sign-in-only carve-out: unlike wrong-password vs. wrong-email (which
  // must stay indistinguishable), telling a real user their email needs
  // confirming is normal, actionable UX, not an account-enumeration leak -
  // it doesn't reveal whether the password they typed was correct.
  if (context === 'signIn' && raw.toLowerCase().includes('email not confirmed')) {
    return 'Please confirm your email before signing in — check your inbox for the link.';
  }

  return MESSAGES[context];
}

// Called when Zod validation itself rejects input, before any Supabase call
// is made - logged the same way so malformed/malicious input attempts show
// up in monitoring even though they never reach the network. Returns the
// *same* per-context message toSafeAuthMessage would - a validation-rejected
// signIn (e.g. a too-short password) must be indistinguishable from a
// Supabase-rejected one, or the two failure paths become a side channel.
export function logValidationFailure(context: AuthContext, reason: string): string {
  Sentry.addBreadcrumb({
    category: 'auth.validation',
    message: `${context} validation failed: ${reason}`,
    level: 'warning',
  });
  return MESSAGES[context];
}
