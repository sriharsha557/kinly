# Kinly — Roadmap

Ideas that came up during a session but were deliberately deferred rather than folded into whatever prompted them, so they don't get lost. Not a commitment or a priority order — a holding pen. Move an item here into ARCHITECTURE.md once it's actually built.

## Profile stat tiles

The v1 six-tile grid (Goals done, Active goals, Current streak, Completion rate, Circle members, Settings) shipped using only data that already existed. These didn't make the cut because each needs real new tracking or a new screen, not just a UI change:

- **Best streak (lifetime max)** — the schema only tracks each goal's *current* `streak_count`; there's no "highest it ever reached" column. Needs a new column (e.g. `goals.best_streak_count`) updated whenever the running streak beats it, or a small history table if we ever want to know *when* a personal best happened.
- **Circle streak** — "how many consecutive days has the circle collectively been active" doesn't exist as a concept anywhere yet. Garden health is a %, not a day-count streak. Needs its own definition (what counts as "the circle was active" on a given day?) before it can be tracked, let alone displayed.
- **Dedicated detail screens** — several proposed tap destinations don't exist: a personal streak calendar, a circle-streak page, a monthly analytics dashboard, a missed-check-in calendar. All six v1 tiles route to the closest *existing* screen (mostly Goals/Circle tabs) instead of these, so the tap targets are honest today rather than promising screens that aren't built.

## Mood check-in

- **User-created custom tags** — the "+ Add Tag" flow (type your own tag, app remembers it for next time). The shipped version only has fixed, predefined tags per mood. Needs its own storage/vocabulary design (per-user? per-circle? shared across the app?), not just a UI affordance.
- **Trend surfacing off tag data** — e.g. "you logged Lots of work 8 times this month." Needs aggregation logic once there's actually a season of tag data to aggregate.

## Other

- **AI-generated "boosting" messages per mood check-in status** — varying encouragement copy instead of the same message every time. Recommendation when this came up: a rotating pool of static variants per mood, not a live AI call on every check-in (latency/cost on the app's fastest interaction).
- **`kinly-logo-animated.svg`/`kinly-logo.json` (Lottie)** — committed to the repo as "standby" assets, never wired in. Needs `lottie-react-native`, a new native dependency requiring a fresh `eas build`.

## Production hardening

- [x] Error Boundary with "Try again" / "Go home" — shipped.
- [x] Sentry crash reporting live — shipped.
- [ ] Sentry release/source-map upload — blocked on `SENTRY_ORG`, `SENTRY_PROJECT`, and an auth token from the Sentry dashboard.
- [x] Circle Activity pagination — cursor-based `useInfiniteQuery`, replacing `.limit(50)` in `useEvents`. See ARCHITECTURE.md "Circle Activity pagination."
- [ ] E2E tests for critical flows (sign up → create goal → create/join circle) — Maestro recommended over Detox; framework choice not yet confirmed.

## iOS launch

Blockers (Apple will reject without these):
- [ ] Sign in with Apple — required because `signInWithOAuth({ provider: 'google' })` already exists in `src/lib/auth.ts` (Guideline 4.8: any third-party login requires an Apple option too).
- [ ] Apple Developer Program enrollment + EAS iOS credentials/provisioning — no iOS build pipeline exists yet (project is Android-only).
- [x] Content report/block mechanism for circle chat/comments — Guideline 1.2 UGC moderation requirement. See ARCHITECTURE.md "UGC safety (report + block)."
- [ ] HealthKit privacy-usage-string + data-handling review (once step tracking below ships) — stricter review than a normal app; health data can't be used beyond the stated purpose.

Needed, not blockers:
- [ ] APNs push notification setup (separate credential from Android's FCM).
- [ ] App Store Connect privacy nutrition label.
- [ ] iOS app icon (1024×1024, no alpha), device screenshots, age rating, description.
- [ ] iPad layout decision — support it, or explicitly restrict to iPhone-only in build settings.
- [ ] TestFlight beta review pass.

## iOS interaction polish

Adopt iOS conventions without changing the brand's visual language (cream/orange/rounded cards stay):
- [ ] iOS nav conventions — bottom tab bar, large titles, swipe-back gesture.
- [ ] Touch targets at 44×44pt minimum where currently under.
- [ ] More generous spacing/padding for iOS "breathing room."
- [ ] Slightly larger card corner radius (16–20pt) on iOS.
- [ ] Haptic feedback (`expo-haptics`) on key moments — cheap, worth doing on both platforms, not iOS-gated.
- [ ] Spring/gesture-driven page transitions.
- [ ] Selective glass/translucent treatment only for celebration moments (toast, bottom sheet, "Circle Complete" overlay) — not app-wide.

## Automatic accountability / health integration

Phase 1 scope — steps only, no paid aggregator yet:
- [x] Steps-only pilot goal type — `goal_source: 'health_steps'`, daily-reset progress/streak semantics (migration `0033_step_goal_sync.sql`). See ARCHITECTURE.md "Health Connect step goals."
- [x] Android Health Connect integration (`react-native-health-connect` + `plugins/withHealthConnect.js`). Requires a fresh `eas build` (new native module, not OTA-updatable).
- [ ] Apple HealthKit integration — deferred until the iOS build pipeline exists (see "iOS launch" above); not started.
- [ ] Per-metric privacy toggles (share completion vs. raw numbers) — not built yet. Circle feed currently shows the same `goal_completed`/`streak` events for step goals as manual goals (title + streak count only, no raw step numbers), which happens to match the "share completion, not numbers" principle by default, but there's no explicit user-facing toggle yet.
- [ ] Feed shift toward "proof of progress" — step-goal completions already post to the existing event feed via the same path as manual goals; no dedicated feed treatment (e.g. distinguishing "auto-detected" from "manually logged" visually) yet.
- [ ] Skip the Terra/Vital-style aggregator until multiple wearables are actually requested — still the plan, unchanged.

## Open loops

- [ ] Finalize the app name — still undecided between "Kinly" and "Cirqo." Blocks App Store Connect / Play Console listing work (no longer blocks a domain purchase — see below).
- [x] Domain purchase — decided not needed. Precedent: Pact (a close competitor) hosts its privacy policy on Notion ([abhimanyouknow.notion.site/...](https://abhimanyouknow.notion.site/Privacy-Policy-22f4f48a703c801790e4ceb7df0a78c7)) and uses a plain Gmail address (`contact.pactapp@gmail.com`) for support — no custom domain either. Kinly's existing setup already matches this: `privacy.html`/`terms.html`/`dmca.html` on GitHub Pages (`sriharsha557.github.io/kinly/`) plus `sriharsha87@gmail.com` as the support contact (already used in `ARCHITECTURE.md`'s privacy-policy note and the pitch deck's footer). A support email no longer needs to wait on the naming decision either, since a Gmail address doesn't need to match the app name.
- [ ] The "two circles" UI element from a screenshot below the milestone modal (filled orange + outlined circle) — never identified. Needs a follow-up screenshot with the modal dismissed, or a description of what tapping it does.
- [ ] The "two circles" UI element from a screenshot below the milestone modal (filled orange + outlined circle) — never identified. Needs a follow-up screenshot with the modal dismissed, or a description of what tapping it does.
