import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { describeCadence } from '../lib/cadence';
import { consistency, streak, type Cadence, type CheckinDates } from '../lib/showingUp';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, spacing } from '../theme/colors';

// One goal's cadence, streak and consistency on a single line.
//
// The streak number is PERIODS, not days - a weekly goal at 12 means twelve
// consecutive weeks. Consistency is measured against the goal's own
// denominator, so a 4x/week goal reads 4/4 and never 4/7; showing 4/7 would
// make someone who fully honoured their commitment look like they had
// missed three days.
export function GoalCadenceRow({
  cadence,
  checkins,
  now,
}: {
  cadence: Cadence;
  checkins: CheckinDates;
  now: number;
}) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const periods = streak(cadence, checkins, now);
  const { done, of } = consistency(cadence, checkins, now);

  return (
    <View style={styles.row}>
      <Text style={styles.cadence}>{describeCadence(cadence)}</Text>
      {periods > 0 && <Text style={styles.streak}>🔥{periods}</Text>}
      {/* of === 0 only happens for a goal with no recognised cadence. Showing
          "0/0" is meaningless, so the figure is simply omitted rather than
          rendered as a ratio nobody can read. */}
      {of > 0 && (
        <Text style={styles.consistency}>
          {done}/{of}
        </Text>
      )}
    </View>
  );
}

function createStyles({ colors, type: t }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.s10 },
    cadence: { ...t.caption, fontFamily: fontFamily.regular, color: colors.textSecondary },
    streak: { ...t.caption, fontFamily: fontFamily.semibold, color: colors.textPrimary },
    consistency: { ...t.caption, fontFamily: fontFamily.regular, color: colors.textSecondary },
  });
}
