# Kinly — Architecture Overview

Kinly is a React Native / Expo app for small private accountability circles ("Growth Circles" of 2-10 friends). This doc maps each screen to what it does and how it's wired up, so future work can find the right file fast.

## Stack

- **Navigation**: `@react-navigation` — root native-stack (`Onboarding`, `Main`, `CircleSettings`, `EditProfile`) wrapping a bottom-tabs navigator (`Today`, `Circle`, `Goals`, `Connection`, `Profile`). See [src/navigation/types.ts](src/navigation/types.ts), [src/navigation/MainTabs.tsx](src/navigation/MainTabs.tsx).
- **State**: Zustand `useAuthStore` holds the signed-in `user` and `activeCircleId` (a user can belong to multiple circles but only one is "active" at a time).
- **Server state**: TanStack React Query, one hook file per domain in `src/hooks/`, persisted to `AsyncStorage` for offline-first caching ([src/lib/persister.ts](src/lib/persister.ts)).
- **Backend**: Supabase — Postgres + RLS, Auth (email/password + Google OAuth), Storage (avatars, vision-board images), Edge Functions (nudge messages, notifications, weekly recap, circle AI, streak-at-risk cron).
- **Theme**: static tokens in [src/theme/colors.ts](src/theme/colors.ts) — `colors`, `categoryColors` (per interest pillar), `gradients`, `radii`, `shadow`. No dark mode yet (deliberately deferred). Each semantic color (`success`, `celebration`) is deliberately a distinct hex from the category color it shares a hue family with (`health.solid`, `relationships.solid`) — same visual family, but not literally the same value, so they stay distinguishable if ever shown together.
- **Illustrations**: custom SVG art lives in [assets/illustrations/](assets/illustrations/), imported directly as components via `react-native-svg-transformer` ([metro.config.js](metro.config.js), [svg.d.ts](svg.d.ts)) — the first raw `.svg` imports in the codebase; the app icon/`Logo` are still hand-coded `react-native-svg` primitives instead, unrelated to this pipeline. `GardenStageArt` ([src/components/GardenStageArt.tsx](src/components/GardenStageArt.tsx)) maps `GardenStage` (`seed`/`sprout`/`tree`/`bloom`) to real plant art, used by both `GardenCard` (per-member) and `GardenTeaser` (circle-level hero, picked by health tier). All 5 `GardenStage` values now have matching art (`wilted` included). Also used: `kinly-Goal.svg` (target icon) replaces the 🎯 emoji on goal tags/chips in `ConnectionScreen`; `kinly-idea.svg` (a more detailed bulb illustration than `idea-bulb.svg`) heads `GoalSuggestions`' "Suggested for you" section; `kinly-ill-buddy`, `kinly-ill-calendar-meetup`, `kinly-ill-rocket`, `kinly-ill-chat`, `kinly-ill-dice` replace the 🤝/📍/🚀/💬/✨ emoji in `BuddyCard`, `MeetUpCard`, `ChallengesCard`/`QuickActionsRow`, `DailyCircleCard`/`QuickActionsRow`, and the Connection "Light Moments" `DisclosureSection` header respectively (`DisclosureSection` now takes an optional `icon` prop). Deliberately not yet touched: `TodayScreen`'s per-event-type icons and `INTEREST_OPTIONS` category emoji — both are small sets where only some entries have matching custom icons so far; converting partially would look inconsistent, so they wait for fuller coverage.
- **Platform status**: [app.json](app.json) is configured for both platforms and every EAS Update publish targets iOS + Android JS bundles, but no real iOS native build (`eas build --platform ios`) has been produced or tested yet — that requires an Apple Developer Program enrollment, which hasn't happened. `ios.infoPlist.NSPhotoLibraryUsageDescription` is set (needed for the avatar/vision-board image picker); revisit this section once a real iOS build is run, since native-config issues only surface there, not in `expo export` or `eas update`.

## Screen map

### Launch video — [src/screens/LaunchVideoScreen.tsx](src/screens/LaunchVideoScreen.tsx)
Plays [assets/applaunch.mp4](assets/applaunch.mp4) fullscreen (muted, no loop) before anything else renders — `RootNavigator` holds a `showLaunchVideo` flag and renders only this screen until it finishes, while `useBootstrapSession` keeps resolving in the background so the app already knows where to route once the video ends. Advances on `playToEnd`, on a player error, or after an 8s fallback timeout (never gets stuck); a "Skip" button in the corner does the same. Uses `expo-video` — the first native-module dependency added outside the original scaffold, so unlike every other change this session it needs a real `eas build` (not just `eas update`) to work on any already-installed standalone build; Expo Go and the local dev server pick it up immediately since Expo Go bundles the SDK's core native modules.

