# Kinly — Architecture Overview

Kinly is a React Native / Expo app for small private accountability circles ("Growth Circles" of 2-10 friends). This doc maps each screen to what it does and how it's wired up, so future work can find the right file fast.

## Stack

- **Navigation**: `@react-navigation` — root native-stack (`Onboarding`, `Main`, `CircleSettings`, `EditProfile`) wrapping a bottom-tabs navigator (`Today`, `Circle`, `Goals`, `Connection`, `Profile`). See [src/navigation/types.ts](src/navigation/types.ts), [src/navigation/MainTabs.tsx](src/navigation/MainTabs.tsx).
- **State**: Zustand `useAuthStore` holds the signed-in `user` and `activeCircleId` (a user can belong to multiple circles but only one is "active" at a time).
- **Server state**: TanStack React Query, one hook file per domain in `src/hooks/`, persisted to `AsyncStorage` for offline-first caching ([src/lib/persister.ts](src/lib/persister.ts)).
- **Backend**: Supabase — Postgres + RLS, Auth (email/password + Google OAuth), Storage (avatars, vision-board images), Edge Functions (nudge messages, notifications, weekly recap, circle AI, streak-at-risk cron).
- **Theme**: static tokens in [src/theme/colors.ts](src/theme/colors.ts) — `colors`, `categoryColors` (per interest pillar), `gradients`, `radii`, `shadow`. No dark mode yet (deliberately deferred).

## Screen map

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
Everything about "how is my circle doing," moved off Today to keep it uncluttered. All cards take `circleId`/`userId` and manage their own data:
- `GardenCard` — full detail view of per-member plant growth (derived, not stored — see `useGarden`), stages `wilted → seed → sprout → tree → bloom` from `streak_count`/`last_logged_date`.
- `BuddyCard` — accountability buddy pairing/check-ins (`useBuddy`).
- `ChallengesCard` — circle challenges with completion celebrations (`useChallenges`).
- `VisionBoardCard` — shared image board, uploads via `useVisionBoard` + `visionImageUpload.ts`.
- `MeetUpCard` — manual RSVP meet-up scheduling (`useMeetups`; no calendar integration).
- `CircleAICard` — AI-generated circle insight (`useCircleAI`, Edge Function `circle-ai-insight`).
- `WeeklyRecapCard` — AI weekly summary (`useWeeklyRecap`, Edge Function `weekly-recap`).
- Header "⚙️ Settings" link → `CircleSettingsScreen`.

### Goals — [src/screens/GoalsScreen.tsx](src/screens/GoalsScreen.tsx)
- `GoalSuggestions` — AI/heuristic goal ideas based on interests (`src/lib/suggestions.ts`), tap to customize and add.
- `AddGoalForm` — title, numeric target, optional category chip.
- Goal list (`FlatList`) of `GoalCard`s: progress bar, streak badge, "Log progress" button, "⋯" menu for edit/delete.
- Logging progress and celebration logic (goal-completed detection, streak-milestone detection at `[3,7,14,30,60,100]`, haptics, event + achievement writes) is centralized in `useLogGoalWithCelebration` — shared with `TodayGoalsChecklist` on the Today tab so both surfaces behave identically.
- Edit uses `EditGoalModal`; delete/edit both route through `useUpdateGoal` / `useDeleteGoal`.

### Connection (was "Ask Friends") — [src/screens/ConnectionScreen.tsx](src/screens/ConnectionScreen.tsx)
Async, lightweight social/play features plus the original Q&A, in one scroll:
- `DailyCircleCard` — one deterministic daily prompt per circle (hashed from `circleId+date`, no server call), answers hidden until you submit your own.
- `WouldYouRatherCard` — simple A/B poll, live vote % shown after voting.
- `GuessWhoCard` — anonymous-style fact guessing game (answer hidden client-side only, not RLS-enforced — accepted tradeoff).
- `CircleStoriesCard` — collaborative one-line-at-a-time story, auto-completes at 8 lines.
- **Ask Friends** — original question/reply feature: post a question (optionally tagged to one of your goals), circle members reply in an expandable thread; author can delete their own post.

### Profile — [src/screens/ProfileScreen.tsx](src/screens/ProfileScreen.tsx)
- Avatar (tap → `EditProfileScreen`), name, active circle name, bio.
- Stat tiles: goals completed, best streak, friends helped (`useProfileStats`), plus a shortcut tile to Circle Settings.
- Achievement badges — tapping one reopens its `MilestoneCardModal`.
- `FutureSelfCard` — AI "future self" reflection feature (`useFutureSelf`).
- Sign out.

### Edit Profile — [src/screens/EditProfileScreen.tsx](src/screens/EditProfileScreen.tsx)
Name, bio, avatar upload (`avatarUpload.ts` → Supabase Storage), interest pillars. Saves via `useUpdateProfile`.

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
