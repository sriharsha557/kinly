// Brand: orange + white/cream, with blue reserved as the one deliberate
// exception (Learning pillar only). Every other category is a shade of
// orange rather than its own hue - consolidated from an earlier palette
// that had scattered a different color per screen (navy login, teal home).
export const colors = {
  primary: '#F97316',
  primarySoft: '#FB923C',
  secondary: '#FDBA74',
  celebration: '#FF7A50',
  amber: '#F59E0B',

  background: '#FBF7F2',
  surface: '#FFFFFF',
  inputBg: '#FDECDD',

  textPrimary: '#2B1B10',
  // Darkened from #9C7A5E, which only hit ~3.7:1 against the app's light
  // backgrounds (surface/background/card shell) - below WCAG AA's 4.5:1 for
  // normal text. This shade hits ~5.7-6.1:1 while staying in the same warm
  // brown family.
  textSecondary: '#7A5C42',

  // Deliberately distinct from primary/health.solid (#F97316) - "success" is a
  // generic status color, not the health category, even though both read orange.
  success: '#D9600A',
  warning: '#F59E0B',
  // Red stays red: the one deliberate exception besides Learning-blue, since
  // error/danger needs to stand apart from an otherwise all-orange UI to keep
  // its urgency legible.
  danger: '#EF4444',

  pillBg: 'rgba(255,255,255,0.6)',
} as const;

// Per-pillar accent colors (health/investments/ideas/learning/relationships).
// Learning is the one pillar that keeps blue; everything else is a distinct
// shade of orange so icons/emoji carry the primary distinction between
// categories, with color as secondary reinforcement.
export const categoryColors = {
  health: { bg: '#FDECDD', text: '#C2410C', solid: '#F97316' },
  wealth: { bg: '#FEF3C7', text: '#92400E', solid: '#FBBF24' },
  ideas: { bg: '#FBE4D5', text: '#9A3412', solid: '#C2410C' },
  learning: { bg: '#DBEAFE', text: '#1D4ED8', solid: '#60A5FA' },
  // solid deliberately distinct from colors.celebration (#FF7A50) - relationships
  // is a category identity, not the same token as a celebration moment.
  relationships: { bg: '#FFE1D6', text: '#C2410C', solid: '#E8623D' },
} as const;

export const gradients = {
  hero: [colors.celebration, colors.primarySoft] as const,
  achievement: [colors.amber, colors.celebration] as const,
  growth: [categoryColors.health.solid, colors.success] as const,
  // The one place blue still appears alongside orange - Learning meeting
  // Ideas is a deliberate accent, not a lapse in the orange-first rule.
  inspiration: [categoryColors.ideas.solid, categoryColors.learning.solid] as const,
  brand: [colors.primary, colors.primarySoft] as const,
};

export const radii = {
  card: 20,
  tile: 24,
  input: 16,
  pill: 999,
} as const;

export const shadow = {
  shadowColor: '#2B1B10',
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

// The flat white-shell card treatment (see ARCHITECTURE.md's "Card shell"
// note) - was hand-duplicated identically across ~10 files, which is how
// the MoodCheckinCard/QuickActionsRow radii.card-on-a-small-button bug
// happened twice. Only the border/color/radius properties that never vary
// are here; padding/marginBottom/gap stay per-component since those
// genuinely differ by content density (a small suggestion chip vs. a full
// card). Spread this first, then add layout-specific properties after.
export const cardShell = {
  backgroundColor: '#FFFEFA',
  borderWidth: 0.5,
  borderColor: '#E4DFD1',
  borderRadius: 20,
  borderLeftWidth: 3,
  borderLeftColor: colors.primary,
} as const;
