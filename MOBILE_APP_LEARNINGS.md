# Mobile App Learnings — from building Kinly

Things I wish I'd put in the PRD from day one, instead of discovering them mid-build. Written after shipping Kinly (React Native/Expo), so some of this is Expo-specific, but most of it applies to any mobile app. Use this as a checklist when starting the next one.

## 1. Decide these before writing any code

- **Native build pipeline, not just design.** A managed Expo/RN app can ship JS-only changes instantly (`eas update`), but anything touching native code — a new permission, a native module, an icon, a splash screen, a status bar color — needs a real `eas build` and a fresh install. Decide upfront which features need native modules (health data, camera, biometrics, push) so you're not surprised mid-project by a rebuild-and-reinstall cycle.
- **Theming architecture, even if you only ship light mode at launch.** Retrofitting a `ThemeProvider`/`useTheme()` hook across a codebase that grew up importing static color constants directly is a full-app mechanical refactor (42 files, in Kinly's case) once you finally want dark mode or per-user themes. If there's *any* chance of needing this later, build the indirection on day one — it costs nothing extra now and saves a large low-value refactor later.
- **Design tokens with semantic names from the start** (`background`, `surface`, `textPrimary`, `accent` — not `orange500` or raw hex scattered across files). Renaming later means touching every file that used the old name.
- **Platform scope: Android-only, iOS-only, or both, and when.** iOS and Android have almost entirely separate checklists (see §4). If you're only shipping Android first, say so explicitly in the PRD and defer the iOS list — don't let it sneak in as scope creep later.

## 2. Backend/data patterns to establish early

- **Row-Level Security (RLS) from the first migration**, not bolted on later. Every table a user can read/write needs a policy; a shared "is this person allowed to see this row" helper function (e.g. a `is_circle_member()`-style function) pays for itself the moment you have more than 3-4 tables.
- **Race conditions on "one row per person per day/period" data.** A client-side read-then-write (check if today's row exists, then insert or update) is racy under concurrent requests. Use a DB-level partial unique index + an atomic upsert or a `security definer` RPC instead. This bit us on a mood check-in feature and would bite anyone building streaks, daily check-ins, or leaderboards.
- **Soft deletes vs hard deletes, decided per table, upfront.** Retrofitting soft-deletes onto a live schema means updating every RLS policy and query that assumed rows just vanish. Decide which tables need "undo"/audit history and which are fine to hard-delete (and cascade) before you have real user data.
- **UGC moderation (report + block) is a launch requirement, not a nice-to-have**, if your app has ANY free-text user content (comments, posts, messages) — Apple's App Store Guideline 1.2 requires it explicitly, and it's much cheaper to build the `reports`/`blocked_users` tables and a shared "long-press → report/block" UI pattern once, early, than to retrofit it across every content surface later.
- **Account deletion is a launch requirement too** (App Store Guideline 5.1.1v, and Play Store increasingly enforces it) — self-service, in-app, not "email support to delete your account."

## 3. Error handling patterns worth codifying in the PRD

- **`try { await mutation() } finally { ... }` with no `catch` is a real, repeatable bug** — the exception propagates unhandled, silently skipping everything after it, and the user sees nothing (no error, but also no success). We found this exact pattern independently 3 times in one app. Put "every `await` inside an async event handler needs a `catch` that gives the user feedback" in the engineering guidelines, not just code review.
- **A global error boundary is cheap and non-negotiable.** One React error boundary wrapping the navigator, with a fallback screen offering both "Try again" (remount) and "Go home" (clear cache + remount, for when corrupted cached data is the actual cause) turns "app is permanently frozen/blank" into a recoverable moment. Build this in week one, not after the first crash report.
- **Crash reporting (Sentry or equivalent) should be wired up before the first internal build goes out**, not added later — every day without it is a day of silent crashes with zero visibility.

## 4. The UI states checklist (put this directly in the PRD's acceptance criteria)

Every screen with data should be explicitly designed against this list, not left to "whatever the framework does by default":

| State | Common mistake |
|---|---|
| Empty | Blank screen instead of real copy explaining what goes here and how to add the first item |
| Loading | A blank flash before content pops in, instead of a skeleton that matches the eventual layout |
| Error | A silently failed mutation with zero feedback (see §3) |
| Success | No acknowledgment that an action worked — especially for anything that took real effort (completing a goal, finishing a big form) |
| No internet | Silently hangs or shows a generic error indistinguishable from a server bug |
| Slow network | Identical to normal loading, no "this is taking a while" signal, no timeout |
| No search results | Different from "still loading" and from "nothing exists yet" (empty state) — needs its own copy |
| Permission denied | **Easy to get wrong**: a denied permission (camera, photo library, notifications) must look different from the user simply cancelling the picker/dialog. Silence here reads as "this button is broken." |
| Session expired | An involuntary logout (expired token) must be distinguishable from an intentional sign-out, or it looks like a bug, not a security behavior |
| Form validation | Decide upfront whether every form gets real inline validation messages or just a disabled submit button — mixing the two inconsistently across the app looks unfinished |

## 5. App store submission requirements (budget real time for these)

**Universal (both stores):**
- Privacy policy, linked from account creation, not just buried in settings
- Self-service account deletion, in-app
- Real app icon variants (adaptive icon layers for Android, all required sizes for iOS), splash screen
- Support contact — a domain is *not* required; a plain email address and a free static host (GitHub Pages, Notion) are genuinely fine and what competitors ship with

**iOS-specific, budget for these separately:**
- Apple Developer Program enrollment (paid, and has to happen before any of the below)
- Sign in with Apple — **mandatory** the moment you offer any other third-party login (Google, Facebook, etc.) — Guideline 4.8
- UGC report/block mechanism if you have any user-generated content — Guideline 1.2
- App Store Connect privacy "nutrition label" — an accurate accounting of every data type collected
- TestFlight review pass before external beta testers can install
- iPad layout decision — support it or explicitly restrict to iPhone-only in build settings, don't leave it undecided

**Android-specific:**
- Play Console's own data-safety form (similar spirit to Apple's nutrition label)
- Adaptive icon layers (foreground/background/monochrome), not just one square PNG

## 6. Health data / device sensor integrations

If the product idea involves wearables or health data (steps, sleep, heart rate):
- **Native module, so it needs a real build**, not an OTA update — plan the build cycle into the timeline.
- **Platform-specific**: Android uses Health Connect, iOS uses HealthKit — these are two separate integrations with different permission models, not one cross-platform API.
- **Design the "what gets shared with others" boundary before writing any sync code.** Decide whether friends/circle members see raw numbers or just "goal completed" — this is a privacy decision, not just a UI toggle, and is much easier to get right from the start than to restrict later.
- Consider whether you need a third-party aggregator (Terra, Vital) to support many wearables at once, or whether direct HealthKit/Health Connect integration covers your actual user base first — the aggregator is a recurring paid dependency, worth deferring until multiple wearables are genuinely requested.

## 7. Testing infrastructure

- **Decide your E2E testing tool (Maestro, Detox, etc.) and get an emulator/device actually running in your dev environment early.** Writing E2E test flows without the ability to run and verify them against a real emulator is close to useless — you can't tell if they're correct.
- `tsc --noEmit` and a real linter (not just "no linting") should be set up from commit one — retrofitting linting onto an unlinted codebase surfaces a wave of pre-existing issues all at once instead of catching them incrementally.

## 8. Process notes

- **A competitor's actual App Store listing is a fast, cheap research tool.** Ten minutes reading a close competitor's description and screenshots told us more about realistic scope (what a real submission needs, what a reasonable feature set looks like, what monetization structure the market supports) than speculating from scratch.
- **When a build fails, read the actual remote build log, not just the local error.** A `npm ci` failure that never shows up locally (because a platform-specific optional dependency your dev machine never installs) is a real, repeatable class of bug on any cross-platform CI system — don't assume "works on my machine" means the lockfile is actually correct for every platform.
- **`.easignore` (or your CI's equivalent ignore file) matters once you have any local tooling that creates symlinks or vendored directories** (installed skill packages, tool caches) — these can silently break a build archive step in ways that have nothing to do with your actual app code.

---

## Universal PRD checklist

Copy this into the next PRD. Generic on purpose — not Kinly-specific, so it holds up for any mobile app.

### Design system & assets
- [ ] Semantic design tokens (`background`, `surface`, `textPrimary`, `accent`...) defined before screens get built, not extracted after the fact
- [ ] `ThemeProvider`/theme-hook architecture in place even if only one theme ships at launch
- [ ] Custom icon set (or a licensed one) — decide up front whether platform emoji are acceptable anywhere in the UI, or banned entirely for visual consistency
- [ ] App icon: all required sizes/variants (iOS icon, Android adaptive icon foreground/background/monochrome layers, web favicon)
- [ ] Splash screen, matched to both light and (if supported) dark backgrounds
- [ ] Accessibility pass: color contrast (WCAG AA minimum), tap target sizes (44×44pt minimum), screen reader labels on icon-only buttons

### UI states (design + build every screen against this list)
- [ ] Empty state (real copy, not blank)
- [ ] Loading state (skeleton matching real layout, not a blank flash)
- [ ] Error state (every failed action gives visible feedback, never a silent no-op)
- [ ] Success state (explicit acknowledgment for anything effortful)
- [ ] No internet / offline state
- [ ] Slow network state (timeout + "still working..." signal, distinct from normal loading)
- [ ] No search results (distinct from empty and from loading)
- [ ] Permission denied (camera, photos, location, notifications — must look different from "user cancelled")
- [ ] Session expired (must look different from an intentional sign-out)
- [ ] Form validation (decide: inline messages everywhere, or disabled-submit-only everywhere — pick one, don't mix)

### Legal & compliance
- [ ] Privacy policy — accurate to what's actually collected, linked at account creation (not just in settings)
- [ ] Terms of service
- [ ] DMCA/takedown policy if the app hosts any user-uploaded content
- [ ] Cookie/tracking disclosure if using analytics or ad SDKs
- [ ] Data-safety declarations for both stores (Apple's "nutrition label," Google Play's Data Safety form) — must match the privacy policy exactly
- [ ] Age rating / minimum age, and COPPA consideration if the app could plausibly attract users under 13
- [ ] GDPR/CCPA data-export and data-deletion support if targeting EU/California users
- [ ] Self-service account deletion, in-app (App Store 5.1.1v requirement, increasingly expected on Play too)

### Backend & data safety
- [ ] Row-Level Security (or equivalent authorization layer) from the first migration
- [ ] UGC report + block mechanism if there's any free-text user content (App Store Guideline 1.2)
- [ ] Race-condition review for any "one row per user per day/period" data (streaks, check-ins, leaderboards)
- [ ] Soft-delete vs hard-delete decided per table before real user data exists
- [ ] Rate limiting on any paid third-party API call (AI, SMS, email) triggered by user action

### Error handling & observability
- [ ] Global error boundary with a real recovery path (not just "app is frozen")
- [ ] Crash reporting (Sentry or equivalent) wired up before the first build goes to anyone outside the team
- [ ] Every `async` event handler's `await` wrapped in a `catch` that gives user-visible feedback
- [ ] Source maps / symbolication configured so crash reports are actually readable

### App store submission
- [ ] Apple Developer Program enrolled (budget lead time — this blocks everything else on iOS)
- [ ] Sign in with Apple implemented if any other third-party login exists
- [ ] TestFlight / internal testing track set up before external beta
- [ ] iPad layout decision made explicitly (support it, or restrict to iPhone-only)
- [ ] Support contact (email is enough — a custom domain is not required)
- [ ] App Store / Play Store screenshots, description, keywords drafted early (not the night before submission)

### Platform & native build strategy
- [ ] Explicit decision on iOS vs Android vs both, and launch order
- [ ] Clear on which features require a native rebuild (new permission, native module, icon/splash change) vs. which can ship as an OTA/JS update
- [ ] E2E test tool chosen with a real emulator/device available in the dev environment to actually run tests against
- [ ] Linting + typechecking enabled from the first commit, not retrofitted later

### Analytics & growth (decide even if deferred)
- [ ] Product analytics tool chosen (or explicitly deferred with a reason)
- [ ] Push notification strategy — categories, opt-out granularity, quiet hours
- [ ] Referral/invite mechanism if growth depends on virality
- [ ] Health/wearable data integration scoped per-platform (HealthKit ≠ Health Connect) if relevant, with a stated policy on what's shared with other users vs. kept private

---

## Product Validation (before building major features)

- [ ] Define the primary user persona and their biggest pain point
- [ ] Write a one-sentence value proposition
- [ ] Identify the MVP feature set vs "nice-to-have" features
- [ ] Define success metrics (DAU, retention, activation, conversion, etc.)
- [ ] Validate major features with 5–10 target users before implementation
- [ ] Identify assumptions that need validation instead of building immediately
- [ ] Decide what will NOT be included in the first release

---

## Security

- [ ] Secure storage for authentication tokens (Keychain / Keystore)
- [ ] Secrets managed outside source control (.env, EAS Secrets, etc.)
- [ ] Authentication/session expiration strategy defined
- [ ] Password reset and email verification flows designed (if applicable)
- [ ] API rate limiting for authentication endpoints
- [ ] Database backup and recovery strategy
- [ ] Audit logging for sensitive operations (if required)

---

## Performance

- [ ] Target cold-start time defined
- [ ] Image optimization strategy
- [ ] Lazy loading for large lists/screens
- [ ] Pagination or infinite scrolling for large datasets
- [ ] Caching strategy defined
- [ ] Background sync strategy (if applicable)
- [ ] Performance monitoring tool selected

---

## Navigation

- [ ] Deep linking supported (if applicable)
- [ ] Universal Links / Android App Links configured
- [ ] Back navigation behaviour consistent across platforms
- [ ] Navigation state restoration after app restart
- [ ] Modal vs push navigation patterns documented

---

## Notifications

- [ ] Push notification permission onboarding designed
- [ ] Notification categories/types documented
- [ ] Quiet hours / notification frequency policy defined
- [ ] Deep linking from notifications implemented
- [ ] Notification analytics tracked
- [ ] User notification preferences configurable

---

## Internationalization & Localization

- [ ] All UI strings externalized
- [ ] Date/time formatting supports locale
- [ ] Number and currency formatting supports locale
- [ ] Time zone handling reviewed
- [ ] RTL language support decision documented
- [ ] Translation strategy decided (manual vs automated)

---

## Design Consistency

- [ ] Standard spacing scale defined
- [ ] Typography scale defined
- [ ] Button hierarchy documented
- [ ] Icon usage guidelines documented
- [ ] Haptic feedback guidelines
- [ ] Animation/motion guidelines
- [ ] Loading animation patterns standardized
- [ ] Toast/Snackbar pattern standardized
- [ ] Bottom Sheet pattern standardized
- [ ] Dialog/Confirmation pattern standardized

---

## Analytics

- [ ] Analytics platform selected
- [ ] User properties defined
- [ ] Core events documented
- [ ] Funnel tracking defined
- [ ] Retention tracking defined
- [ ] Feature usage tracking defined
- [ ] A/B testing strategy (if applicable)

---

## Release Readiness

- [ ] Versioning strategy defined
- [ ] Release checklist documented
- [ ] Rollback strategy documented
- [ ] Feature flags for risky features
- [ ] Beta testing plan
- [ ] Changelog process
- [ ] Monitoring dashboards reviewed before release

---

## Documentation

- [ ] README updated
- [ ] Architecture diagram maintained
- [ ] API documentation available
- [ ] Database schema documented
- [ ] Environment setup documented
- [ ] Deployment process documented
- [ ] Onboarding guide for new developers

---

## Technical Debt

- [ ] Known technical debt documented
- [ ] Future improvements backlog maintained
- [ ] Refactoring opportunities tracked
- [ ] Third-party dependency review completed
- [ ] Deprecated code removed before major releases

---

## Product Decisions

- [ ] Why does this feature exist?
- [ ] Who benefits from this feature?
- [ ] How will success be measured?
- [ ] What alternatives were considered?
- [ ] Can this be simplified?
- [ ] Is this solving a real user problem or an assumed one?
- [ ] Does this fit the product vision?
