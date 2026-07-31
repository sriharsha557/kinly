import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FC } from 'react';
import { AnimatedPressable } from './AnimatedPressable';
import { useTheme } from '../theme/ThemeProvider';
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
  const theme = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  // One-accent rule: resting chips are neutral with monochrome icons; the
  // user's accent marks selection.
  return (
    <View style={styles.chipGrid}>
      {INTEREST_OPTIONS.map(({ key, label, Icon }) => {
        const active = selected.includes(key);
        return (
          <AnimatedPressable
            key={key}
            style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surfaceSubtle }]}
            onPress={() => onToggle(key)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={label}
          >
            <Icon size={18} color={active ? colors.onAccent : colors.textSecondary} />
            <Text style={[styles.chipLabel, { color: active ? colors.onAccent : colors.textPrimary }]}>{label}</Text>
            {active && <CheckIcon size={15} color={colors.onAccent} />}
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

function createStyles({ radii }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 48,
      borderRadius: radii.pill,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    chipLabel: { fontSize: 15, fontWeight: '600' },
  });
}
