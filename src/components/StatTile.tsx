import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii } from '../theme/colors';

interface Delta {
  label: string;
  value: string;
}

interface StatTileProps {
  background: string;
  textColor: string;
  label?: string;
  value?: string | number;
  deltas?: Delta[];
  ctaLabel?: string;
  onPress?: () => void;
}

export function StatTile({ background, textColor, label, value, deltas, ctaLabel, onPress }: StatTileProps) {
  const Wrapper = onPress ? TouchableOpacity : View;

  if (ctaLabel) {
    return (
      <Wrapper style={[styles.tile, { backgroundColor: background }]} onPress={onPress}>
        <Text style={[styles.ctaArrow, { color: textColor }]}>↗</Text>
        <Text style={[styles.ctaLabel, { color: textColor }]}>{ctaLabel}</Text>
      </Wrapper>
    );
  }

  return (
    <Wrapper style={[styles.tile, { backgroundColor: background }]} onPress={onPress}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        <Text style={[styles.arrow, { color: textColor }]}>↗</Text>
      </View>
      <Text style={[styles.value, { color: textColor }]}>{value}</Text>
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

const styles = StyleSheet.create({
  tile: {
    flexBasis: '48%',
    borderRadius: radii.tile,
    padding: 16,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { fontSize: 14, fontWeight: '600' },
  arrow: { fontSize: 16 },
  value: { fontSize: 32, fontWeight: '800' },
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
