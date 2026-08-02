import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeProvider';
import type { DaylightPhase } from '../../lib/daylight';

// The hero's sky: the accent gradient it always had, with a time-of-day wash
// laid over it. Two layers rather than one so the accent survives - it is the
// only place the accent touches the garden (design/REDESIGN.md), and a single
// gradient carrying fixed dawn/dusk hues would have taken that away.
//
// Both layers are static fills. Nothing here animates, so this needs no
// reduced-motion gate; the phase changes at most four times a day and does so
// between renders.
export function SkyGradient({ phase, children }: { phase: DaylightPhase; children: ReactNode }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const wash = theme.garden.sky[phase];

  return (
    <LinearGradient
      colors={[theme.colors.inputBg, theme.colors.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.hero}
    >
      <LinearGradient
        colors={wash}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        // Decorative and non-interactive: it must never intercept the press
        // that opens the Circle tab, and there is nothing here to announce.
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View style={styles.content}>{children}</View>
    </LinearGradient>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { radii, spacing, shadow } = theme;
  return StyleSheet.create({
    hero: {
      borderRadius: radii.hero,
      overflow: 'hidden',
      marginBottom: spacing.lg,
      ...shadow,
    },
    // The wash is absolutely positioned, so the real content needs its own
    // stacking context to sit above it.
    content: { position: 'relative' },
  });
}
