// supabase-js hands back a database error as a PLAIN OBJECT, not an Error
// subclass - postgrest-js only constructs the Error subclass on the
// throwOnError path, which nothing here uses. So `err instanceof Error` is
// false for every raw database error (e.g. the 23502 not-null violation
// when migration 0049 is unapplied), and a naive `err instanceof Error ?
// err.message : fallback` silently discards the one useful piece of
// information - the actual Postgres message - and falls back to generic
// copy for the single most common failure shape in this app.
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}
