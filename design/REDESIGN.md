# Kinly UI Redesign — "The Living Garden"

Design direction + component specs for the touch/hierarchy/garden-hero
redesign. Written against the current four tabs (Today, Circle, Goals,
Connection). Accent references are **theme tokens, never hex** — this spec
assumes the `theming` branch's accent-ramp system (ember/garden/dusk +
light/dark); on plain `main`, the same token names resolve from the static
theme, so nothing here depends on which lands first.

---

## 1. Design rationale

**The pitch: a garden you tend together.** Kinly's differentiator is not
habit tracking (commodity) — it's that your consistency is *visible to
people you love, as a living thing you grow jointly*. The current UI inverts
this: the emotional core (garden) is a 68px corner sprite and a percentage,
while a flat stat block shouts loudest. Generic habit-tracker chrome, small
gray metadata, and a stack of equal-weight white cards flatten everything to
the same volume.

Three moves fix it:

1. **Garden becomes the hero surface** — a full-width living illustration at
   the top of Today. It *is* the status display: you read your circle's day
   the way you glance at a windowsill, not a dashboard. Numbers demote to a
   caption inside it.
2. **One primary action per screen** — mood check-in on Today, presented as
   an inviting strip directly under the garden, not one card among seven.
3. **Three explicit hierarchy levels** (§4) replace the uniform card stack —
   quiet things get visually quiet (no card chrome at all), so loud things
   can be loud without adding noise.

**Mood words**: warm, hand-tended, alive, gentle. **Anti-mood**: dashboard,
corporate, gamified-badge-wall. The existing warm cream/brown neutrals and
the illustration set (`assets/illustrations/kinly-ill-*`) already carry this
— the redesign leans on them harder instead of introducing a new visual
language. (Design-DB direction check: wellness/soft-UI, rounded friendly
type, "avoid low contrast" — adopted; neumorphism's embossed surfaces
rejected for its known contrast/a11y cost.)

**Themeability rule**: the garden's *foliage and soil never change with the
accent* — nature stays nature-colored (fixed green/soil ramp below). The
accent drives UI chrome only: buttons, links, progress, selection, and the
hero's *sky tint* (`colors.inputBg`, the accent-subtle token). This keeps
every accent choice coherent without three hand-tuned gardens.

Garden fixed palette (light / dark):
`leaf #4CAF6D / #5BBF7E · leafDeep #2F7D4F / #3E9663 · soil #8A6A4F / #5C4632 ·
bloomWarm #FF8FA3 · bloomGold #FFD166 · wilt #A8A08F` — these live in the
theme as a `garden` token group so dark mode dims them once, centrally.

---

## 2. Foundations

### 2.1 Spacing scale (add as `theme.spacing`)

4pt system. Names, not numbers, in components.

| Token | dp | Use |
|---|---|---|
| `xs` | 4 | icon↔label gap |
| `sm` | 8 | chip gaps, tight stacks |
| `md` | 12 | intra-card element gap |
| `lg` | 16 | card padding (dense), list gaps |
| `xl` | 20 | **screen gutter**, card padding (default) |
| `xxl` | 24 | hero padding |
| `section` | 32 | between sections (was 16–24 → cramped) |
| `hero` | 40 | above/below the hero block |

Cards breathe: default card padding 20 (was 14–16), gap between sibling
cards 16, gap between *sections* 32 with the section title owning 12 below.

### 2.2 Type scale (add as `theme.type`)

Current UI runs on 11–14px with 22–24 titles — too much small gray. New
scale (RN `fontSize`/`lineHeight`, weights in parens):

| Token | Size/LH | Weight | Use |
|---|---|---|---|
| `display` | 32/38 | 800 | Greeting, celebration moments |
| `title` | 26/32 | 800 | Screen titles (was 24) |
| `heading` | 20/26 | 700 | Section titles (was 18) |
| `subheading` | 17/24 | 600–700 | Card titles (was 14–16) |
| `body` | 16/24 | 400–600 | Default text (was 13–14) |
| `secondary` | 14/20 | 500 | Supporting text (was 12–13) |
| `caption` | 13/18 | 600 | **Floor.** Meta, timestamps (was 10–12) |

Rules: nothing below 13. Gray text (`textSecondary`) only at `secondary`+
sizes and only for genuinely secondary content — never for the only copy
that explains an action. Numbers in stats use `fontVariant:
['tabular-nums']`.

