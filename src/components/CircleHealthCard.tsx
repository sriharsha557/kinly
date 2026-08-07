import { fontFamily, spacing } from '../theme/colors';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GardenStageArt } from './GardenStageArt';
import { useGardenState, type GardenStage } from '../hooks/useGarden';
import { useTheme } from '../theme/ThemeProvider';

// The Circle tab's answer to "how are we?", given before the screen asks
// anything of you. Also the only place the garden's identity survives on
// this tab - the full hero lives on Home now, and rendering it twice was
// what made Circle read as a second dashboard.
//
// Health thresholds and vocabulary are design/REDESIGN.md §5.2's, reused
// rather than reinvented.
function healthLabel(health: number): { word: string; stage: GardenStage } {
  if (health >= 80) return { word: 'Thriving', stage: 'bloom' };
  if (health >= 40) return { word: 'Healthy', stage: 'tree' };
  if (health >= 1) return { word: 'Needs care', stage: 'wilted' };
  return { word: 'Just planted', stage: 'seed' };
}

export function CircleHealthCard({
  circleId,
  needsSupportCount,
  checkedInToday,
}: {
  circleId: string;
  needsSupportCount: number;
  checkedInToday: number;
}) {
  const { data: garden } = useGardenState(circleId);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const members = garden?.members ?? [];
  const { word, stage } = healthLabel(garden?.health ?? 0);
  const activeStreaks = members.filter((m) => m.streak > 0).length;

  // "1 needs support" is omitted entirely at zero rather than rendered as
  // "0 need support" - a good day should not be phrased as an absence.
  //
  // "checked in today" means a goal_checkins row dated today - the value
  // arrives ledger-derived now, not from goals.last_logged_date, which
  // nothing writes for a cadence commitment. Still not mood check-ins, so
  // the same copy never disagrees between the two tabs.
  const facts = [
    `${checkedInToday}/${members.length} checked in today`,
    `${activeStreaks} active ${activeStreaks === 1 ? 'streak' : 'streaks'}`,
    needsSupportCount > 0
      ? `${needsSupportCount} ${needsSupportCount === 1 ? 'person needs' : 'people need'} support`
      : null,
  ].filter((line): line is string => line !== null);

  return (
    <View style={styles.card}>
      <View style={styles.headline}>
        <GardenStageArt stage={stage} size={36} />
        <Text style={styles.word}>{word}</Text>
      </View>
      {facts.map((line) => (
        <Text key={line} style={styles.fact}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function createStyles({ colors, cardShell, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    // cardShell is the shared flat card treatment (1px border hairline, no
    // shadow) - design/PRINCIPLES.md's "Shape & space" rule, spread rather
    // than hand-rolled so this card cannot drift from every other one.
    card: { ...cardShell, padding: spacing.xl, gap: spacing.xs, marginBottom: spacing.lg },
    headline: { flexDirection: 'row', alignItems: 'center', gap: spacing.s10, marginBottom: spacing.xs },
    word: { ...type.heading, fontFamily: fontFamily.bold, color: colors.textPrimary },
    fact: { ...type.secondary, fontFamily: fontFamily.medium, color: colors.textSecondary },
  });
}
