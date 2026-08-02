import { AnimatedPressable } from '../components/AnimatedPressable';
import { useCallback, useMemo, useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { ReactNode } from 'react';
import { useAuthStore } from '../state/useAuthStore';
import { BuddyCard } from '../components/BuddyCard';
import { ChallengesCard } from '../components/ChallengesCard';
import { VisionBoardCard } from '../components/VisionBoardCard';
import { MeetUpCard } from '../components/MeetUpCard';
import { CircleAICard } from '../components/CircleAICard';
import { WeeklyRecapCard } from '../components/WeeklyRecapCard';
import { DisclosureSection } from '../components/DisclosureSection';
import { CirclePicker, CircleName } from '../components/CirclePicker';
import { CircleHealthCard } from '../components/CircleHealthCard';
import { CircleTodaySection } from '../components/CircleTodaySection';
import { CircleMembersSection } from '../components/CircleMembersSection';
import { useGardenState } from '../hooks/useGarden';
import { useGoals } from '../hooks/useGoals';
import { useTodayMoodCheckins } from '../hooks/useMoodCheckins';
import { needsAttention } from '../lib/needsAttention';
import { useTabBarClearance } from '../hooks/useTabBarClearance';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, motion, spacing } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import SettingsIcon from '../../assets/brand/settings.svg';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function Reveal({ index, children }: { index: number; children: ReactNode }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.duration.entrance).delay(
        Math.min(index, motion.stagger.maxItems) * motion.stagger.step,
      )}
    >
      {children}
    </Animated.View>
  );
}

export default function CircleScreen() {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((state) => state.user?.id);
  const circleId = useAuthStore((state) => state.activeCircleId);
  const scrollRef = useRef<ScrollView>(null);
  const tabBarClearance = useTabBarClearance();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {
    data: garden,
    isPending: gardenPending,
    isFetching: gardenFetching,
    isError: gardenError,
    refetch: refetchGarden,
  } = useGardenState(circleId ?? undefined);
  const {
    data: goals,
    isPending: goalsPending,
    isFetching: goalsFetching,
    isError: goalsError,
    refetch: refetchGoals,
  } = useGoals(circleId ?? undefined);
  const {
    data: moods,
    isPending: moodsPending,
    isFetching: moodsFetching,
    isError: moodsError,
    refetch: refetchMoods,
  } = useTodayMoodCheckins(circleId ?? undefined);

  // Cold start (every query still []) must not be mistaken for "checked, and
  // everyone is fine" - and a query error must not settle on that same
  // all-clear forever. CircleTodaySection needs both signals to tell the
  // difference.
  const isLoading = gardenPending || goalsPending || moodsPending;
  const isError = gardenError || goalsError || moodsError;
  const isRefreshing = (gardenFetching || goalsFetching || moodsFetching) && !isLoading;

  const handleRefresh = useCallback(() => {
    refetchGarden();
    refetchGoals();
    refetchMoods();
  }, [refetchGarden, refetchGoals, refetchMoods]);

  // The screen owns no rules - needsAttention is the single definition of
  // all three signals, so this cannot drift from what BuddyCard believes.
  const attentionRows = useMemo(
    () =>
      userId
        ? needsAttention({
            members: garden?.members ?? [],
            goals: goals ?? [],
            toughToday: (moods ?? []).filter((m) => m.mood === 'tough').map((m) => m.user_id),
            viewerId: userId,
            now: Date.now(),
          })
        : [],
    [garden, goals, moods, userId],
  );

  // Same definition Home's GardenHero uses: distinct users whose
  // last_logged_date is today, not mood check-ins - see GardenHero.tsx.
  const today = new Date().toISOString().slice(0, 10);
  const checkedInToday = useMemo(
    () => new Set((goals ?? []).filter((g) => g.last_logged_date === today).map((g) => g.user_id)).size,
    [goals, today],
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.page, { paddingBottom: tabBarClearance }]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* Same split as Home: the button says what it does, the name heads
            the thing it describes. The name used to be this screen's title
            at 26px, which read as a page heading rather than as a label for
            the health card under it. */}
        <View style={styles.header}>
          <CirclePicker />
          <AnimatedPressable
      accessibilityRole="button" style={styles.settingsRow} onPress={() => navigation.navigate('CircleSettings')}>
            <SettingsIcon width={15} height={15} color={theme.colors.textSecondary} />
            <Text style={styles.settingsLink}>Settings</Text>
          </AnimatedPressable>
        </View>

        {circleId && <CircleName size="sm" />}

        {circleId && (
          <Reveal index={0}>
            <CircleHealthCard
              circleId={circleId}
              needsSupportCount={attentionRows.length}
              checkedInToday={checkedInToday}
            />
          </Reveal>
        )}
        {userId && circleId && (
          <Reveal index={1}>
            <CircleTodaySection
              circleId={circleId}
              userId={userId}
              rows={attentionRows}
              isLoading={isLoading}
              isError={isError}
            />
          </Reveal>
        )}
        {userId && circleId && (
          <Reveal index={2}>
            <CircleMembersSection
              circleId={circleId}
              userId={userId}
              excludeUserIds={attentionRows.map((r) => r.userId)}
            />
          </Reveal>
        )}
        {/* Challenges above Buddy: challenges are collective, a buddy is a
            pairing, and the collective belongs higher on the screen that
            answers "how are we". */}
        {userId && circleId && (
          <Reveal index={3}>
            <ChallengesCard circleId={circleId} userId={userId} />
          </Reveal>
        )}
        {userId && circleId && (
          <Reveal index={4}>
            <BuddyCard circleId={circleId} userId={userId} />
          </Reveal>
        )}

        {/* Secondary: lower-frequency extras, tucked behind a tap so they don't compete for attention */}
        <DisclosureSection label="More for your circle">
          {userId && circleId && <VisionBoardCard circleId={circleId} userId={userId} />}
          {userId && circleId && <MeetUpCard circleId={circleId} userId={userId} />}
          {userId && circleId && (
            <CircleAICard
              circleId={circleId}
              userId={userId}
              onChallengeStarted={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            />
          )}
          {circleId && <WeeklyRecapCard circleId={circleId} />}
        </DisclosureSection>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles({ colors, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    page: { padding: spacing.lg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
    // marginLeft: auto rather than relying on the row's space-between:
    // CirclePicker renders nothing when you only belong to one circle, and
    // with a single child space-between would drop Settings to the left edge.
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s6,
      minHeight: 48,
      paddingHorizontal: spacing.sm,
      marginLeft: 'auto',
    },
    settingsLink: { ...type.secondary, fontFamily: fontFamily.semibold, color: colors.textSecondary },
  });
}
