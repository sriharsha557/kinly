import { useMemo } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useWeeklyRecap } from '../hooks/useWeeklyRecap';
import { useCircleDetail } from '../hooks/useCircles';
import { useTheme } from '../theme/ThemeProvider';
import { RobotIcon, SproutIcon } from './icons/MonoIcons';
import { HealthIcon } from './icons/PillarIcons';
import { fontFamily, spacing } from '../theme/colors';
import { AnimatedPressable } from './AnimatedPressable';

function healthDeltaLabel(now: number, weekAgo: number | null): string | null {
  if (weekAgo === null) return null;
  const delta = now - weekAgo;
  if (delta === 0) return 'Steady at';
  return delta > 0 ? `Up ${delta}% to` : `Down ${Math.abs(delta)}% to`;
}

// Nothing auto-posts - the share sheet only opens on this explicit tap. A
// plain text summary, not a captured image: react-native-view-shot-style
// screenshotting is a native module, and this app ships everything via
// eas update - see ARCHITECTURE.md's "Shareable weekly scorecard" note.
function buildShareText(circleName: string, data: ReturnType<typeof useWeeklyRecap>['data']): string {
  if (!data) return '';
  const lines = [
    `${circleName} — this week on Kinly`,
    '',
    `✅ ${data.goalsCompleted} goals completed`,
    `🔥 Best streak: ${data.bestStreak} days`,
    `💧 ${data.nudgesSent} nudges sent`,
  ];
  if (data.mostWateredFriendName) lines.push(`Most watered: ${data.mostWateredFriendName}`);
  const delta = healthDeltaLabel(data.healthNow, data.healthWeekAgo);
  lines.push(delta ? `🌱 ${delta} ${data.healthNow}% circle health` : `🌱 ${data.healthNow}% circle health`);
  if (data.highlight) lines.push('', data.highlight);
  return lines.join('\n');
}

export function WeeklyRecapCard({ circleId }: { circleId: string }) {
  const { data, isLoading } = useWeeklyRecap(circleId);
  const { data: circle } = useCircleDetail(circleId);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (isLoading || !data) return null;

  const hasActivity =
    data.goalsCompleted > 0 || data.streakMilestones > 0 || data.nudgesSent > 0 || data.asksPosted > 0;
  const delta = healthDeltaLabel(data.healthNow, data.healthWeekAgo);

  async function handleShare() {
    await Share.share({ message: buildShareText(circle?.name ?? 'Our circle', data) });
  }

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.titleTextRow}>
          <RobotIcon size={18} color={theme.colors.primary} />
          <Text style={styles.title}>This Week in Your Circle</Text>
        </View>
        <AnimatedPressable onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share weekly scorecard">
          <Text style={styles.shareLink}>Share</Text>
        </AnimatedPressable>
      </View>
      {data.highlight ? <Text style={styles.highlight}>{data.highlight}</Text> : null}
      {hasActivity && (
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{data.goalsCompleted}</Text>
            <Text style={styles.statLabel}>goals done</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{data.bestStreak}</Text>
            <Text style={styles.statLabel}>best streak</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{data.nudgesSent}</Text>
            <Text style={styles.statLabel}>nudges sent</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{data.asksPosted}</Text>
            <Text style={styles.statLabel}>asks posted</Text>
          </View>
        </View>
      )}
      <View style={styles.footerRow}>
        {data.mostWateredFriendName && (
          <View style={styles.footerLine}>
            <HealthIcon size={13} color={theme.colors.primary} />
            <Text style={styles.footerText}>Most watered: {data.mostWateredFriendName}</Text>
          </View>
        )}
        <View style={styles.footerLine}>
          <SproutIcon size={13} color={theme.colors.primary} />
          <Text style={styles.footerText}>
            {delta ? `${delta} ` : ''}
            {data.healthNow}% health
          </Text>
        </View>
      </View>
    </View>
  );
}

function createStyles({ colors, cardShell }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: { ...cardShell, padding: spacing.lg, paddingLeft: 14, marginBottom: spacing.xl, gap: 10 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    titleTextRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { fontSize: 15, fontFamily: fontFamily.medium, color: colors.shellTitle },
    shareLink: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.primary, textDecorationLine: 'underline' },
    highlight: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.shellSecondary, lineHeight: 18 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
    stat: { alignItems: 'center' },
    statValue: { fontSize: 20, fontFamily: fontFamily.bold, color: colors.shellTitle },
    statLabel: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.shellSecondary },
    footerRow: { gap: spacing.xs, marginTop: 2 },
    footerLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    footerText: { fontSize: 13, color: colors.shellSecondary, fontFamily: fontFamily.semibold },
  });
}
