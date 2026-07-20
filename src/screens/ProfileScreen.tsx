import { useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../state/useAuthStore';
import { useCircleDetail, useCircleMembers } from '../hooks/useCircles';
import { useProfileStats } from '../hooks/useProfileStats';
import { signOut } from '../lib/auth';
import { Logo } from '../components/Logo';
import { StatTile } from '../components/StatTile';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { PillButton } from '../components/PillButton';
import { MilestoneCardModal } from '../components/MilestoneCardModal';
import { DeleteAccountModal } from '../components/DeleteAccountModal';
import { FutureSelfCard } from '../components/FutureSelfCard';
import { LifeTimeline } from '../components/LifeTimeline';
import { useTabBarClearance } from '../hooks/useTabBarClearance';
import { cardShell, colors } from '../theme/colors';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import type { Achievement } from '../types/models';

// Profile is itself a tab screen, but also needs to reach sibling tabs
// (Goals, Circle) for the stat tiles below and root-stack screens
// (CircleSettings, EditProfile) - a plain NativeStackNavigationProp only
// typed the latter, so navigating to a tab route didn't type-check.
type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((state) => state.user);
  const circleId = useAuthStore((state) => state.activeCircleId);
  const { data: circle } = useCircleDetail(circleId ?? undefined);
  const { data: stats, isLoading } = useProfileStats(user?.id, circleId ?? undefined);
  const { data: members } = useCircleMembers(circleId ?? undefined);
  const memberCount = (members ?? []).filter((m) => m.status === 'active').length;
  const [viewingAchievement, setViewingAchievement] = useState<Achievement | null>(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const tabBarClearance = useTabBarClearance();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.navigate('EditProfile')}
            accessibilityRole="button"
            accessibilityLabel="Edit profile picture"
          >
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
            ) : (
              <Logo size={72} color="#FFFFFF" background={colors.primary} />
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
          <View style={{ marginTop: 24, alignItems: 'center' }}>
            <LoadingSpinner size={12} />
          </View>
        ) : (
          <View style={styles.grid}>
            <StatTile
              size="third"
              background={colors.inputBg}
              textColor={colors.primary}
              label="Goals done"
              value={`${stats?.goalsCompleted ?? 0}/${stats?.goalsTotal ?? 0}`}
              onPress={() => navigation.navigate('Goals')}
            />
            <StatTile
              size="third"
              background={colors.inputBg}
              textColor={colors.primary}
              label="Active goals"
              value={stats?.activeGoals ?? 0}
              onPress={() => navigation.navigate('Goals')}
            />
            <StatTile
              size="third"
              background={colors.inputBg}
              textColor={colors.primary}
              label="Current streak"
              value={stats?.currentStreak ?? 0}
              onPress={() => navigation.navigate('Goals')}
            />
            <StatTile
              size="third"
              background={colors.inputBg}
              textColor={colors.primary}
              label="Completion rate"
              value={`${stats?.completionRate ?? 0}%`}
              onPress={() => navigation.navigate('Goals')}
            />
            <StatTile
              size="third"
              background={colors.inputBg}
              textColor={colors.primary}
              label="Circle members"
              value={memberCount}
              onPress={() => navigation.navigate('Circle')}
            />
            <StatTile
              size="third"
              background={colors.primary}
              textColor="#fff"
              ctaLabel="Settings"
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

        <Text style={styles.sectionTitle}>Your Story</Text>
        {user && <LifeTimeline userId={user.id} />}

        {user && <FutureSelfCard userId={user.id} />}

        <TouchableOpacity
          onPress={() => Linking.openURL('https://sriharsha557.github.io/kinly/privacy.html')}
          style={{ marginTop: 32, alignItems: 'center' }}
        >
          <Text style={styles.privacyLink}>Privacy Policy</Text>
        </TouchableOpacity>

        <PillButton label="Sign out" variant="outline" onPress={() => signOut()} style={{ marginTop: 12 }} />

        <TouchableOpacity onPress={() => setShowDeleteAccount(true)} style={{ marginTop: 20, alignItems: 'center' }}>
          <Text style={styles.deleteLink}>Delete account</Text>
        </TouchableOpacity>
      </ScrollView>

      {viewingAchievement && (
        <MilestoneCardModal
          title={viewingAchievement.title}
          circleName={circle?.name}
          onClose={() => setViewingAchievement(null)}
        />
      )}

      {showDeleteAccount && <DeleteAccountModal onClose={() => setShowDeleteAccount(false)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  header: { alignItems: 'center', gap: 4, marginBottom: 24 },
  avatarImage: { width: 72, height: 72, borderRadius: 36 },
  bio: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 },
  name: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 8 },
  circleName: { fontSize: 14, color: colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 28, marginBottom: 12 },
  badgeList: { gap: 10 },
  badge: {
    ...cardShell,
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingLeft: 14,
  },
  badgeText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  empty: { color: colors.textSecondary },
  privacyLink: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, textDecorationLine: 'underline' },
  deleteLink: { fontSize: 13, fontWeight: '600', color: colors.danger },
});
