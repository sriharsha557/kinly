// Scoped diagnostic logging that costs nothing in a release build - IF the
// call site is cheap. `debugLog`'s own body is a no-op when its scope is
// off, but the `__DEV__` check lives INSIDE the function: Metro does no
// cross-module constant propagation, so every call site still calls
// `debugLog` and fully evaluates its arguments in a release bundle before
// the no-op check runs. That is fine for a plain value or error object, but
// an expensive argument (a `.map()` over the query cache, a `JSON.stringify`
// of a large payload) still pays its full cost in production.
//
// The alternative this replaces was a console.log commit that had to be
// reverted by hand once the bug was found - which means the next person to
// debug the same path writes the same logging from scratch. Gated this way
// the diagnostics stay in the codebase, readable as documentation of what
// matters on a path, without ever reaching a user's console.
//
// For an expensive call site, guard it explicitly with `debugEnabled(scope)`
// so the expensive expression itself is never constructed in production:
//
//   if (debugEnabled('askPosts')) {
//     debugLog('askPosts', expensiveThing());
//   }
//
// __DEV__ is a React Native global: true under `expo start` and in a dev
// client, false in a release bundle. Metro substitutes the literal at build
// time, so a guarded block like the one above is dead code the minifier
// strips from production, including its arguments.
// 'askReplies' is scoped separately from 'askPosts' even though both live in
// useAskPosts.ts: sending a reply invalidates BOTH queries, so tracing the
// reply path with one shared scope interleaves two query lifecycles in the
// console and the ordering - which is the whole question - stops being
// readable.
export type DebugScope = 'askPosts' | 'askReplies';

// Per-scope so turning one path's noise on does not drown the console in
// every other path's. Set a scope to `false` to silence it while leaving its
// call sites in place.
//
// `typeof __DEV__ !== 'undefined'` guards module-init for the test runner
// (`node --experimental-strip-types`), which has no `__DEV__` global at all -
// without this, the first pure-.ts test that transitively imports this
// module would throw a ReferenceError before any test body runs.
const SCOPES: Record<DebugScope, boolean> = {
  askPosts: typeof __DEV__ !== 'undefined' && __DEV__,
  askReplies: typeof __DEV__ !== 'undefined' && __DEV__,
};

// Hoistable guard for call sites whose arguments are expensive to build.
// Exported separately from debugLog so those sites can skip constructing
// the argument entirely in production, rather than constructing it and
// handing it to a function that then discards it.
export function debugEnabled(scope: DebugScope): boolean {
  return SCOPES[scope];
}

export function debugLog(scope: DebugScope, ...args: unknown[]): void {
  if (!SCOPES[scope]) return;
  console.log(`[${scope}]`, ...args);
}
