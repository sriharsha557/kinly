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

  success: '#2FBF9B',
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
  relationships: { bg: '#FFE1D6', text: '#C2410C', solid: '#FF7A50' },
} as const;

export const gradients = {
  hero: [colors.celebration, colors.secondary] as const,
  achievement: [colors.amber, colors.celebration] as const,
  growth: [categoryColors.health.solid, colors.secondary] as const,
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