### Onboarding — [src/screens/OnboardingScreen.tsx](src/screens/OnboardingScreen.tsx)
Single screen, three sequential steps driven by user state (not separate routes):
1. **AuthStep** — sign in / sign up (email+password) or "Continue with Google" (Supabase OAuth via `expo-web-browser`). Sign-up without email confirmation shows a "check your email" holding state.
2. **InterestsStep** — shown when `user.interests === null`; picks pillars (health/wealth/ideas/learning/relationships) via `InterestPicker`, saved with `useSetInterests`.
3. **CircleStep** — create a new circle (generates an invite code) or join one by code (`useCreateCircle` / `useJoinCircle`, both backed by `security definer` RPCs to sidestep RLS ordering issues). After creating, shows an `InviteStep` with a WhatsApp share button.

### Today (home tab) — [src/screens/TodayScreen.tsx](src/screens/TodayScreen.tsx)
The app's landing screen — redesigned to have a clear "what should I do right now" purpose rather than being a raw activity feed.
- Personalized greeting + date ([src/lib/greeting.ts](src/lib/greeting.ts)).
- `GardenTeaser` — big emotional summary card of the circle's health %, links to Circle tab.
- `TodayGoalsChecklist` — the signed-in user's own goals not yet logged today; tap to log progress, shows a celebration modal on completion/streak milestones.
- `QuickActionsRow` — three shortcuts (Check In → Goals, Ask Friends → Connection, Start Challenge → Circle).
- **Circle Activity** — day-grouped timeline of circle events (goal completions, streaks, reminders, asks, challenge completions) from `useEvents`. Each row supports one-tap emoji "nudges" (cheer/water/walk/workout/keep going/streak) which call `generateNudgeMessage` (Claude via Edge Function `smooth-responder`) then insert a nudge row and fan out a push notification via the `notify-circle` Edge Function.

### Circle (dashboard tab) — [src/screens/CircleScreen.tsx](src/screens/CircleScreen.tsx)
Everything about "how is my circle doing," moved off Today to keep it uncluttered. Cards are split into two tiers so the accountability loop stays the visual priority instead of competing equally with lower-frequency extras:
- **Primary (always visible)**: `GardenCard` (full per-member plant growth, derived from `useGarden`, stages `wilted → seed → sprout → tree → bloom`), `BuddyCard` (accountability buddy pairing/check-ins), `ChallengesCard` (circle challenges + completion celebrations).
- **Secondary, behind a `DisclosureSection` ("More for your circle")**: `VisionBoardCard`, `MeetUpCard` (manual RSVP, no calendar integration), `CircleAICard` (AI insight, Edge Function `circle-ai-insight`), `WeeklyRecapCard` (AI weekly summary, Edge Function `weekly-recap`). Collapsed by default — tap to expand. `CircleAICard`'s "Try: {suggestedChallenge}" button creates a real challenge via `useCreateChallenge`, then confirms with haptics + inline "✓ Started" state and scrolls the screen back up to `ChallengesCard` so the result is actually visible — closes the loop between the AI suggestion and the primary card it feeds.
- Header "⚙️ Settings" link → `CircleSettingsScreen`.

### Goals — [src/screens/GoalsScreen.tsx](src/screens/GoalsScreen.tsx)
- `GoalSuggestions` — AI/heuristic goal ideas based on interests (`src/lib/suggestions.ts`), tap to customize and add.
- `AddGoalForm` — title, numeric target, optional category chip.
- Goal list (`FlatList`) of `GoalCard`s: progress bar, streak badge, "Log progress" button, "⋯" menu for edit/delete.
- Logging progress and celebration logic (goal-completed detection, streak-milestone detection at `[3,7,14,30,60,100]`, haptics, event + achievement writes) is centralized in `useLogGoalWithCelebration` — shared with `TodayGoalsChecklist` on the Today tab so both surfaces behave identically.
- Edit uses `EditGoalModal`; delete/edit both route through `useUpdateGoal` / `useDeleteGoal`.

### Connection (was "Ask Friends") — [src/screens/ConnectionScreen.tsx](src/screens/ConnectionScreen.tsx)
Split into **Support** (visible by default) and **Play** (behind a `DisclosureSection`), since only the former actually deepens accountability:
- **Support**: `DailyCircleCard` (one deterministic daily prompt per circle, hashed from `circleId+date`, no server call, answers hidden until you submit your own), then **Ask Friends** — post a question (optionally tagged to one of your goals), circle members reply in an expandable thread, author can delete their own post.
- **Play, behind "Light Moments" (collapsed by default)**: `WouldYouRatherCard` (A/B poll, live vote %), `GuessWhoCard` (anonymous-style fact guessing, answer hidden client-side only, not RLS-enforced — accepted tradeoff). Trimmed to these two deliberately — kept the mechanics that are one-tap, under 3 minutes, and async-only; dropped Circle Stories to avoid the section turning into a toybox that competes with the app's accountability identity. Live-drawing games (e.g. Pictionary) were considered and explicitly deferred — they need a realtime canvas/sync layer that doesn't exist yet, unlike everything else here.