### 2.3 Touch standards

- Minimum interactive box **48×48dp** (Android baseline; exceeds Apple's
  44pt). `hitSlop` is a patch for icons inside larger rows, never the
  primary strategy.
- List rows that are tappable: `minHeight: 56`.
- Chips/segmented options: `minHeight: 48`, horizontal padding ≥16.
- ≥8dp between adjacent targets.
- Text-only links (currently ~17dp tall) are banned as tap targets —
  everything becomes a pill, a row, or gains `minHeight: 48` + centered
  alignment.
- Every target: pressed feedback within 100ms (existing `AnimatedPressable`
  scale 0.97 + opacity), `accessibilityRole`, and a label when icon-only.

### 2.4 Shape & elevation

Keep the existing organic radius family (20/24/pill) and flat card-shell
with its accent left rib — it's already distinctive. Hero gets `borderRadius:
28` and sits *behind* the safe area top inset (full-bleed feel). Only three
elevation levels exist: hero (soft, wide shadow), card (current `shadow`),
flat (none — tertiary).

---

## 3. Touch-target audit (current code, measured)

Violations of 48dp, with file:line and the fix:

| # | Element | Where | Current | Fix |
|---|---|---|---|---|
| 1 | Mission/checklist row | `TodayGoalsChecklist.tsx` row (checkbox 22, no minHeight) | ~24dp | Row `minHeight 56`, checkbox 28 |
| 2 | Nudge icon buttons | `TodayScreen.tsx` `nudgeButton` 44×44 | 44 | 48×48 |
| 3 | "Water their streak" | `TodayScreen.tsx` `waterButton` pv8 | ~33 | `minHeight 48` |
| 4 | "Load more" | `TodayScreen.tsx` pv10 | ~37 | `minHeight 48` |
| 5 | "View Garden →" text link | `GardenTeaser.tsx` | ~18 | whole hero tappable + explicit pill |
| 6 | "Log progress" button | `GoalsScreen.tsx` `logButton` pv6/fs12 | ~29 | pill `minHeight 48`, `secondary` type |
| 7 | Camera (photo log) | `GoalsScreen.tsx` icon 18 + hitSlop 13 | 44 | 48 box, 22 icon |
| 8 | "⋯" options | `GoalsScreen.tsx` / `ConnectionScreen.tsx` hitSlop 12 | ~42 | 48 box |
| 9 | Category chips | `GoalsScreen.tsx` `minHeight 34`; `InterestPicker` similar | 34 | 48 |
| 10 | Add-goal inputs/button | `GoalsScreen.tsx` pv10 | ~40 | `minHeight 52` |
| 11 | "+ New" challenge | `ChallengesCard.tsx` text link fs13 | ~18 | icon-pill 48 |
| 12 | "Log progress" challenge link | `ChallengesCard.tsx` fs12 | ~17 | pill `minHeight 48` |
| 13 | "Change buddy" | `BuddyCard.tsx` fs12 link | ~17 | row `minHeight 48` |
| 14 | Circle switcher chips | `CircleScreen.tsx` pv9 | ~35 | 48 |
| 15 | "Settings" header link | `CircleScreen.tsx` fs13 | ~18 | 48 box |
| 16 | Goal chips (composer) | `ConnectionScreen.tsx` pv6 | ~26 | 44–48 |
| 17 | Post / reply Send | `ConnectionScreen.tsx` pv8 | ~33 | `minHeight 48` |
| 18 | "Discuss/Hide" expander | `ConnectionScreen.tsx` footer text | ~17 | whole card header row 56 |
| 19 | Mood tag chips | `MoodCheckinCard.tsx` pv9 | ~36 | 48 |
| 20 | Privacy / Delete links | `ProfileScreen.tsx` | ~17 | rows `minHeight 48` |

Already compliant (keep): `PillButton` (pv16 ≈ 52), `QuickActionsRow`
(pv14 + icon), `DisclosureSection` header (~47 → bump pv to 15),
mood faces (pv20 + 30px icon ≈ 70 — and they grow in the new check-in
strip), tab bar (system).

---

## 4. Hierarchy system + per-screen spec

Three levels, visually enforced:

- **P — Primary (max 1–2 per screen)**: full-width, illustrated or
  gradient, `heading`+ type, the only elements allowed decoration.
- **S — Secondary**: card shell (white/rib). Titles at `subheading`.
- **T — Tertiary**: *no card chrome.* Plain rows on the screen background
  with 0.5dp separators, `secondary` type, or folded behind
  `DisclosureSection`. This is the big de-noising move: the activity feed
  stops being a wall of white cards.

### Today (the redesign's center)

Top → bottom:

1. **P1 — GardenHero** (§5). Full-bleed, ~40% of viewport height. Contains
   the *only* status copy: one `body` line ("6/8 checked in today ·
   12-day streak") and, on first encounter, the ConceptHint explainer.
   The old `100%` display number is **deleted**; health lives in the
   garden's state itself, with the percentage available at `caption` size
   inside the hero footer for those who want it.
2. **P2 — Mood check-in strip**: "How are you today, {name}?" at
   `subheading`, three faces at 64dp in a row with 16dp gaps. Collapses
   to a quiet confirmation row (T) once answered.
3. **S — Today's Mission**: the social checklist (rows 56dp, collective
   context at `secondary` not `caption`).
4. **T — Quick actions** (unchanged row) and **Circle Activity**: flat
   rows — icon 24, `body` text, `caption` time — separators only, nudge
   actions revealed on row tap rather than six always-visible buttons per
   event (kills ~200dp of chrome per screen and the 44dp button grid).

Greeting stays at top but as `display` warmth, not a card.

### Circle

1. **P — Garden, detail mode**: same GardenHero component, `variant="tend"`
   — taller, each member plant labeled and tappable (§5.4). This replaces
   `GardenCard`'s 36px sprite row.
2. **S — Accountability Buddy** and **Circle Challenges** cards (48dp
   controls per audit).
3. **T — "More for your circle"** disclosure (unchanged content).

### Goals

1. **P — none.** A work screen; the title row + "collective today" line
   ("3 friends checked in today") is the only accent moment.
2. **S — Goal cards**: title `subheading`, progress bar 8dp, own progress
   + collective signal on one `secondary` line, Log = 48dp pill. Streak
   shown as leaf icon + count (garden vocabulary, not 🔥).
3. **T — Add goal**: collapsed to a single 52dp "+ Plant a new goal" row
   that expands the form (removes the always-open form cramping the top).

### Connection

1. **P — Connection Moments prompt** (DailyCircleCard): today's prompt at
   `heading`, answer input 52dp.
2. **S — Ask Friends** composer + threads (48dp targets per audit).
3. **T — Light Moments** disclosure (unchanged placement).

---

## 5. GardenHero — component spec

One component, two variants: `overview` (Today) and `tend` (Circle).
Replaces `GardenTeaser` + `GardenCard`. Data: existing `useGardenState`
(members, stages, streaks, health) + `useGoals` (checked-in-today) — no new
queries, no schema changes.

### 5.1 Layout

```
┌──────────────────────────────────────┐ radius 28, full-bleed width
│  sky: accent-subtle → background     │ vertical gradient (themeable)
│            [sun / sun-cloud /        │ weather = circle state
│                     rain-cloud]      │
│   🌷    🌱    🌳    (droop)   🌸      │ member plants, baseline row
│   Amit  You   Meera  Sara   Ravi    │ caption 13, tabular streak "12d"
│ ─────────── soil band ───────────── │ soil token, height 24
│  Circle Garden                      │ subheading
│  "Every check-in grows your         │ ConceptHint (first run only)
│   shared garden."                   │
│  6/8 checked in today · 12-day      │ body; (72% · caption, trailing)
│  streak · 1 friend needs water      │
└──────────────────────────────────────┘
```

- Plant slot: 56dp art in a **64dp tap target**, ≥12dp apart; 2–10 members
  scale art 64→44 with horizontal scroll past 6.
- `overview`: whole hero tappable → Circle tab. `tend`: plants individually
  tappable (§5.4).
- Existing assets cover every state: `sprout-soil`, `bud`, `small-tree`,
  `flower`, `daisy`, `wilted`, `sun`, `sun-cloud`, `rain-cloud`,
  `water-drop`, `butterfly`, `leaf-*`.

### 5.2 States

**Per-member** (existing `stageFor()` logic, unchanged): `seed` →
`sprout` (3d streak) → `tree` (14d) → `bloom` (30d); `wilted` when >3 days
quiet. Wilted renders as **drooping**: rotate −8°, 45% desaturation, one
fallen leaf at base — *not* dead; recoverable by design.

**Circle-level** (drives sky, weather, copy):

| State | Condition (health) | Sky/weather | Status copy |
|---|---|---|---|
| **Thriving** | ≥80 | bright, `sun`, ambient butterfly | "Everyone is thriving today." |
| **Growing** | 40–79 | soft, `sun-cloud` | "Your garden is growing steadily." |
| **Needs care** | 1–39 | muted, `rain-cloud` above the droopiest plant | "{name} could use some water." |
| **Dormant** | 0 / empty | dawn tint, single seed center | "Log a goal to plant your first seed." |

### 5.3 Micro-animations (reanimated; all interruptible, none block input)

| Moment | Trigger | Animation | Spec |
|---|---|---|---|
| **Sprout pop** | own/other check-in lands | plant scales in with overshoot; two leaves unfurl staggered | scale 0→1.06→1 spring (damping 12, stiffness 160); leaf rotate −20°→0 +40ms stagger; light haptic on own check-in |
| **Bloom** | streak milestone (14d/30d) event | petals scale+fan from center, 5 gold particles drift up and fade | petal scale 0→1 spring, 40ms stagger; particles translateY −24, opacity→0, 800ms ease-out; plays once per event |
| **Droop** | member crosses wilt threshold (on data refresh) | slow lean + desaturate | rotate 0→−8°, 600ms ease-in-out; saturation via crossfade to muted art variant |
| **Watering** | tap droopy plant → "Send water" | `water-drop` arcs from tap point to plant root (500ms bezier), soil darkens briefly, plant eases upright + color returns | rotate −8→0 spring (damping 14); drop scale 1→0 on land; success haptic |
| **Weather change** | circle state transition | crossfade sun/cloud 400ms + sky gradient interpolation | never animates on mount — only on live change |
| **Ambient sway** | idle, thriving/growing | ±1.5° rotation loop per plant, phase-offset | 3s ease-in-out loop; butterfly path every ~20s |
| **Hero entrance** | screen mount | one FadeInDown 400ms for the whole hero | plants do NOT individually animate on mount (data display, not an event) |

**Reduced motion** (`useReducedMotion()`): kill sway, particles, butterfly,
and arc — state changes become 150ms crossfades. All state info is
duplicated in text (status line) so nothing is animation-only. Performance:
transforms/opacity only; loops paused when screen unfocused
(`useIsFocused`); ≤10 plants keeps this trivially under frame budget.

### 5.4 Tend interactions (Circle variant)

Tap a plant → anchored popover card (S-level): member name `subheading`,
stage + streak `secondary`, last check-in `caption`, and **one** contextual
action (48dp pill):

- Droopy + within the streak-save grace window (existing `water_streak`
  server rule): **"💧 Send water"** → existing streak-save flow + watering
  animation.
- Droopy, outside window: **"Send a cheer"** → existing nudge flow.
- Healthy: **"Cheer them on"** → nudge.

Never notifies anyone outside the circle; all actions are existing
mutations — this is presentation only.

### 5.5 Coined-name explainers

`ConceptHint` (from the ui-clarity branch) renders the one-liner under each
coined title on first encounter, dismissible, persisted per concept:
Circle Garden · Thriving · Accountability Buddy · Circle Challenges ·
Connection Moments · Light Moments. If that branch hasn't merged, the
component spec travels with this redesign — it's a hard requirement here.

---

## 6. Implementation order (each step shippable)

1. **Foundations**: add `spacing` + `type` (+ `garden` colors) token groups
   to the theme; no visual change yet.
2. **Touch pass**: fix audit items 1–20 (mechanical, low risk).
3. **Type/spacing pass**: apply scale per §2 across the four screens.
4. **Hierarchy pass**: Today reorder + tertiary flattening of the feed.
5. **GardenHero**: build static states → entrance/press → event
   animations → tend popover; retire `GardenTeaser`/`GardenCard`.

Pre-ship checks: both themes × 3 accents, smallest device (375×667),
Dynamic Type at large, reduced-motion on, all targets ≥48dp (enable
"Pointer location" overlay on Android to verify).
