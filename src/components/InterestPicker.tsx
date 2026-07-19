import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { FC } from 'react';
import { colors, categoryColors, radii } from '../theme/colors';
import { HealthIcon, WealthIcon, IdeasIcon, LearningIcon, RelationshipsIcon } from './icons/PillarIcons';
import type { InterestCategory } from '../types/models';

interface PillarIconProps {
  size?: number;
  color: string;
}

export const INTEREST_OPTIONS: { key: InterestCategory; label: string; Icon: FC<PillarIconProps> }[] = [
  { key: 'health', label: 'Health', Icon: HealthIcon },
  { key: 'wealth', label: 'Wealth', Icon: WealthIcon },
  { key: 'ideas', label: 'Ideas', Icon: IdeasIcon },
  { key: 'learning', label: 'Learning', Icon: LearningIcon },
  { key: 'relationships', label: 'Relationships', Icon: RelationshipsIcon },
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
      {INTEREST_OPTIONS.map(({ key, label, Icon }) => {
        const active = selected.includes(key);
        const category = categoryColors[key];
        return (
          <TouchableOpacity
            key={key}
            style={[styles.chip, { backgroundColor: active ? category.solid : colors.inputBg }]}
            onPress={() => onToggle(key)}
          >
            <Icon size={16} color={active ? '#fff' : category.solid} />
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
  chipLabel: { fontSize: 14, fontWeight: '600' },
});
