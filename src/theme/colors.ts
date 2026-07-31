// Design tokens. Brand: warm orange ("Ember") + cream, with blue reserved as
// the one deliberate exception (Learning pillar only). As of the theming
// pass this file no longer exports one fixed palette - it defines accent
// ramps and light/dark neutral ramps, and resolveTheme() combines
// { accent, scheme } into the same theme shape every screen already
// consumes via useTheme().

// 'ember' is the original orange and the default - existing users see no
// change unless they pick otherwise.
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

export const accents: Record<AccentId, AccentRamp> = {
  ember: {
    primary: '#F97316',
    primarySoft: '#FB923C',
    secondary: '#FDBA74',
    pressed: '#C2410C',
    celebration: '#FF7A50',
    onAccent: '#FFFFFF',
    subtle: { light: '#FDECDD', dark: '#3B2513' },
  },
  garden: {
    primary: '#16A34A',
    primarySoft: '#22C55E',
    secondary: '#86EFAC',
    pressed: '#15803D',
    celebration: '#34D399',
    onAccent: '#FFFFFF',
    subtle: { light: '#DCFCE7', dark: '#14301F' },
  },
  dusk: {
    primary: '#6366F1',
    primarySoft: '#818CF8',
    secondary: '#C7D2FE',
    pressed: '#4F46E5',
    celebration: '#8B5CF6',
    onAccent: '#FFFFFF',
    subtle: { light: '#E0E7FF', dark: '#26264A' },
  },
};

// Order = display order in pickers; ember first because it's the default.
export const ACCENT_OPTIONS: { id: AccentId; label: string }[] = [
  { id: 'ember', label: 'Ember' },
  { id: 'garden', label: 'Garden' },
  { id: 'dusk', label: 'Dusk' },
];

interface NeutralRamp {
  background: string;
  surface: string;
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

const neutrals: Record<ResolvedScheme, NeutralRamp> = {
  light: {
    background: '#FBF7F2',
    surface: '#FFFFFF',
    textPrimary: '#2B1B10',
    // Darkened from #9C7A5E, which only hit ~3.7:1 against the app's light
    // backgrounds - below WCAG AA's 4.5:1. This shade hits ~5.7-6.1:1 while
    // staying in the same warm brown family.
    textSecondary: '#7A5C42',
    border: '#E4DFD1',
    pillBg: 'rgba(255,255,255,0.6)',
    // The warm-ink pair used specifically on the card-shell white background
    // (see ARCHITECTURE.md's "Card shell" note), tuned a touch lighter than
    // textPrimary/textSecondary for that context.
    shellBg: '#FFFEFA',
    shellTitle: '#22281F',
    shellSecondary: '#7A7A6E',
    overlay: 'rgba(0,0,0,0.4)',
    overlayStrong: 'rgba(0,0,0,0.9)',
    // Deliberately distinct from ember's primary - "success" is a generic
    // status color, not the health category, even though both read orange.
    success: '#D9600A',
    warning: '#F59E0B',
    // Red stays red regardless of accent: error/danger must stand apart to
    // keep its urgency legible.
    danger: '#EF4444',
    amber: '#F59E0B',
    shadowColor: '#2B1B10',
  },
  // Warm dark - desaturated browns rather than inverted values, so the
  // brand's warmth survives the flip. Text pairs checked against surface:
  // textPrimary ~13:1, textSecondary ~6:1.
  dark: {
    background: '#1C140D',
    surface: '#271D13',
    textPrimary: '#F5EDE3',
    textSecondary: '#C9AE93',
    border: '#43331F',
    pillBg: 'rgba(39,29,19,0.6)',
    shellBg: '#2B2117',
    shellTitle: '#EDE7DC',
    shellSecondary: '#B3A996',
    overlay: 'rgba(0,0,0,0.6)',
    overlayStrong: 'rgba(0,0,0,0.92)',
    success: '#F08A3C',
    warning: '#FBBF24',
    danger: '#F87171',
    amber: '#FBBF24',
    shadowColor: '#000000',
  },
};

// Per-pillar accent colors. Learning is the one pillar that keeps blue;
// everything else is a warm shade so icons carry the primary distinction
// between categories. These stay pinned to the brand hues rather than the
// user's accent - category identity shouldn't change when the accent does.
const categoryColorsByScheme: Record<
  ResolvedScheme,
  Record<'health' | 'wealth' | 'ideas' | 'learning' | 'relationships', { bg: string; text: string; solid: string }>
> = {
  light: {
    health: { bg: '#FDECDD', text: '#C2410C', solid: '#F97316' },
    wealth: { bg: '#FEF3C7', text: '#92400E', solid: '#FBBF24' },
    ideas: { bg: '#FBE4D5', text: '#9A3412', solid: '#C2410C' },
    learning: { bg: '#DBEAFE', text: '#1D4ED8', solid: '#60A5FA' },
    relationships: { bg: '#FFE1D6', text: '#C2410C', solid: '#E8623D' },
  },
  dark: {
    health: { bg: '#3B2513', text: '#FDBA74', solid: '#F97316' },
    wealth: { bg: '#3A2B08', text: '#FCD34D', solid: '#FBBF24' },
    ideas: { bg: '#38200F', text: '#FDA674', solid: '#E05B24' },
    learning: { bg: '#1E2A47', text: '#93C5FD', solid: '#60A5FA' },
    relationships: { bg: '#3D1F15', text: '#FCA98F', solid: '#E8623D' },
  },
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

// Type scale (design/REDESIGN.md §2.2). 13 is the floor - nothing smaller
// anywhere. Sizes pair with lineHeight; weights stay per-use.
export const type = {
  display: { fontSize: 32, lineHeight: 38 },
  title: { fontSize: 26, lineHeight: 32 },
  heading: { fontSize: 20, lineHeight: 26 },
  subheading: { fontSize: 17, lineHeight: 24 },
  body: { fontSize: 16, lineHeight: 24 },
  secondary: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 13, lineHeight: 18 },
} as const;

// Touch standards (design/REDESIGN.md §2.3): minimum interactive box,
// tappable list rows, chips.
export const touch = {
  min: 48,
  row: 56,
  chip: 48,
} as const;

// The garden's own palette - fixed nature hues that never follow the
// accent (the accent drives chrome and the hero's sky tint only), dimmed
// once centrally for dark mode.
const gardenByScheme: Record<
  ResolvedScheme,
  { leaf: string; leafDeep: string; soil: string; bloomWarm: string; bloomGold: string; wilt: string }
> = {
  light: {
    leaf: '#4CAF6D',
    leafDeep: '#2F7D4F',
    soil: '#8A6A4F',
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
    // here; padding/margin/gap stay per-component.
    cardShell: {
      backgroundColor: n.shellBg,
      borderWidth: 0.5,
      borderColor: n.border,
      borderRadius: 20,
      borderLeftWidth: 3,
      borderLeftColor: accent.primary,
    },
  };
}

export type Theme = ReturnType<typeof resolveTheme>;
