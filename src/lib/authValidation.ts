import { z } from 'zod';

// Strips HTML/script tags and control characters before length/format
// checks run - a form field is never trusted to have arrived clean, even
// though the RN inputs themselves don't render HTML (defense in depth: this
// is the one chokepoint every signIn/signUp/reset call passes through).
function sanitize(value: string): string {
  const noTags = value.replace(/<[^>]*>/g, '');
  const noControlChars = noTags
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 0x1f && code !== 0x7f;
    })
    .join('');
  return noControlChars.trim();
}

const email = z
  .string()
  .transform(sanitize)
  .pipe(z.string().min(1).max(254).email())
  .transform((v) => v.toLowerCase());

// Length/format only, matching Supabase Auth's own storage constraints -
// bcrypt (what GoTrue hashes with server-side) silently truncates past 72
// bytes, so anything longer wouldn't do what the user expects anyway.
const password = z.string().min(8, 'too short').max(72, 'too long');

const name = z
  .string()
  .transform(sanitize)
  .pipe(z.string().min(1).max(80));

export const signUpSchema = z.object({ email, password, name });
export const signInSchema = z.object({ email, password });
export const resetRequestSchema = z.object({ email });
export const newPasswordSchema = z.object({ password });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;

// Deliberately returns null (not the Zod error) on failure - callers must
// not surface *why* validation failed to the user (which field, which rule),
// only that the input was invalid. Reasons still go to Sentry via
// authErrors.ts's logValidationFailure for server-side monitoring.
export function safeParse<T>(schema: z.ZodType<T>, input: unknown): { data: T } | { data: null; reason: string } {
  const result = schema.safeParse(input);
  if (result.success) return { data: result.data };
  return { data: null, reason: result.error.issues.map((i) => `${i.path.join('.')}:${i.message}`).join(', ') };
}
