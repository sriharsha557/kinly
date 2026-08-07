import { AnimatedPressable } from '../components/AnimatedPressable';
import { fontFamily, spacing, type } from '../theme/colors';
import { useMemo, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../state/useAuthStore';
import { useCircleDetail, useCircleMembers } from '../hooks/useCircles';
import { useProfileStats } from '../hooks/useProfileStats';
import { signOut } from '../lib/auth';
import { AvatarPlaceholder } from '../components/AvatarPlaceholder';
import { StatTile } from '../components/StatTile';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { PillButton } from '../components/PillButton';
import { MilestoneCardModal } from '../components/MilestoneCardModal';
import { DeleteAccountModal } from '../components/DeleteAccountModal';
import { FutureSelfCard } from '../components/FutureSelfCard';
import { LifeTimeline } from '../components/LifeTimeline';
import { ThemePicker } from '../components/ThemePicker';
import { FEATURES } from '../lib/features';
import { HealthSyncRow } from '../components/HealthSyncRow';
import { useThemeStore } from '../state/useThemeStore';
import { setThemePrefs } from '../lib/themePrefs';
import { useTabBarClearance } from '../hooks/useTabBarClearance';
import { useTheme } from '../theme/ThemeProvider';
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
  const themeAccent = useThemeStore((state) => state.accent);
  const themeMode = useThemeStore((state) => state.mode);
  const theme = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}>
        <View style={styles.header}>
          <AnimatedPressable
            onPress={() => navigation.navigate('EditProfile')}
            accessibilityRole="button"
            accessibilityLabel="Edit profile picture"
          >
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
            ) : (
              <AvatarPlaceholder size={72} />
            )}
          </AnimatedPressable>
          <Text style={styles.name}>{user?.name ?? 'You'}</Text>
          {circle && <Text style={styles.circleName}>{circle.name}</Text>}
          {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
          <PillButton
            label="Edit Profile"
            variant="outline"
            onPress={() => navigation.navigate('EditProfile')}
            style={{ marginTop: spacing.md, paddingHorizontal: spacing.xxl, paddingVertical: spacing.sm }}
          />
        </View>

        {isLoading ? (
          <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
            <LoadingSpinner size={12} />
          </View>
        ) : (
          // Quiet surface tiles: value in ink, label muted, so the numbers
          // carry the hierarchy. Settings stays the single accent-filled
          // tile - one primary action per screen.
          <View style={styles.grid}>
            <StatTile
              size="third"
              outlined
              background={colors.surface}
              textColor={colors.textPrimary}
              labelColor={colors.textSecondary}
              label="Goals done"
              value={`${stats?.goalsCompleted ?? 0}/${stats?.goalsTotal ?? 0}`}
              onPress={() => navigation.navigate('Goals')}
            />
            <StatTile
              size="third"
              outlined
              background={colors.surface}
              textColor={colors.textPrimary}
              labelColor={colors.textSecondary}
              label="Active goals"
              value={stats?.activeGoals ?? 0}
              onPress={() => navigation.navigate('Goals')}
            />
            <StatTile
              size="third"
              outlined
              background={colors.surface}
              textColor={colors.textPrimary}
              labelColor={colors.textSecondary}
              label="Current streak"
              value={stats?.currentStreak ?? 0}
              onPress={() => navigation.navigate('Goals')}
            />
            <StatTile
              size="third"
              outlined
              background={colors.surface}
              textColor={colors.textPrimary}
              labelColor={colors.textSecondary}
              label="Completion rate"
              value={`${stats?.completionRate ?? 0}%`}
              onPress={() => navigation.navigate('Goals')}
            />
            <StatTile
              size="third"
              outlined
              background={colors.surface}
              textColor={colors.textPrimary}
              labelColor={colors.textSecondary}
              label="Circle members"
              value={memberCount}
              onPress={() => navigation.navigate('Circle')}
            />
            <StatTile
              size="third"
              background={colors.primary}
              textColor={colors.onAccent}
              ctaLabel="Settings"
              onPress={() => navigation.navigate('CircleSettings')}
            />
          </View>
        )}

        <Text style={styles.sectionTitle}>Help</Text>
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel="View the getting started tutorial"
          style={styles.helpRow}
          onPress={() => navigation.navigate('Tutorial')}
        >
          <Text style={styles.helpRowLabel}>Help &amp; Getting Started</Text>
        </AnimatedPressable>

        {/* Renders its own "Connect Health" heading and card, and nothing at
            all on a device without Health Connect - so this must not be
            wrapped in a section header here. It used to sit inside Appearance,
            where a step-sync toggle is not what anyone is looking for. */}
        <HealthSyncRow />

        <Text style={styles.sectionTitle}>Appearance</Text>
        {/* setThemePrefs applies to the live theme store first, so the whole
            app restyles on tap - the profile-row sync happens behind it. */}
        <View style={styles.appearanceCard}>
          <ThemePicker
            accent={themeAccent}
            mode={themeMode}
            onChangeAccent={(accent) => setThemePrefs({ accent })}
            onChangeMode={(mode) => setThemePrefs({ mode })}
          />
        </View>

        <Text style={styles.sectionTitle}>Achievements</Text>
        {stats && stats.achievements.length > 0 ? (
          <View style={styles.badgeList}>
            {stats.achievements.map((achievement) => (
              <AnimatedPressable
      accessibilityRole="button"
                key={achievement.id}
                style={styles.badge}
                onPress={() => setViewingAchievement(achievement)}
              >
                <Text style={styles.badgeText}>{achievement.title}</Text>
              </AnimatedPressable>
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>No achievements yet — complete a goal to earn your first badge.</Text>
        )}

        {/* Heading gated together with the timeline it labels, so deferring
            this does not strand a "Your Story" header over nothing. */}
        {FEATURES.lifeTimeline && (
          <>
            <Text style={styles.sectionTitle}>Your Story</Text>
            {user && <LifeTimeline userId={user.id} />}
          </>
        )}

        <Text style={styles.sectionTitle}>Future Self</Text>
        {user && <FutureSelfCard userId={user.id} />}

        <AnimatedPressable
      accessibilityRole="button"
          onPress={() => Linking.openURL('https://sriharsha557.github.io/kinly/privacy.html')}
          style={{ marginTop: spacing.section, alignItems: 'center', minHeight: 48, justifyContent: 'center' }}
        >
          <Text style={styles.privacyLink}>Privacy Policy</Text>
        </AnimatedPressable>

        <PillButton label="Sign out" variant="outline" onPress={() => signOut()} style={{ marginTop: spacing.md }} />

        <AnimatedPressable
      accessibilityRole="button" onPress={() => setShowDeleteAccount(true)} style={{ marginTop: spacing.xl, alignItems: 'center', minHeight: 48, justifyContent: 'center' }}>
          <Text style={styles.deleteLink}>Delete account</Text>
        </AnimatedPressable>
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

function createStyles({ colors, cardShell }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.xl },
    header: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xxl },
    avatarImage: { width: 72, height: 72, borderRadius: 36 },
    bio: { ...type.secondary, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.s6, paddingHorizontal: spacing.xl },
    name: { ...type.heading, fontFamily: fontFamily.bold, color: colors.textPrimary, marginTop: spacing.sm },
    circleName: { ...type.body, fontFamily: fontFamily.regular, color: colors.textSecondary },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
    sectionTitle: { ...type.subheading, fontFamily: fontFamily.bold, color: colors.textPrimary, marginTop: spacing.s28, marginBottom: spacing.md },
    badgeList: { gap: spacing.s10 },
    badge: {
      ...cardShell,
      paddingVertical: spacing.s14,
      paddingHorizontal: spacing.lg,
    },
    badgeText: { ...type.body, fontFamily: fontFamily.semibold, color: colors.textPrimary },
    appearanceCard: {
      ...cardShell,
      padding: spacing.lg,
    },
    helpRow: {
      ...cardShell,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      // 48 is the minimum touch target used elsewhere in this file (see the
      // Privacy Policy link below).
      minHeight: 48,
      justifyContent: 'center',
    },
    helpRowLabel: { ...type.body, fontFamily: fontFamily.medium, color: colors.textPrimary },
    empty: { color: colors.textSecondary },
    privacyLink: { ...type.secondary, fontFamily: fontFamily.semibold, color: colors.textSecondary, textDecorationLine: 'underline' },
    deleteLink: { ...type.secondary, fontFamily: fontFamily.semibold, color: colors.danger },
  });
}
