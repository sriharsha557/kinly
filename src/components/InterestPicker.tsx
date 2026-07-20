import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { FC } from 'react';
import { colors, categoryColors, radii } from '../theme/colors';
import { HealthIcon, WealthIcon, IdeasIcon, LearningIcon, RelationshipsIcon } from './icons/PillarIcons';
import { CheckIcon } from './icons/MonoIcons';
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
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
          >
            <Icon size={18} color={active ? '#fff' : category.solid} />
            <Text style={[styles.chipLabel, { color: active ? '#fff' : colors.textPrimary }]}>{label}</Text>
            {active && <CheckIcon size={15} color="#fff" />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chipLabel: { fontSize: 15, fontWeight: '600' },
});
