import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useWeeklyRecap } from '../hooks/useWeeklyRecap';
import { useCircleDetail } from '../hooks/useCircles';
import { gradients, radii } from '../theme/colors';
import { RobotIcon, SproutIcon } from './icons/MonoIcons';
import { HealthIcon } from './icons/PillarIcons';

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

  if (isLoading || !data) return null;

  const hasActivity =
    data.goalsCompleted > 0 || data.streakMilestones > 0 || data.nudgesSent > 0 || data.asksPosted > 0;
  const delta = healthDeltaLabel(data.healthNow, data.healthWeekAgo);

  async function handleShare() {
    await Share.share({ message: buildShareText(circle?.name ?? 'Our circle', data) });
  }

  return (
    <LinearGradient colors={gradients.inspiration} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={styles.titleRow}>
        <View style={styles.titleTextRow}>
          <RobotIcon size={18} color="#fff" />
          <Text style={styles.title}>This Week in Your Circle</Text>
        </View>
        <TouchableOpacity onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share weekly scorecard">
          <Text style={styles.shareLink}>Share</Text>
        </TouchableOpacity>
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
            <HealthIcon size={13} color="#fff" />
            <Text style={styles.footerText}>Most watered: {data.mostWateredFriendName}</Text>
          </View>
        )}
        <View style={styles.footerLine}>
          <SproutIcon size={13} color="#fff" />
          <Text style={styles.footerText}>
            {delta ? `${delta} ` : ''}
            {data.healthNow}% health
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.card, padding: 16, marginBottom: 20, gap: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleTextRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontWeight: '700', color: '#fff' },
  shareLink: { fontSize: 13, fontWeight: '700', color: '#fff', textDecorationLine: 'underline' },
  highlight: { fontSize: 13, color: 'rgba(255,255,255,0.95)', lineHeight: 18 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.85)' },
  footerRow: { gap: 4, marginTop: 2 },
  footerLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
});
