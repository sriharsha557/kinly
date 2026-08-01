# Kinly design principles

The contract every new screen follows. Established in the 2026-07 one-accent redesign
(see ARCHITECTURE.md's "2026-07 color pass" bullet for the change history).
`design/REDESIGN.md` remains the record of the earlier structural pass; where the two
disagree on color or Home hierarchy, this file wins.

## Feel

Calm, premium, friendly, trustworthy. The reference register is Calm / Headspace /
Notion: near-monochrome surfaces where a single accent means "you can act here".

## Color — the one-accent rule

- **All color comes from `useTheme()` tokens. No raw hex in components, ever.**
- Exactly one accent per theme (`colors.primary`, user-picked: Ember / Garden / Dusk).
  It marks interactive or selected elements only: primary buttons, selected chips,
  active nav item, links, progress fills, checkboxes.
- Everything at rest is neutral: `surface` for cards, `surfaceSubtle` for chips /
  inactive pills / progress tracks, `border` for hairlines, `textPrimary` /
  `textSecondary` for ink. Icons at rest are `textSecondary` (monochrome), never
  per-category hues.
- `inputBg` (accent-tinted subtle) is for text inputs only — not chips, not tracks.
- Status colors (`success`, `warning`, `danger`) are semantic, muted, and never
  decorative. The garden's nature palette (`theme.garden`) is the one sanctioned
  exception: fixed hues that never follow the accent.
- Dark mode desaturates; it never inverts. Check contrast per scheme (body text
  ≥ 4.5:1, secondary ≥ 3:1).

## Shape & space

- Radius scale: `radii` only — card 20, tile 24, hero 28, input 16, pill 999.
- Spacing: `spacing` tokens (4pt scale); `gutter` for screen insets, `section`
  between sections. No ad-hoc numbers.
- Cards: spread `cardShell` (1px `border` hairline, no shadow) or `surface` +
  `shadow` for the few elevated moments (hero, mission card). Never both, never a
  colored left strip.
- Type: `type` scale only, 13px floor. Weights: 700–800 headings, 600 labels,
  400–500 body. Hierarchy comes from size + whitespace, not color.

## Motion

- Micro-interactions 150–300ms; entrances stagger 50–70ms per item; springs
  (`withSpring`, damping 12–15) over linear curves.
- Press feedback via `AnimatedPressable` (scale 0.94) for content-sized elements;
  `TouchableOpacity` opacity is acceptable for flex-basis grid children it would
  break (stat tiles, mode pills).
- Every animation is caused by something (a check-in, a state change, a press) —
  nothing loops decoratively except the garden's idle sway.
- Always gate with `useReducedMotion()`.

## Hierarchy

- One primary action per screen (the single accent-filled element).
- Home order: greeting → garden state → today's mission → mood check-in →
  shortcuts → activity feed. Each section sets up the one below it.
- Feed/tertiary content: quiet rows, no card chrome, hairline separators.

## Iconography

- One family: the app's own prop-driven SVG components (`MonoIcons`, `PillarIcons`,
  `TabIcons`) tinted via theme tokens, plus the `assets/icons/**` SVG files, which
  are compiled to components by `react-native-svg-transformer` and take `SvgProps`.
- **No hardcoded colours in an SVG asset.** Every live asset's `fill`/`stroke` is
  `currentColor`, which `react-native-svg` resolves from the component's `color`
  prop — so an icon that renders without a `color` prop is a bug, not a default.
  Pass `colors.textSecondary` at rest and `colors.primary` when the icon marks
  something interactive or selected. (The unused assets under `assets/brand/` and
  the duplicate top-level `assets/icons/*.svg` still carry baked-in orange; they
  are dead and should be deleted rather than converted.)
- No emoji as icons.
- Nav: icons + labels, active = accent, inactive = `textSecondary`.

## Illustration system

Illustrations are **components, not assets** — drawn with `react-native-svg`
primitives and colored at runtime from theme tokens, so they re-tint with the
user's accent and scheme like every other surface.

- `src/components/illustrations/Scenes.tsx` — full-bleed narrative scenes
  (200-unit canvas, 5-unit stroke, soft `surfaceSubtle` backdrop circle).
- `src/components/icons/{MonoIcons,PillarIcons,TabIcons}.tsx` — glyphs
  (24-unit canvas, 1.7-unit stroke).

Rules for adding one: keep the canvas/stroke pair above so weights match at
render size; take ink from `textPrimary`, focal elements from `primary`, nature
elements from `theme.garden`; never hardcode a hex.

### Converted so far (2026-07)

The tutorial + circle-welcome carousels (6 scenes) and all three mood faces —
`MoodCheckinCard`'s circle grid and `TodayScreen`'s feed rows now render the
prop-driven `MonoIcons` versions instead of the fixed-orange asset imports.

### Still on static assets

`GardenStageArt`'s five plant stages and `GardenHero`'s three weather icons
(highest value remaining — the garden is the product's signature), plus the
feed/nudge/pillar glyphs in `assets/icons/` and the card illustrations in
`assets/illustrations/` (buddy, rocket, chat, calendar, idea bulb, dice). These
stay fixed-color through theme changes until converted. **Don't add new
hardcoded-color assets in the meantime.**