### Profile — [src/screens/ProfileScreen.tsx](src/screens/ProfileScreen.tsx)
- Avatar (tap → `EditProfileScreen`), name, active circle name, bio.
- Stat tiles: goals completed, best streak, friends helped (`useProfileStats`), plus a shortcut tile to Circle Settings.
- Achievement badges — tapping one reopens its `MilestoneCardModal`.
- `FutureSelfCard` — AI "future self" reflection feature (`useFutureSelf`).
- Sign out.

### Edit Profile — [src/screens/EditProfileScreen.tsx](src/screens/EditProfileScreen.tsx)
Name, bio, interest pillars, and avatar — two ways to set the avatar: **Upload a photo** (`avatarUpload.ts` → Supabase Storage) or **Choose an avatar** (`AvatarPickerModal` → DiceBear's `open-peeps` API, [src/lib/avatarPresets.ts](src/lib/avatarPresets.ts) — stateless, no upload, just a URL built from a random seed; "Shuffle" regenerates the grid). Saves via `useUpdateProfile`.

### Circle Settings — [src/screens/CircleSettingsScreen.tsx](src/screens/CircleSettingsScreen.tsx)
- Invite code display + share (WhatsApp-specific button + generic `Share.share`).
- Member list with role management (owner/admin/member) for admins/owners — `useUpdateMemberRole`.
- Switcher across all circles the user belongs to (`useMyCircles` → `setActiveCircleId`).
- Per-category notification mute toggles (`useNotificationMutes` / `useToggleMute`).
- "Join or start another circle" modal (same create/join flow as onboarding).
- "Leave this circle" — `useLeaveCircle` RPC; warns if leaving transfers ownership.

## Cross-cutting mechanisms

- **Celebrations**: `MilestoneCardModal` is the single celebratory UI, triggered from goal completion/streak milestones (Goals, Today) and achievement badges (Profile).
- **Push notifications**: Supabase Database Webhooks → `notify-circle` Edge Function fan-out to Expo push tokens, filtered by each recipient's per-category mutes.
- **AI features**: all go through Supabase Edge Functions (never called directly from the client with a raw API key) — nudge messages, weekly recap, circle insight, future self.
- **Derived vs. stored state**: Garden health/plant stages are computed client-side from goals data (`useGarden`), not a separate table — keeps it always in sync with real goal activity.
- **Progressive disclosure**: `DisclosureSection` ([src/components/DisclosureSection.tsx](src/components/DisclosureSection.tsx)) is the shared collapse/expand wrapper used to keep lower-frequency features (Vision Board, Meet Up, Circle AI, Weekly Recap on Circle; the two Light Moments games on Connection) out of the primary view without deleting them — used so the core accountability loop (goals, garden, buddy, challenges, ask friends) stays visually dominant.
- **Animation**: built on `react-native-reanimated` + `expo-haptics`. `AnimatedPressable` ([src/components/AnimatedPressable.tsx](src/components/AnimatedPressable.tsx)) is the shared press-scale wrapper used on buttons/cards throughout the app. Cards on Goals/Circle/Connection stagger in with `FadeInDown` on load; the tab bar's active icon springs into a filled pill on focus change; `GardenTeaser`'s progress bar and `ProgressBar` both animate width with `withTiming`; `MilestoneCardModal` pops in with a staggered `ZoomIn`/`FadeIn` sequence instead of a flat modal fade. `TodayGoalsChecklist` checks off in two beats — the checkbox fills with an animated `ZoomIn` checkmark first, then the row exits via `FadeOutRight` ~550ms later, so the checkmark is actually seen before the row leaves. `ToggleSwitch` ([src/components/ToggleSwitch.tsx](src/components/ToggleSwitch.tsx)) is a spring-animated track/thumb switch (used for Circle Settings' per-category notification mutes) rather than a flat toggle button.
- **Loading states**: `Skeleton` + screen-specific shapes (`GoalCardSkeleton`, `EventRowSkeleton`, `AskCardSkeleton` in [src/components/Skeleton.tsx](src/components/Skeleton.tsx)) replace spinners on Goals/Today/Connection's primary lists — a looping opacity pulse, not a true shimmer sweep (no gradient-mask library in the project). Those same three screens also support pull-to-refresh via each list's React Query `isFetching`/`refetch`.
