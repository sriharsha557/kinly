import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

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

function createStyles({ colors, radii }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    tile: {
      borderRadius: radii.tile,
      justifyContent: 'space-between',
    },
    tileOutlined: { borderWidth: 1, borderColor: colors.border },
    tileHalf: { flexBasis: '48%', padding: 16, minHeight: 140 },
    tileThird: { flexBasis: '31%', padding: 12, minHeight: 116 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    label: { fontSize: 14, fontWeight: '600' },
    labelThird: { fontSize: 12 },
    arrow: { fontSize: 16 },
    value: { fontSize: 32, fontWeight: '700' },
    valueThird: { fontSize: 24 },
    deltaRow: { flexDirection: 'row', gap: 6 },
    pill: {
      backgroundColor: colors.pillBg,
      borderRadius: radii.pill,
      paddingHorizontal: 8,
      paddingVertical: 4,
      flexDirection: 'row',
      gap: 4,
    },
    pillValue: { fontSize: 11, fontWeight: '700', color: colors.textPrimary },
    pillLabel: { fontSize: 11, color: colors.textSecondary },
    ctaArrow: { fontSize: 20, alignSelf: 'flex-end' },
    ctaLabel: { fontSize: 20, fontWeight: '800' },
  });
}
