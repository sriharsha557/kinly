import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useGardenState } from '../hooks/useGarden';
import { gradients, radii } from '../theme/colors';
import type { MainTabParamList } from '../navigation/types';

function emotionalCopy(health: number, hasMembers: boolean): string {
  if (!hasMembers) return 'Your garden is waiting for its first bloom.';
  if (health >= 80) return 'Everyone is thriving today. Beautiful work.';
  if (health >= 50) return 'Your garden is growing steadily.';
  if (health > 0) return 'A few plants need water — check in on your circle.';
  return 'Your journey starts today. Log a goal to plant your first seed.';
}

// The bigger, more emotional Home-screen version of Garden - the full
// per-member breakdown lives on the Circle tab; this is just the feeling.
export function GardenTeaser({ circleId }: { circleId: string }) {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { data } = useGardenState(circleId);

  const health = data?.health ?? 0;
  const hasMembers = (data?.members.length ?? 0) > 0;

  return (
    <LinearGradient colors={gradients.growth} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <Text style={styles.title}>🌱 Your Circle</Text>
      <Text style={styles.percent}>{health}%</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${health}%` }]} />
      </View>
      <Text style={styles.copy}>{emotionalCopy(health, hasMembers)}</Text>
      <TouchableOpacity onPress={() => navigation.navigate('Circle')}>
        <Text style={styles.link}>View Garden →</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.card, padding: 20, marginBottom: 16, gap: 6 },
  title: { fontSize: 14, fontWeight: '700', color: '#fff' },
  percent: { fontSize: 40, fontWeight: '800', color: '#fff', marginTop: 2 },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
    marginTop: 4,
  },
  barFill: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },
  copy: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 10, lineHeight: 18 },
  link: { fontSize: 13, fontWeight: '700', color: '#fff', marginTop: 10 },
});
