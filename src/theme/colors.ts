// Brand: deep navy-indigo primary + coral-orange accent, teal for success/completion states.
export const colors = {
  primary: '#3D3A8C',
  primarySoft: '#5750B0',
  secondary: '#2FBF9B',
  celebration: '#FF7A50',
  amber: '#F59E0B',

  background: '#F1F1F6',
  surface: '#FFFFFF',
  inputBg: '#ECECF5',

  textPrimary: '#1F2140',
  textSecondary: '#8A8FA3',

  // Deliberately distinct from secondary/health.solid (#2FBF9B) - "success" is a
  // generic status color, not the health category, even though both read as teal.
  success: '#149C74',
  warning: '#F59E0B',
  danger: '#EF4444',

  pillBg: 'rgba(255,255,255,0.6)',
} as const;

// Per-pillar accent colors (health/investments/ideas/learning/relationships).
export const categoryColors = {
  health: { bg: '#D6F5EC', text: '#12805F', solid: '#2FBF9B' },
  wealth: { bg: '#FEF3C7', text: '#92400E', solid: '#FBBF24' },
  ideas: { bg: '#E4E2F9', text: '#3D3A8C', solid: '#5750B0' },
  learning: { bg: '#DBEAFE', text: '#1D4ED8', solid: '#60A5FA' },
  // solid deliberately distinct from colors.celebration (#FF7A50) - relationships
  // is a category identity, not the same token as a celebration moment.
  relationships: { bg: '#FFE1D6', text: '#C2410C', solid: '#E8623D' },
} as const;

export const gradients = {
  hero: [colors.celebration, colors.secondary] as const,
  achievement: [colors.amber, colors.celebration] as const,
  // Was [health.solid, secondary] - identical values, so this rendered as a flat
  // fill, not a gradient. Now runs bright mint -> deep teal for real depth.
  growth: [categoryColors.health.solid, colors.success] as const,
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
  shadowColor: '#1F2140',
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;
