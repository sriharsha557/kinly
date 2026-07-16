import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useWeeklyRecap } from '../hooks/useWeeklyRecap';
import { gradients, radii } from '../theme/colors';

export function WeeklyRecapCard({ circleId }: { circleId: string }) {
  const { data, isLoading } = useWeeklyRecap(circleId);

  if (isLoading || !data) return null;

  const hasActivity =
    data.goalsCompleted > 0 || data.streakMilestones > 0 || data.nudgesSent > 0 || data.asksPosted > 0;

  return (
    <LinearGradient colors={gradients.inspiration} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <Text style={styles.title}>🤖 This Week in Your Circle</Text>
      {data.highlight ? <Text style={styles.highlight}>{data.highlight}</Text> : null}
      {hasActivity && (
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{data.goalsCompleted}</Text>
            <Text style={styles.statLabel}>goals done</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{data.streakMilestones}</Text>
            <Text style={styles.statLabel}>streaks hit</Text>
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.card, padding: 16, marginBottom: 20, gap: 10 },
  title: { fontSize: 15, fontWeight: '700', color: '#fff' },
  highlight: { fontSize: 13, color: 'rgba(255,255,255,0.95)', lineHeight: 18 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.85)' },
});
