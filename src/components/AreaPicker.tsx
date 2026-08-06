import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, spacing, touch } from '../theme/colors';
import type { Area } from '../types/models';

// A circle's enabled Areas as selectable chips. The catalog is fixed and
// small (eight, and usually three or four enabled), so every option is
// visible at once rather than hidden behind a dropdown - picking an Area is
// the first decision in creating a goal and should not cost a tap to see.
export function AreaPicker({
  areas,
  selectedId,
  onSelect,
}: {
  areas: readonly Area[];
  selectedId: string | null;
  onSelect: (areaId: string) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (areas.length === 0) {
    return <Text style={styles.empty}>This circle hasn&apos;t turned on any areas yet.</Text>;
  }

  return (
    <View style={styles.row}>
      {areas.map((area) => {
        const selected = area.id === selectedId;
        return (
          <AnimatedPressable
            key={area.id}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onSelect(area.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={area.label}
          >
            <Text style={styles.emoji}>{area.emoji}</Text>
            <Text style={[styles.label, selected && styles.labelSelected]}>{area.label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

function createStyles({ colors, radii, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s6,
      // paddingVertical alone on an 18px caption line lands around 38dp -
      // under the 48dp minimum design/REDESIGN.md §2.3 sets for any tap
      // target. minHeight is what actually guarantees the floor; padding
      // only ever adds to it.
      minHeight: touch.chip,
      paddingVertical: spacing.s10,
      paddingHorizontal: spacing.md,
      borderRadius: radii.input,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipSelected: { borderColor: colors.primary, backgroundColor: colors.background },
    emoji: { fontSize: 16 },
    label: { ...type.caption, fontFamily: fontFamily.semibold, color: colors.textSecondary },
    labelSelected: { color: colors.textPrimary },
    empty: { ...type.caption, fontFamily: fontFamily.regular, color: colors.textSecondary },
  });
}
