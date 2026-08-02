import { AnimatedPressable } from './AnimatedPressable';
import { fontFamily, spacing } from '../theme/colors';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useUxHintsStore } from '../state/useUxHintsStore';
import { useTheme } from '../theme/ThemeProvider';

// One-line plain-language subtitle for a coined feature name ("Circle
// Garden", "Accountability Buddy"...). The poetic names are brand identity
// and never change - this just makes sure a first-time user never meets one
// "naked". Dismissible: tapping ✕ hides that concept's hint on every screen
// it appears, permanently (persisted per device in useUxHintsStore).
export function ConceptHint({
  id,
  text,
  onGradient = false,
}: {
  id: string;
  text: string;
  // Set when the hint sits on a gradient card (white-on-color) instead of a
  // plain surface, so the copy stays readable in both placements.
  onGradient?: boolean;
}) {
  const dismissed = useUxHintsStore((state) => state.dismissedHints[id]);
  const dismissHint = useUxHintsStore((state) => state.dismissHint);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (dismissed) return null;

  return (
    <View style={styles.row}>
      <Text style={[styles.text, onGradient && styles.textOnGradient]}>{text}</Text>
      <AnimatedPressable
        onPress={() => dismissHint(id)}
        hitSlop={14}
        accessibilityRole="button"
        accessibilityLabel="Dismiss this explanation"
      >
        <Text style={[styles.close, onGradient && styles.closeOnGradient]}>✕</Text>
      </AnimatedPressable>
    </View>
  );
}

function createStyles({ colors, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: 2 },
    text: { flex: 1, ...type.caption, fontFamily: fontFamily.regular, color: colors.textSecondary, lineHeight: 17 },
    textOnGradient: { color: 'rgba(255,255,255,0.85)' },
    // Raw size on purpose: a bare glyph, sized to its control rather than
    // to the type hierarchy - the token would also impose a lineHeight it
    // has never had, shifting it off-centre in a tight container.
    close: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.textSecondary, paddingTop: 2 },
    closeOnGradient: { color: 'rgba(255,255,255,0.7)' },
  });
}
