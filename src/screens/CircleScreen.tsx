import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { CirclePicker } from '../components/CirclePicker';
import { CircleHealthCard } from '../components/CircleHealthCard';
import { CircleTodaySection } from '../components/CircleTodaySection';
import { CircleMembersSection } from '../components/CircleMembersSection';
import { useGardenState } from '../hooks/useGarden';
import { useGoals } from '../hooks/useGoals';
import { useTodayMoodCheckins } from '../hooks/useMoodCheckins';
import { needsAttention } from '../lib/needsAttention';
import { useTabBarClearance } from '../hooks/useTabBarClearance';
import { useTheme } from '../theme/ThemeProvider';
import type { RootStackParamList } from '../navigation/types';
import SettingsIcon from '../../assets/brand/settings.svg';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function Reveal({ index, children }: { index: number; children: ReactNode }) {
  return <Animated.View entering={FadeInDown.duration(350).delay(index * 70)}>{children}</Animated.View>;
}

export default function CircleScreen() {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((state) => state.user?.id);
  const circleId = useAuthStore((state) => state.activeCircleId);
  const scrollRef = useRef<ScrollView>(null);
  const tabBarClearance = useTabBarClearance();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { data: garden } = useGardenState(circleId ?? undefined);
  const { data: goals } = useGoals(circleId ?? undefined);
  const { data: moods } = useTodayMoodCheckins(circleId ?? undefined);

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.page, { paddingBottom: tabBarClearance }]}>
        <View style={styles.header}>
          <CirclePicker variant="title" />
          <TouchableOpacity style={styles.settingsRow} onPress={() => navigation.navigate('CircleSettings')}>
            <SettingsIcon width={15} height={15} color={theme.colors.textSecondary} />
            <Text style={styles.settingsLink}>Settings</Text>
          </TouchableOpacity>
        </View>

        {circleId && (
          <Reveal index={0}>
            <CircleHealthCard circleId={circleId} needsSupportCount={attentionRows.length} />
          </Reveal>
        )}
        {userId && circleId && (
          <Reveal index={1}>
            <CircleTodaySection circleId={circleId} userId={userId} rows={attentionRows} />
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

function createStyles({ colors }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    page: { padding: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 48, paddingHorizontal: 8 },
    settingsLink: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  });
}
