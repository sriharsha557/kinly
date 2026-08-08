# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before
writing any code.

**This project is SDK 54 and cannot move off it right now.** The installed
stack is `expo ^54.0.36` / `react-native 0.81.5` / `react 19.1.0`, and the Expo
client available to this project is **54.0.8** — SDK 55+ builds will not open in
it. So v54 is the only version worth reading, and matching a newer doc's API is
a way to write code that cannot run here.

This file used to point at `v57.0.0`, which no part of this project has ever
used. Corrected on 2026-08-08 after it sent a Jest setup pass at the wrong
version's docs. If you upgrade the SDK, change the URL and the version numbers
above in the same commit — a stale pointer here is worse than none, because it
reads as deliberate.

Two places where the version pin has already forced a decision, both documented
at their call sites rather than here:

- `react-native-worklets` is pinned to `0.5.1` by SDK 54. Reanimated's testing
  guide assumes 0.8+ and tells you to mock a module that does not exist at
  either documented path — see [jest-setup.js](jest-setup.js).
- Some native modules (push notifications among them) do not work in Expo Go at
  all and need a development build; a missing push in Expo Go is not
  necessarily a bug in the code.
