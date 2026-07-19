import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useGardenState } from '../hooks/useGarden';
import { GardenStageArt } from './GardenStageArt';
import { colors } from '../theme/colors';
import SproutIcon from '../../assets/icons/feed/sprout.svg';

function healthMessage(health: number): string {
  if (health >= 80) return 'Everyone is thriving today';
  if (health >= 50) return 'Your garden is growing';
  if (health > 0) return 'A few plants need water';
  return 'Your garden is waiting for its first bloom';
}

export function GardenCard({ circleId }: { circleId: string }) {
  const { data, isLoading } = useGardenState(circleId);

  if (isLoading || !data || data.members.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <SproutIcon width={18} height={18} />
          <Text style={styles.title}>Circle Garden</Text>
        </View>
        <Text style={styles.health}>{data.health}% thriving</Text>
      </View>
      <Text style={styles.message}>{healthMessage(data.health)}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {data.members.map((member) => (
          <View key={member.userId} style={styles.plant}>
            <GardenStageArt stage={member.stage} size={36} />
            <Text style={styles.name} numberOfLines={1}>
              {member.name}
            </Text>
            {member.streak > 0 && <Text style={styles.streak}>{member.streak}d</Text>}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E4DFD1',
    borderRadius: 20,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    padding: 20,
    paddingLeft: 18,
    marginBottom: 20,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontWeight: '500', color: '#22281F' },
  health: { fontSize: 13, fontWeight: '700', color: colors.primary },
  message: { fontSize: 13, color: '#7A7A6E', marginTop: 2, marginBottom: 12 },
  row: { gap: 16 },
  plant: { alignItems: 'center', width: 56 },
  name: { fontSize: 11, fontWeight: '600', color: colors.textPrimary, marginTop: 2 },
  streak: { fontSize: 10, color: colors.textSecondary },
});
