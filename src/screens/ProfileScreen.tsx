import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../state/useAuthStore';
import { useCircleDetail } from '../hooks/useCircles';
import { useProfileStats } from '../hooks/useProfileStats';
import { signOut } from '../lib/auth';
import { Mascot } from '../components/Mascot';
import { StatTile } from '../components/StatTile';
import { PillButton } from '../components/PillButton';
import { colors, categoryColors, radii, shadow } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((state) => state.user);
  const circleId = useAuthStore((state) => state.activeCircleId);
  const { data: circle } = useCircleDetail(circleId ?? undefined);
  const { data: stats, isLoading } = useProfileStats(user?.id, circleId ?? undefined);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Mascot size={72} />
          <Text style={styles.name}>{user?.name ?? 'You'}</Text>
          {circle && <Text style={styles.circleName}>{circle.name}</Text>}
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.grid}>
            <StatTile
              background={categoryColors.health.bg}
              textColor={categoryColors.health.text}
              label="Goals done"
              value={`${stats?.goalsCompleted ?? 0}/${stats?.goalsTotal ?? 0}`}
            />
            <StatTile
              background={categoryColors.learning.bg}
              textColor={categoryColors.learning.text}
              label="Best streak"
              value={stats?.currentStreak ?? 0}
            />
            <StatTile
              background={categoryColors.relationships.bg}
              textColor={categoryColors.relationships.text}
              label="Friends helped"
              value={stats?.friendsHelped ?? 0}
            />
            <StatTile
              background={colors.celebration}
              textColor="#fff"
              ctaLabel="Circle Settings"
              onPress={() => navigation.navigate('CircleSettings')}
            />
          </View>
        )}

        <Text style={styles.sectionTitle}>Achievements</Text>
        {stats && stats.achievements.length > 0 ? (
          <View style={styles.badgeList}>
            {stats.achievements.map((achievement) => (
              <View key={achievement.id} style={styles.badge}>
                <Text style={styles.badgeText}>{achievement.title}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>No achievements yet — complete a goal to earn your first badge.</Text>
        )}

        <PillButton label="Sign out" variant="outline" onPress={() => signOut()} style={{ marginTop: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', gap: 4, marginBottom: 24 },
  name: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 8 },
  circleName: { fontSize: 14, color: colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 28, marginBottom: 12 },
  badgeList: { gap: 10 },
  badge: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...shadow,
  },
  badgeText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  empty: { color: colors.textSecondary },
});
