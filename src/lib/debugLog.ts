// Scoped diagnostic logging that costs nothing in a release build.
//
// The alternative this replaces was a console.log commit that had to be
// reverted by hand once the bug was found - which means the next person to
// debug the same path writes the same logging from scratch. Gated this way
// the diagnostics stay in the codebase, readable as documentation of what
// matters on a path, without ever reaching a user.
//
// __DEV__ is a React Native global: true under `expo start` and in a dev
// client, false in a release bundle. Metro substitutes the literal at build
// time, so the whole guarded block is dead code the minifier strips from
// production - the log arguments are never even evaluated.
declare const __DEV__: boolean;

export type DebugScope = 'askPosts';

// Per-scope so turning one path's noise on does not drown the console in
// every other path's. Set a scope to `false` to silence it while leaving its
// call sites in place.
const SCOPES: Record<DebugScope, boolean> = {
  askPosts: __DEV__,
};

export function debugLog(scope: DebugScope, ...args: unknown[]): void {
  if (!SCOPES[scope]) return;
  console.log(`[${scope}]`, ...args);
}
