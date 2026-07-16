import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, categoryColors, radii } from '../theme/colors';
import type { InterestCategory } from '../types/models';

export const INTEREST_OPTIONS: { key: InterestCategory; label: string; emoji: string }[] = [
  { key: 'health', label: 'Health', emoji: '💧' },
  { key: 'wealth', label: 'Wealth', emoji: '💰' },
  { key: 'ideas', label: 'Ideas', emoji: '🚀' },
  { key: 'learning', label: 'Learning', emoji: '📚' },
  { key: 'relationships', label: 'Relationships', emoji: '❤️' },
];

export function InterestPicker({
  selected,
  onToggle,
}: {
  selected: InterestCategory[];
  onToggle: (key: InterestCategory) => void;
}) {
  return (
    <View style={styles.chipGrid}>
      {INTEREST_OPTIONS.map(({ key, label, emoji }) => {
        const active = selected.includes(key);
        const category = categoryColors[key];
        return (
          <TouchableOpacity
            key={key}
            style={[styles.chip, { backgroundColor: active ? category.solid : colors.inputBg }]}
            onPress={() => onToggle(key)}
          >
            <Text style={styles.chipEmoji}>{emoji}</Text>
            <Text style={[styles.chipLabel, { color: active ? '#fff' : colors.textPrimary }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontSize: 14, fontWeight: '600' },
});
