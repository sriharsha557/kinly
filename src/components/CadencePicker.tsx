import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { WEEKDAY_LABELS, type CadenceDraft } from '../lib/cadence';
import type { TargetType } from '../lib/showingUp';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, spacing, type } from '../theme/colors';

const CADENCE_OPTIONS: { value: TargetType; label: string }[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'times_per_week', label: 'Times a week' },
  { value: 'specific_weekdays', label: 'Certain days' },
  { value: 'monthly', label: 'Times a month' },
];

const WEEK_COUNTS = [1, 2, 3, 4, 5, 6, 7];
const MONTH_COUNTS = [1, 2, 3, 4, 5];

// Picking a cadence: the type first, then only the parameters that type
// actually needs. Choosing a type resets the other type's parameters, so a
// draft can never carry a target_count left over from a cadence the user
// moved away from - validateCadence would pass and the database would store
// a count that means nothing.
export function CadencePicker({
  value,
  onChange,
}: {
  value: CadenceDraft;
  onChange: (next: CadenceDraft) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  function selectType(target_type: TargetType) {
    onChange({
      target_type,
      target_count: target_type === 'times_per_week' ? 3 : target_type === 'monthly' ? 1 : null,
      target_weekdays: target_type === 'specific_weekdays' ? [] : null,
    });
  }

  function toggleWeekday(weekday: number) {
    const current = value.target_weekdays ?? [];
    const next = current.includes(weekday)
      ? current.filter((d) => d !== weekday)
      : [...current, weekday].sort((a, b) => a - b);
    onChange({ ...value, target_weekdays: next });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>How often</Text>
      <View style={styles.row}>
        {CADENCE_OPTIONS.map((option) => {
          const selected = value.target_type === option.value;
          return (
            <AnimatedPressable
              key={option.value}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => selectType(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      {value.target_type === 'times_per_week' && (
        <>
          <Text style={styles.label}>How many times a week</Text>
          <View style={styles.row}>
            {WEEK_COUNTS.map((n) => (
              <AnimatedPressable
                key={n}
                style={[styles.countChip, value.target_count === n && styles.chipSelected]}
                onPress={() => onChange({ ...value, target_count: n })}
                accessibilityRole="button"
                accessibilityState={{ selected: value.target_count === n }}
                accessibilityLabel={`${n} times a week`}
              >
                <Text style={[styles.chipText, value.target_count === n && styles.chipTextSelected]}>
                  {n}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        </>
      )}

      {value.target_type === 'monthly' && (
        <>
          <Text style={styles.label}>How many times a month</Text>
          <View style={styles.row}>
            {MONTH_COUNTS.map((n) => (
              <AnimatedPressable
                key={n}
                style={[styles.countChip, value.target_count === n && styles.chipSelected]}
                onPress={() => onChange({ ...value, target_count: n })}
                accessibilityRole="button"
                accessibilityState={{ selected: value.target_count === n }}
                accessibilityLabel={`${n} times a month`}
              >
                <Text style={[styles.chipText, value.target_count === n && styles.chipTextSelected]}>
                  {n}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        </>
      )}

      {value.target_type === 'specific_weekdays' && (
        <>
          <Text style={styles.label}>Which days</Text>
          <View style={styles.row}>
            {WEEKDAY_LABELS.map((day, index) => {
              const weekday = index + 1;
              const selected = (value.target_weekdays ?? []).includes(weekday);
              return (
                <AnimatedPressable
                  key={day}
                  style={[styles.countChip, selected && styles.chipSelected]}
                  onPress={() => toggleWeekday(weekday)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={day}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{day}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

function createStyles({ colors, radii, type: t }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    wrap: { gap: spacing.s6 },
    label: { ...t.caption, fontFamily: fontFamily.semibold, color: colors.textSecondary },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
    chip: {
      paddingVertical: spacing.s10,
      paddingHorizontal: spacing.md,
      borderRadius: radii.input,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    countChip: {
      minWidth: 48,
      alignItems: 'center',
      paddingVertical: spacing.s10,
      paddingHorizontal: spacing.s10,
      borderRadius: radii.input,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipSelected: { borderColor: colors.primary, backgroundColor: colors.background },
    chipText: { ...t.caption, fontFamily: fontFamily.semibold, color: colors.textSecondary },
    chipTextSelected: { color: colors.textPrimary },
  });
}
