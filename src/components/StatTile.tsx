import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, spacing } from '../theme/colors';

interface Delta {
  label: string;
  value: string;
}

interface StatTileProps {
  background: string;
  textColor: string;
  // Quieter color for the label row so the value carries the hierarchy;
  // falls back to textColor (single-color tiles, e.g. the accent CTA).
  labelColor?: string;
  // Hairline border for tiles sitting on surface-colored backgrounds.
  outlined?: boolean;
  label?: string;
  value?: string | number;
  deltas?: Delta[];
  ctaLabel?: string;
  onPress?: () => void;
  // 'third' for a 3-column grid (Profile's 6-tile layout); 'half' (the
  // default) is the original 2-column size, kept for anything that isn't
  // ready to move to three across.
  size?: 'half' | 'third';
}

export function StatTile({ background, textColor, labelColor, outlined, label, value, deltas, ctaLabel, onPress, size = 'half' }: StatTileProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const Wrapper = onPress ? TouchableOpacity : View;
  const sizeStyle = size === 'third' ? styles.tileThird : styles.tileHalf;
  const headerColor = labelColor ?? textColor;

  if (ctaLabel) {
    return (
      <Wrapper style={[styles.tile, sizeStyle, { backgroundColor: background }]} onPress={onPress}>
        <Text style={[styles.ctaArrow, { color: textColor }]}>↗</Text>
        <Text style={[styles.ctaLabel, { color: textColor }]}>{ctaLabel}</Text>
      </Wrapper>
    );
  }

  return (
    <Wrapper
      style={[styles.tile, sizeStyle, outlined && styles.tileOutlined, { backgroundColor: background }]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <Text style={[styles.label, size === 'third' && styles.labelThird, { color: headerColor }]}>{label}</Text>
        {/* Only ever shown when the tile actually does something on tap -
            it used to render unconditionally, promising a drill-down that
            three of the four tiles never had. */}
        {onPress && <Text style={[styles.arrow, { color: headerColor }]}>↗</Text>}
      </View>
      <Text style={[styles.value, size === 'third' && styles.valueThird, { color: textColor }]}>{value}</Text>
      {deltas && deltas.length > 0 && (
        <View style={styles.deltaRow}>
          {deltas.map((delta) => (
            <View key={delta.label} style={styles.pill}>
              <Text style={styles.pillValue}>{delta.value}</Text>
              <Text style={styles.pillLabel}>{delta.label}</Text>
            </View>
          ))}
        </View>
      )}
    </Wrapper>
  );
}

function createStyles({ colors, radii, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    tile: {
      borderRadius: radii.tile,
      justifyContent: 'space-between',
    },
    tileOutlined: { borderWidth: 1, borderColor: colors.border },
    tileHalf: { flexBasis: '48%', padding: spacing.lg, minHeight: 140 },
    tileThird: { flexBasis: '31%', padding: spacing.md, minHeight: 116 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    label: { ...type.secondary, fontFamily: fontFamily.semibold },
    labelThird: { ...type.caption, fontFamily: fontFamily.regular },
    // Raw sizes on purpose: arrow and ctaArrow render the "↗" glyph, whose
    // size belongs to the affordance rather than to the type hierarchy.
    arrow: { fontSize: 16, fontFamily: fontFamily.regular },
    value: { ...type.display, fontFamily: fontFamily.bold },
    // One step further down the scale than `title` would put it. This
    // override exists to fit a value into a third-width tile, and 24 - its
    // old size - has no home in the scale; rounding it up to title (26)
    // would have worked against the only reason the style exists.
    valueThird: { ...type.heading, fontFamily: fontFamily.regular },
    deltaRow: { flexDirection: 'row', gap: spacing.s6 },
    pill: {
      backgroundColor: colors.pillBg,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      flexDirection: 'row',
      gap: spacing.xs,
    },
    pillValue: { ...type.caption, fontFamily: fontFamily.bold, color: colors.textPrimary },
    pillLabel: { ...type.caption, fontFamily: fontFamily.regular, color: colors.textSecondary },
    ctaArrow: { fontSize: 20, fontFamily: fontFamily.regular, alignSelf: 'flex-end' },
    ctaLabel: { ...type.heading, fontFamily: fontFamily.bold },
  });
}
