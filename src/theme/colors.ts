// Design tokens. Brand: warm orange ("Ember") + cream, with blue reserved as
// the one deliberate exception (Learning pillar only). As of the theming
// pass this file no longer exports one fixed palette - it defines accent
// ramps and light/dark neutral ramps, and resolveTheme() combines
// { accent, scheme } into the same theme shape every screen already
// consumes via useTheme().

// 'dusk' is the default (the calm muted indigo the app opens on); 'ember'
// is the original orange, kept as a choice rather than the starting point.
export type AccentId = 'ember' | 'garden' | 'dusk';
// 'system' follows the OS via useColorScheme(). A future "dim" mode slots
// in here as a third resolved scheme, not a new mechanism.
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedScheme = 'light' | 'dark';

interface AccentRamp {
  primary: string;
  primarySoft: string;
  secondary: string;
  pressed: string;
  celebration: string;
  onAccent: string;
  // The accent-tinted fill used for inputs/chips (was the hardcoded cream
  // #FDECDD) - needs a per-scheme value so tinted surfaces stay subtle on
  // dark backgrounds instead of glowing.
  subtle: Record<ResolvedScheme, string>;
}

// Muted, wellness-calibrated ramps (2026-07 color pass): the originals were
// saturated UI-kit hues (#F97316/#16A34A/#6366F1) that read loud against the
// warm neutral base. Same three identities, dialed down.
export const accents: Record<AccentId, AccentRamp> = {
  ember: {
    primary: '#C97B4A',
    primarySoft: '#D69268',
    secondary: '#E9C4A8',
    pressed: '#A05E35',
    celebration: '#D98B5F',
    onAccent: '#FFFFFF',
    subtle: { light: '#F5E9DE', dark: '#3A2A1C' },
  },
  garden: {
    primary: '#5A8A6A',
    primarySoft: '#74A183',
    secondary: '#AECBB8',
    pressed: '#466F55',
    celebration: '#6FA57F',
    onAccent: '#FFFFFF',
    subtle: { light: '#E6EFE8', dark: '#1B2C21' },
  },
  dusk: {
    primary: '#6B6FC9',
    primarySoft: '#8A8DD8',
    secondary: '#C0C2E9',
    pressed: '#53569E',
    celebration: '#7E82D4',
    onAccent: '#FFFFFF',
    subtle: { light: '#E9EAF7', dark: '#26264A' },
  },
};

// Order = display order in pickers; dusk first because it's the default.
export const ACCENT_OPTIONS: { id: AccentId; label: string }[] = [
  { id: 'dusk', label: 'Dusk' },
  { id: 'garden', label: 'Garden' },
  { id: 'ember', label: 'Ember' },
];

interface NeutralRamp {
  background: string;
  surface: string;
  // Accent-free quiet fill for chips, inactive pills, and progress tracks -
  // distinct from the accent-tinted `subtle` ramp so resting UI stays
  // neutral no matter which accent is active.
  surfaceSubtle: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  pillBg: string;
  shellBg: string;
  shellTitle: string;
  shellSecondary: string;
  overlay: string;
  overlayStrong: string;
  success: string;
  warning: string;
  danger: string;
  amber: string;
  shadowColor: string;
}

// Warm gray neutrals (2026-07 color pass): the previous ramp was overtly
// brown (#2B1B10/#7A5C42), which made every icon and secondary label read
// as a fourth "color" next to the accent. These stay warm but neutral, so
// only the accent carries hue.
const neutrals: Record<ResolvedScheme, NeutralRamp> = {
  light: {
    background: '#FAF7F2',
    surface: '#FFFFFF',
    surfaceSubtle: '#F3EFE8',
    textPrimary: '#2A2724',
    // ~5.2:1 on background, ~5.7:1 on surface - keeps WCAG AA while
    // dropping the brown cast.
    textSecondary: '#6E6861',
    border: '#E8E2D9',
    pillBg: 'rgba(255,255,255,0.6)',
    // The warm-ink pair used specifically on the card-shell white background
    // (see ARCHITECTURE.md's "Card shell" note), tuned a touch lighter than
    // textPrimary/textSecondary for that context.
    shellBg: '#FFFEFA',
    shellTitle: '#2A2724',
    shellSecondary: '#6E6861',
    overlay: 'rgba(0,0,0,0.4)',
    overlayStrong: 'rgba(0,0,0,0.9)',
    // Muted garden green - success is a generic status color, deliberately
    // calmer than the old saturated orange it replaced.
    success: '#4C8C5C',
    warning: '#C4913C',
    // Softened red-clay danger: still unmistakably "error", without the
    // alarm-red saturation of #EF4444.
    danger: '#C24E42',
    amber: '#C4913C',
    shadowColor: '#2A2724',
  },
  // Warm dark - desaturated, not inverted, so the brand's warmth survives
  // the flip. Text pairs checked against surface: textPrimary ~13:1,
  // textSecondary ~6:1.
  dark: {
    background: '#191512',
    surface: '#241F1A',
    surfaceSubtle: '#2E2822',
    textPrimary: '#F2EDE7',
    textSecondary: '#A89F94',
    border: '#3A332C',
    pillBg: 'rgba(36,31,26,0.6)',
    shellBg: '#262019',
    shellTitle: '#EDE8E1',
    shellSecondary: '#A89F94',
    overlay: 'rgba(0,0,0,0.6)',
    overlayStrong: 'rgba(0,0,0,0.92)',
    success: '#7FB08C',
    warning: '#D9A75A',
    danger: '#D97B6C',
    amber: '#D9A75A',
    shadowColor: '#000000',
  },
};

