// Brand: Purple + Mint core identity, coral reserved for celebration/CTA moments.
export const colors = {
  primary: '#6D5EF8',
  primarySoft: '#8F7DFA',
  secondary: '#2DD4BF',
  celebration: '#FF6B6B',
  amber: '#F59E0B',

  background: '#FAFAFF',
  surface: '#FFFFFF',
  inputBg: '#F1EFFE',

  textPrimary: '#1E1B4B',
  textSecondary: '#6B7280',

  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',

  pillBg: 'rgba(255,255,255,0.6)',
} as const;

// Per-pillar accent colors (health/investments/ideas/learning/relationships).
export const categoryColors = {
  health: { bg: '#D1FAE5', text: '#047857', solid: '#34D399' },
  wealth: { bg: '#FEF3C7', text: '#92400E', solid: '#FBBF24' },
  ideas: { bg: '#EDE9FE', text: '#5B21B6', solid: '#8B5CF6' },
  learning: { bg: '#DBEAFE', text: '#1D4ED8', solid: '#60A5FA' },
  relationships: { bg: '#FFE4E9', text: '#BE123C', solid: '#FB7185' },
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
  shadowColor: '#1E1B4B',
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;
