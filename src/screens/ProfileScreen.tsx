import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../state/useAuthStore';
import { useCircleDetail } from '../hooks/useCircles';
import { useProfileStats } from '../hooks/useProfileStats';
import { signOut } from '../lib/auth';
import { Logo } from '../components/Logo';
import { StatTile } from '../components/StatTile';
import { PillButton } from '../components/PillButton';
import { MilestoneCardModal } from '../components/MilestoneCardModal';
import { FutureSelfCard } from '../components/FutureSelfCard';
import { colors, categoryColors, radii, shadow } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import type { Achievement } from '../types/models';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((state) => state.user);
  const circleId = useAuthStore((state) => state.activeCircleId);
  const { data: circle } = useCircleDetail(circleId ?? undefined);
  const { data: stats, isLoading } = useProfileStats(user?.id, circleId ?? undefined);
  const [viewingAchievement, setViewingAchievement] = useState<Achievement | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.navigate('EditProfile')}
            accessibilityRole="button"
            accessibilityLabel="Edit profile picture"
          >
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
            ) : (
              <Logo size={72} color="#FFFFFF" background={colors.celebration} />
            )}
          </TouchableOpacity>
          <Text style={styles.name}>{user?.name ?? 'You'}</Text>
          {circle && <Text style={styles.circleName}>{circle.name}</Text>}
          {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
          <PillButton
            label="Edit Profile"
            variant="outline"
            onPress={() => navigation.navigate('EditProfile')}
            style={{ marginTop: 12, paddingHorizontal: 24, paddingVertical: 8 }}
          />
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
              <TouchableOpacity
                key={achievement.id}
                style={styles.badge}
                onPress={() => setViewingAchievement(achievement)}
              >
                <Text style={styles.badgeText}>{achievement.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>No achievements yet — complete a goal to earn your first badge.</Text>
        )}

        {user && <FutureSelfCard userId={user.id} />}

        <PillButton label="Sign out" variant="outline" onPress={() => signOut()} style={{ marginTop: 32 }} />
      </ScrollView>

      {viewingAchievement && (
        <MilestoneCardModal
          title={viewingAchievement.title}
          circleName={circle?.name}
          onClose={() => setViewingAchievement(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 120 },
  header: { alignItems: 'center', gap: 4, marginBottom: 24 },
  avatarImage: { width: 72, height: 72, borderRadius: 36 },
  bio: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 },
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