// Per-pillar colors, now deliberately monochrome (2026-07 color pass): five
// differently-hued pillar icons on one screen were the single biggest source
// of "too many colors". Category identity comes from the icon shape and
// label; selection state comes from the user's accent. The record shape is
// kept per-category so a future art pass can re-differentiate without
// touching consumers.
const CATEGORY_KEYS = ['health', 'wealth', 'ideas', 'learning', 'relationships'] as const;

const categoryTint: Record<ResolvedScheme, { bg: string; text: string; solid: string }> = {
  light: { bg: '#F3EFE8', text: '#6E6861', solid: '#8A8177' },
  dark: { bg: '#2E2822', text: '#A89F94', solid: '#A89F94' },
};

const categoryColorsByScheme: Record<
  ResolvedScheme,
  Record<(typeof CATEGORY_KEYS)[number], { bg: string; text: string; solid: string }>
> = {
  light: Object.fromEntries(CATEGORY_KEYS.map((k) => [k, categoryTint.light])) as Record<
    (typeof CATEGORY_KEYS)[number],
    { bg: string; text: string; solid: string }
  >,
  dark: Object.fromEntries(CATEGORY_KEYS.map((k) => [k, categoryTint.dark])) as Record<
    (typeof CATEGORY_KEYS)[number],
    { bg: string; text: string; solid: string }
  >,
};

export const radii = {
  card: 20,
  tile: 24,
  hero: 28,
  input: 16,
  pill: 999,
} as const;

// 4pt spacing scale (design/REDESIGN.md §2.1). Components use names, not
// numbers - `gutter` is the horizontal screen inset, `section` the gap
// between sections.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
  hero: 40,
  gutter: 20,
} as const;

// Inter, embedded natively via the expo-font config plugin (see app.json).
//
// These are referenced by *family name per weight*, never as one family plus
// a `fontWeight`, and the font files are deliberately named to match their
// PostScript names. The reason is Inter's name table: only Regular and Bold
// live in the "Inter" family: Medium and SemiBold register as their own
// legacy families ("Inter Medium", "Inter SemiBold") because the classic
// name table holds four styles per family at most. So on iOS,
// `fontFamily: 'Inter'` + `fontWeight: '600'` silently resolves to Regular
// or Bold rather than SemiBold.
//
// Naming each file after its PostScript name sidesteps that on both
// platforms at once: Android derives a font family from the file name, iOS
// reads the PostScript name, and here those are the same string.
//
// Consequence for call sites: set `fontFamily` and do NOT also set
// `fontWeight`. A `fontWeight` next to an explicit family is at best ignored
// and at worst synthesises a fake bold on top of a real one.
export const fontFamily = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
} as const;

// Type scale (design/REDESIGN.md §2.2). 13 is the floor - nothing smaller
// anywhere. Sizes pair with lineHeight; each step also carries the family it
// should be set in, so `...type.heading` is a complete text style rather than
// something every call site has to finish by hand.
//
// Steps default to the weight that step is usually set in - override by
// spreading a different family after the step (`...type.body,
// fontFamily: fontFamily.semibold`), never by adding a fontWeight.
export const type = {
  display: { fontSize: 32, lineHeight: 38, fontFamily: fontFamily.bold },
  title: { fontSize: 26, lineHeight: 32, fontFamily: fontFamily.bold },
  heading: { fontSize: 20, lineHeight: 26, fontFamily: fontFamily.semibold },
  subheading: { fontSize: 17, lineHeight: 24, fontFamily: fontFamily.semibold },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.regular },
  secondary: { fontSize: 14, lineHeight: 20, fontFamily: fontFamily.regular },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
} as const;

// Touch standards (design/REDESIGN.md §2.3): minimum interactive box,
// tappable list rows, chips.
export const touch = {
  min: 48,
  row: 56,
  chip: 48,
} as const;

