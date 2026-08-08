/* eslint-env jest */

// Reanimated ships its own Jest support; setUpTests() installs the animation
// mocks and the toHaveAnimatedStyle matcher. Required because AnimatedPressable
// is used by essentially every interactive component in the app, so without
// this almost nothing renders under test.
//
// Reanimated's docs say to follow react-native-worklets' Jest guide first and
// mock `react-native-worklets`. That guide describes worklets 0.8+; this project
// is pinned to 0.5.1 by SDK 54, which ships no mock entry point at either
// documented path (`react-native-worklets/src/mock` or `/lib/module/mock`) -
// both fail to resolve. setUpTests() alone is sufficient on this pairing
// (reanimated 4.1.7 / worklets 0.5.1). Revisit when worklets reaches 0.8+.
require('react-native-reanimated').setUpTests();

// AsyncStorage is a native module, so it is null under Jest and throws on
// import. It is not optional to mock: ThemeProvider reads the persisted theme
// through the zustand store in src/state/useThemeStore.ts, so EVERY render
// test imports it transitively and the whole suite fails to load without this.
// The bundled mock is an in-memory implementation, which also means each test
// file starts from empty storage.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// react-native-safe-area-context reads real device insets through a native
// module that does not exist under Jest. Its own bundled mock returns fixed
// frame and inset values, which is what we want: predictable numbers, so a
// test that depends on layout is not quietly device-dependent.
//
// `.default` is load-bearing. That mock file uses `export default { ... }`, so
// requiring it yields `{ __esModule: true, default: {...} }` - returning that
// object directly makes every NAMED import from the module undefined, and the
// first symptom is React failing on an undefined element type with no useful
// component stack. Unwrapping the default gives back real named exports.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// Nothing in a render test should reach the network. Supabase is mocked at the
// module boundary rather than per-test so that a component reaching for it by
// accident fails loudly here instead of hanging, or worse, hitting the real
// project with test credentials from .env.
jest.mock('./src/lib/supabase', () => ({
  supabase: {
    from: () => {
      throw new Error(
        'A render test reached supabase. Mock the hook that queries it instead - render tests must not touch the network.',
      );
    },
    rpc: () => {
      throw new Error('A render test reached supabase.rpc. Mock the hook instead.');
    },
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
  },
}));