// Motion scale. Before this existed, timings were picked per call site and
// the app had drifted to 6 durations (150/200/250/300/350/400), 4 stagger
// steps (30/50/60/70) and 6 entrance dampings (9/10/12/13/14/15) - the
// vocabulary was already consistent (FadeInDown for arrivals, ZoomIn for
// celebrations), only the timing wasn't.
//
// Scope note: these cover *transitions and entrances* - the shared grammar
// of "something arrived / changed / left". They deliberately do NOT cover
// indeterminate or signature animation, which is per-component by nature
// and would be flattened by a shared scale: LoadingSpinner's chase,
// Skeleton's pulse, ProgressBar's fill, ToggleSwitch's spark burst and
// GardenHero's sway all keep their own timing.
export const motion = {
  duration: {
    // Exits and dismissals. Leaving should always be faster than arriving.
    quick: 150,
    // Most state changes: overlays fading in, a value settling, a section
    // disclosing.
    base: 200,
    // Cards and list rows arriving. Longer than `base` on purpose - an
    // entrance is the one moment where the motion is the message.
    entrance: 320,
  },
  // Per-item delay in a staggered list, and the cap on how many items keep
  // staggering. Without the cap a 30-item list makes the last row wait
  // nearly two seconds; every screen that staggers already capped it by
  // hand at 6, so that convention is now the token.
  stagger: { step: 60, maxItems: 6 },
  // withSpring() configs, for values driven imperatively.
  spring: {
    // AnimatedPressable's press-in/press-out pair. Asymmetric on purpose:
    // the press bites quickly, the release settles.
    pressIn: { damping: 15, stiffness: 300 },
    pressOut: { damping: 12, stiffness: 200 },
    // A value coming to rest - the tab bar's focused-icon scale.
    settle: { damping: 14, stiffness: 220 },
  },
  // Damping for `.springify()` entering animations, which take damping
  // alone rather than a full config.
  damping: {
    // Standard arrival with a little life in it.
    pop: 14,
    // Reserved for genuine celebrations (milestone cards, the check-off
    // checkmark) - looser, so it overshoots more visibly.
    celebrate: 10,
  },
} as const;

// The garden's own palette - fixed nature hues that never follow the
// accent (the accent drives chrome and the hero's sky tint only), dimmed
// once centrally for dark mode.
const gardenByScheme: Record<
  ResolvedScheme,
  { leaf: string; leafDeep: string; soil: string; bloomWarm: string; bloomGold: string; wilt: string }
> = {
  light: {
    leaf: '#5FA57C',
    leafDeep: '#3E7D58',
    soil: '#A08B77',
    bloomWarm: '#FF8FA3',
    bloomGold: '#FFD166',
    wilt: '#A8A08F',
  },
  dark: {
    leaf: '#5BBF7E',
    leafDeep: '#3E9663',
    soil: '#5C4632',
    bloomWarm: '#FF8FA3',
    bloomGold: '#FFD166',
    wilt: '#8A8272',
  },
};

export function resolveTheme(accentId: AccentId, scheme: ResolvedScheme) {
  const accent = accents[accentId];
  const n = neutrals[scheme];

  return {
    scheme,
    accentId,
    colors: {
      primary: accent.primary,
      primarySoft: accent.primarySoft,
      secondary: accent.secondary,
      primaryPressed: accent.pressed,
      celebration: accent.celebration,
      inputBg: accent.subtle[scheme],

      // Text/fills that sit on top of an accent-colored surface (gradient
      // cards, solid buttons). White for every current accent and scheme -
      // tokenized so a future accent with a light primary can flip it.
      onAccent: accent.onAccent,
      onAccentMuted: 'rgba(255,255,255,0.88)',
      onAccentFaint: 'rgba(255,255,255,0.65)',
      onAccentTint: 'rgba(255,255,255,0.3)',
      onAccentGlaze: 'rgba(255,255,255,0.15)',

      background: n.background,
      surface: n.surface,
      surfaceSubtle: n.surfaceSubtle,
      textPrimary: n.textPrimary,
      textSecondary: n.textSecondary,
      border: n.border,
      pillBg: n.pillBg,
      shellTitle: n.shellTitle,
      shellSecondary: n.shellSecondary,
      overlay: n.overlay,
      overlayStrong: n.overlayStrong,
      success: n.success,
      warning: n.warning,
      danger: n.danger,
      amber: n.amber,
    },
    categoryColors: categoryColorsByScheme[scheme],
    garden: gardenByScheme[scheme],
    spacing,
    type,
    touch,
    motion,
    gradients: {
      hero: [accent.celebration, accent.primarySoft] as const,
      achievement: [n.amber, accent.celebration] as const,
      growth: [accent.primary, n.success] as const,
      brand: [accent.primary, accent.primarySoft] as const,
    },
    radii,
    shadow: {
      shadowColor: n.shadowColor,
      shadowOpacity: scheme === 'light' ? 0.08 : 0.3,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    // The flat card-shell treatment (see ARCHITECTURE.md's "Card shell"
    // note). Only the border/color/radius properties that never vary are
    // here; padding/margin/gap stay per-component. The accent left-strip
    // was dropped in the 2026-07 color pass - every card carried a colored
    // edge, which multiplied the accent across the whole screen.
    cardShell: {
      backgroundColor: n.shellBg,
      borderWidth: 1,
      borderColor: n.border,
      borderRadius: 20,
    },
  };
}

export type Theme = ReturnType<typeof resolveTheme>;
