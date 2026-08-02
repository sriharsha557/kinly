import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { FC } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { SvgProps } from 'react-native-svg';
import { useAuthStore } from '../state/useAuthStore';
import { useEvents, useSendNudge, type EventWithProfile } from '../hooks/useEvents';
import { useMomentsUnread, useMarkMomentsRead } from '../hooks/useMomentsUnread';
import { isUnreadFor, type UnreadCandidate } from '../lib/moments';
import { useWaterStreak, type StreakSaveReason } from '../hooks/useStreakSaves';
import { useBlockUser, useReportContent } from '../hooks/useReports';
import { showModerationSheet } from '../lib/moderation';
import { useSignedCheckinPhotoUrl } from '../hooks/useCheckinPhoto';
import { useNudgeCopy } from '../hooks/useNudgeCopy';
import { timeOfDayGreeting, todayDateLabel } from '../lib/greeting';
import { CircleWelcomeModal } from '../components/CircleWelcomeModal';
import { CirclePicker, CircleName } from '../components/CirclePicker';
import { GardenHero } from '../components/GardenHero';
import { MoodCheckinCard } from '../components/MoodCheckinCard';
import { TodayGoalsChecklist } from '../components/TodayGoalsChecklist';
import { QuickActionsRow } from '../components/QuickActionsRow';
import { EventRowSkeleton } from '../components/Skeleton';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { HappyIcon as HappyMono, NeutralIcon as NeutralMono, SadIcon as SadMono } from '../components/icons/MonoIcons';
import { GreetingIcon } from '../components/icons/GreetingIcon';
import { useTabBarClearance } from '../hooks/useTabBarClearance';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, motion, spacing, type } from '../theme/colors';
import type { EventType, MoodValue, NudgeKind } from '../types/models';
import CheckIcon from '../../assets/icons/feed/check.svg';
import StreakIcon from '../../assets/icons/nudges/streak.svg';
import CameraIcon from '../../assets/icons/feed/camera.svg';
import WaterIcon from '../../assets/icons/nudges/water.svg';
import NeutralIcon from '../../assets/icons/mood/neutral.svg';
import CheerIcon from '../../assets/icons/nudges/cheer.svg';
import WalkIcon from '../../assets/icons/nudges/walk.svg';
import WorkoutIcon from '../../assets/icons/nudges/workout.svg';
import StudyIcon from '../../assets/icons/nudges/study.svg';
import ClockIcon from '../../assets/icons/feed/clock.svg';
import ChatIcon from '../../assets/icons/feed/chat.svg';
import RocketIcon from '../../assets/icons/feed/rocket.svg';
import StartIcon from '../../assets/icons/feed/sprout.svg';
import CelebrateIcon from '../../assets/icons/feed/celebrate.svg';
import GalaxyIcon from '../../assets/icons/feed/galaxy.svg';
import WaveIcon from '../../assets/icons/feed/wave.svg';

// All event types now render on the same flat white card shell - color no
// longer differentiates event type, the icon does (see ARCHITECTURE.md's
// "Card shell" note). Previously each type had its own pastel background
// (peach/blue/yellow), which read as a rainbow of unrelated colors.
const EVENT_ICON: Record<EventType, FC<SvgProps>> = {
  goal_completed: CheckIcon,
  streak: StreakIcon,
  reminder: ClockIcon,
  ask: ChatIcon,
  challenge_completed: RocketIcon,
  mood_checkin: NeutralIcon,
  streak_saved: WaterIcon,
  progress_photo: CameraIcon,
  goal_started: StartIcon,
  achievement_unlocked: CelebrateIcon,
  garden_grew: GalaxyIcon,
  buddy_checkin: WaveIcon,
};

// Mood faces come from the prop-driven MonoIcons set, which takes {size,
// color} rather than SvgProps - hence the separate map and the prop-shape
// dispatch in EventIcon below. The EVENT_ICON assets tint too now (their
// fills were rewritten to currentColor), they just take a different prop
// shape, so both sides of that dispatch follow the accent.
const MOOD_MONO: Record<MoodValue, FC<{ size?: number; color: string }>> = {
  great: HappyMono,
  okay: NeutralMono,
  tough: SadMono,
};

// Thumbnail + tap-to-view-full-screen for an event's optional check-in
// photo (checkin-photos is a private bucket, so this always resolves a
// fresh signed URL rather than using a static one).
function EventPhoto({ path }: { path: string }) {
  const { data: url, isLoading } = useSignedCheckinPhotoUrl(path);
  const [viewing, setViewing] = useState(false);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (isLoading || !url) {
    return (
      <View style={[styles.photoThumb, styles.photoThumbLoading]}>
        <LoadingSpinner size={8} color={theme.colors.textSecondary} />
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity onPress={() => setViewing(true)} accessibilityRole="button" accessibilityLabel="View photo">
        <Image source={{ uri: url }} style={styles.photoThumb} />
      </TouchableOpacity>
      <Modal visible={viewing} transparent animationType="fade" onRequestClose={() => setViewing(false)}>
        <TouchableOpacity style={styles.photoOverlay} activeOpacity={1} onPress={() => setViewing(false)}>
          <Image source={{ uri: url }} style={styles.photoFull} resizeMode="contain" />
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// mood_checkin is the one event type whose icon isn't static per-type - the
// actual mood is far more expressive than a placeholder. It renders through
// the theme-tinted set, so this dispatches on prop shape rather than
// returning one component type.
function EventIcon({ event, color }: { event: EventWithProfile; color: string }) {
  if (event.type === 'mood_checkin') {
    const mood = (event.payload as Record<string, unknown>).mood as MoodValue;
    const Mono = MOOD_MONO[mood];
    if (Mono) return <Mono size={22} color={color} />;
  }
  const Icon = EVENT_ICON[event.type];
  return <Icon width={22} height={22} color={color} />;
}

// dayLabel feeds describeEvent's "took a ___ day" feed copy - kept separate
// from the Alert button label since "Something else" can't be mechanically
// turned into "a something else day."
const STREAK_SAVE_REASONS: { value: StreakSaveReason; label: string; dayLabel: string }[] = [
  { value: 'travel', label: '✈️ Travel', dayLabel: 'travel' },
  { value: 'sick', label: '🤒 Sick', dayLabel: 'sick' },
  { value: 'family', label: '👶 Family', dayLabel: 'family' },
  { value: 'work', label: '💼 Work', dayLabel: 'work' },
  { value: 'rest', label: '😴 Rest day', dayLabel: 'rest' },
  { value: 'other', label: 'Something else', dayLabel: 'rough' },
];

const NUDGE_KINDS: { kind: NudgeKind; Icon: FC<SvgProps>; label: string }[] = [
  { kind: 'cheer', Icon: CheerIcon, label: 'Cheer' },
  { kind: 'water', Icon: WaterIcon, label: 'Remind to drink water' },
  { kind: 'walk', Icon: WalkIcon, label: 'Remind to walk' },
  { kind: 'workout', Icon: WorkoutIcon, label: 'Remind to work out' },
  { kind: 'keep_going', Icon: StudyIcon, label: 'Encourage to keep going' },
  { kind: 'streak', Icon: StreakIcon, label: 'Cheer their streak' },
];

// Adapts a feed row to what the unread rule needs. buddy_checkin's user_id
// is the person reached out to, so its actor rides along in the payload.
function unreadCandidate(event: EventWithProfile): UnreadCandidate {
  return {
    created_at: event.created_at,
    user_id: event.user_id,
    actor_id: (event.payload as Record<string, unknown>)?.from_user_id as string | undefined,
  };
}

function describeEvent(event: EventWithProfile): string {
  const name = event.profiles?.name ?? 'Someone';
  const payload = event.payload as Record<string, unknown>;
  switch (event.type) {
    case 'goal_completed':
      return `${name} completed "${payload.title ?? 'a goal'}"`;
    case 'streak':
      return `${name} hit a ${payload.streak_count ?? ''} day streak`.trim();
    case 'reminder':
      return `${name} could use a nudge: ${payload.message ?? ''}`.trim();
    case 'ask':
      return `${name} asked: "${payload.question ?? ''}"`;
    case 'challenge_completed':
      return `Your circle completed "${payload.title ?? 'a challenge'}"! (${name} sealed it)`;
    case 'mood_checkin': {
      const mood = payload.mood as string;
      if (mood === 'tough') return `${name} is having a tough day`;
      if (mood === 'okay') return `${name} is having an okay day`;
      return `${name} is having a great day`;
    }
    case 'streak_saved': {
      const toName = (payload.to_user_name as string | undefined) ?? 'a friend';
      const dayLabel = STREAK_SAVE_REASONS.find((r) => r.value === payload.reason)?.dayLabel;
      return dayLabel ? `${toName} took a ${dayLabel} day` : `${name} watered ${toName}'s streak`;
    }
    case 'progress_photo':
      return `${name} logged progress on "${payload.title ?? 'a goal'}"`;
    case 'goal_started':
      return `${name} started "${payload.title ?? 'a goal'}"`;
    case 'achievement_unlocked':
      return `${name} unlocked "${payload.title ?? 'an achievement'}"`;
    case 'garden_grew': {
      const stage = payload.stage as string | undefined;
      const stageLabel =
        stage === 'bloom' ? 'is blooming' : stage === 'tree' ? 'grew into a tree' : 'sprouted';
      return `${name}'s garden ${stageLabel}`;
    }
    case 'buddy_checkin':
      // Not only buddies send these any more - the Circle tab's member rows
      // use the same event type to reach anyone in the circle.
      return `${name} got a check-in from a circle-mate`;
    default:
      return `${name} had an update`;
  }
}

function goalTitleFromEvent(event: EventWithProfile): string | undefined {
  const payload = event.payload as Record<string, unknown>;
  return typeof payload.title === 'string' ? payload.title : undefined;
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function EventRow({ event, circleId, userId }: { event: EventWithProfile; circleId: string; userId: string }) {
  const sendNudge = useSendNudge(circleId);
  const waterStreak = useWaterStreak(circleId);
  const reportContent = useReportContent();
  const blockUser = useBlockUser();
  const [sendingKind, setSendingKind] = useState<NudgeKind | null>(null);
  const { nudgeCopy } = useNudgeCopy();
  // Tertiary-level feed (design/REDESIGN.md §4): nudge actions are
  // revealed by tapping the row instead of six always-visible buttons per
  // event - the feed reads as quiet rows until you choose to react.
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const time = new Date(event.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  function handleNudgeOptions(nudgeId: string, authorId: string, authorName: string) {
    if (authorId === userId) return;
    showModerationSheet({
      authorName,
      onReport: (reason) => reportContent.mutate({ targetType: 'nudge', targetId: nudgeId, reason }),
      onBlock: () => blockUser.mutate(authorId),
    });
  }

  async function handleNudge(kind: NudgeKind) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSendingKind(kind);
    try {
      const recipientName = event.profiles?.name ?? 'your friend';
      // streak_count comes off the same payload describeEvent already reads.
      // Without it, the two seeded 'streak' messages that use {streak} were
      // permanently ineligible - including the highest-weighted one - so the
      // "Cheer their streak" button drew from 4 of its 6 lines.
      const streakCount = (event.payload as Record<string, unknown>)?.streak_count;
      const message = nudgeCopy(kind, {
        name: recipientName,
        goal: goalTitleFromEvent(event),
        streak: typeof streakCount === 'number' ? streakCount : undefined,
      });
      await sendNudge.mutateAsync({ eventId: event.id, userId, kind, message });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setSendingKind(null);
    }
  }

  // Only reminder events (streak-at-risk) carry a goal_id, and never for
  // your own streak - watering yourself makes no sense.
  const payload = event.payload as Record<string, unknown>;
  const waterableGoalId =
    event.type === 'reminder' && event.user_id !== userId ? (payload.goal_id as string | undefined) : undefined;

  async function confirmWater(reason?: StreakSaveReason) {
    if (!waterableGoalId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await waterStreak.mutateAsync({ goalId: waterableGoalId, reason });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Could not water this streak', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  // Optional, never blocking - "Skip" waters the streak exactly like before
  // this existed. Naming a reason just gives the circle a kinder story than
  // a bare "watered their streak" ("Harsha took a travel day" vs nothing).
  function handleWater() {
    if (!waterableGoalId) return;
    Alert.alert('Why were they away?', "Optional - your circle will see this instead of a plain missed day.", [
      ...STREAK_SAVE_REASONS.map(({ value, label }) => ({ text: label, onPress: () => confirmWater(value) })),
      { text: 'Skip', onPress: () => confirmWater(undefined) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  const isCelebration = event.type === 'streak' || event.type === 'goal_completed';

  return (
    <Animated.View
      entering={
        isCelebration
          ? ZoomIn.springify().damping(motion.damping.pop)
          : FadeInDown.duration(motion.duration.entrance)
      }
      style={styles.eventCard}
    >
      <TouchableOpacity
        style={styles.eventHeader}
        onPress={() => setExpanded((prev) => !prev)}
        disabled={event.user_id === userId}
        accessibilityRole="button"
        accessibilityLabel={`${describeEvent(event)}. ${expanded ? 'Hide' : 'Show'} reactions`}
      >
        <EventIcon event={event} color={theme.colors.primary} />
        <View style={styles.eventBody}>
          <Text style={styles.eventText}>{describeEvent(event)}</Text>
          <Text style={styles.eventTime}>{time}</Text>
        </View>
      </TouchableOpacity>

      {typeof payload.photo_path === 'string' && <EventPhoto path={payload.photo_path} />}

      {event.user_id !== userId && expanded && (
        <View style={styles.nudgeRow}>
          {NUDGE_KINDS.map(({ kind, Icon: NudgeIcon, label }) => (
            <TouchableOpacity
              key={kind}
              style={styles.nudgeButton}
              onPress={() => handleNudge(kind)}
              disabled={sendingKind !== null}
              accessibilityRole="button"
              accessibilityLabel={label}
              hitSlop={4}
            >
              {sendingKind === kind ? <Text style={styles.nudgeButtonText}>…</Text> : <NudgeIcon width={18} height={18} color={theme.colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {waterableGoalId && (
        <TouchableOpacity
          style={styles.waterButton}
          onPress={handleWater}
          disabled={waterStreak.isPending}
          accessibilityRole="button"
          accessibilityLabel="Water their streak"
        >
          {waterStreak.isPending ? (
            <Text style={styles.waterButtonText}>Watering…</Text>
          ) : (
            <View style={styles.waterButtonRow}>
              <WaterIcon width={14} height={14} color={theme.colors.primary} />
              <Text style={styles.waterButtonText}>Water their streak</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {event.nudges.length > 0 && (
        <View style={styles.nudgeList}>
          {event.nudges.map((nudge) => (
            <TouchableOpacity
              key={nudge.id}
              onLongPress={() => handleNudgeOptions(nudge.id, nudge.from_user_id, nudge.profiles?.name ?? 'Someone')}
              delayLongPress={400}
            >
              <Text style={styles.nudgeMessage}>
                <Text style={styles.nudgeSender}>{nudge.profiles?.name ?? 'Someone'}: </Text>
                {nudge.message}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

export default function TodayScreen() {
  const user = useAuthStore((state) => state.user);
  const userId = user?.id;
  const circleId = useAuthStore((state) => state.activeCircleId);
  const {
    data,
    isLoading,
    isFetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useEvents(circleId ?? undefined);
  const events = data?.pages.flat();
  const { lastReadAt, isLoaded: readStateLoaded } = useMomentsUnread(circleId ?? undefined, userId);
  const markRead = useMarkMomentsRead(circleId ?? undefined, userId);

  // lastReadAtRef always mirrors the latest lastReadAt from the query, kept
  // current on every render (not just while focused) so the focus effect
  // below can read "the value right now" without needing lastReadAt in its
  // dependency array.
  const lastReadAtRef = useRef(lastReadAt);
  lastReadAtRef.current = lastReadAt;

  // Arriving at the screen counts as reading, per the spec - not scrolling.
  // The stamp captured on focus is held in lastReadAtOnEntry so the "New"
  // divider stays put while you read, instead of vanishing the instant the
  // stamp updates.
  //
  // markRead.mutate()'s onSuccess invalidates the moments-unread query,
  // which changes lastReadAt once the refetch lands. If lastReadAt were a
  // dependency of this callback, that change would re-run the effect while
  // still focused, stamp again, invalidate again, and loop forever - and
  // also overwrite lastReadAtOnEntry with the fresh stamp, making the "New"
  // divider vanish instead of holding still. hasStampedRef guards against
  // exactly that: it makes the effect body run at most once per focus (using
  // lastReadAtRef.current, captured before this visit's stamp fires),
  // regardless of how many times lastReadAt changes while focused, and
  // resets on blur so the next focus stamps again.
  const [lastReadAtOnEntry, setLastReadAtOnEntry] = useState<string | null>(null);
  const hasStampedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      // Wait for the read state to actually load before stamping. lastReadAt
      // is null while the query is in flight *and* when the member has never
      // read the feed, so stamping too early would capture null on every
      // cold start and file the whole feed under "New".
      if (readStateLoaded && !hasStampedRef.current) {
        hasStampedRef.current = true;
        setLastReadAtOnEntry(lastReadAtRef.current);
        markRead.mutate();
      }
      return () => {
        hasStampedRef.current = false;
      };
      // markRead is a stable React Query mutation object; lastReadAtRef is a
      // ref (its identity never changes) and is always read via .current, so
      // neither belongs in this dependency array. readStateLoaded does: it
      // flips false->true once when the query settles, and the effect has to
      // re-run then or a screen focused before the fetch lands would never
      // stamp at all. That flip happens once per mount and hasStampedRef
      // absorbs it, so this still stamps exactly once per focus - unlike
      // lastReadAt, which changes on every stamp and would loop.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [readStateLoaded]),
  );
  const tabBarClearance = useTabBarClearance();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  let lastLabel = '';

  return (
    <SafeAreaView style={styles.container}>
      {circleId && <CircleWelcomeModal />}
      <ScrollView
        contentContainerStyle={[styles.page, { paddingBottom: tabBarClearance }]}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={theme.colors.primary} />
        }
      >
        {/* The action, not the identity. This used to be the circle's name
            with a chevron, and nobody found it - a name that happens to be
            tappable reads as a label. The name itself now sits with the
            garden it describes, below. */}
        <CirclePicker />
        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>
            {timeOfDayGreeting()}, {user?.name?.split(' ')[0] ?? 'there'}
          </Text>
          {/* Decorative, not interactive - so it takes textSecondary, not
              the accent (design/PRINCIPLES.md's one-accent rule). */}
          <GreetingIcon size={22} color={theme.colors.textSecondary} />
        </View>
        <Text style={styles.date}>{todayDateLabel()}</Text>

        {/* Hierarchy (2026-07 pass, supersedes design/REDESIGN.md §4's
            mood-first order): garden state leads, today's mission is the
            next action, mood check-in follows, shortcuts + feed are
            tertiary - each section sets up the one below it. */}
        {/* Named right above the thing it belongs to, so "whose garden is
            this?" is answered where the question gets asked. */}
        {circleId && <CircleName />}
        {circleId && <GardenHero circleId={circleId} />}
        {userId && circleId && <TodayGoalsChecklist circleId={circleId} userId={userId} />}
        {userId && circleId && <MoodCheckinCard circleId={circleId} userId={userId} />}
        <QuickActionsRow />

        <Text style={styles.sectionTitle}>Moments</Text>
        {isLoading ? (
          <View>
            <EventRowSkeleton />
            <EventRowSkeleton />
            <EventRowSkeleton />
          </View>
        ) : events && events.length > 0 ? (
          <View style={styles.list}>
            {events.map((event, index) => {
              const label = dayLabel(event.created_at);
              const showHeader = label !== lastLabel;
              lastLabel = label;
              // Shares isUnreadFor with the tab-bar dot rather than
              // restating the rule, so the divider and the dot can never
              // disagree about which events are new - including for
              // buddy_checkin, whose actor is in the payload, not user_id.
              const isUnread = userId ? isUnreadFor(unreadCandidate(event), lastReadAtOnEntry, userId) : false;
              const previous = index > 0 ? events[index - 1] : null;
              const previousUnread =
                previous !== null &&
                !!userId &&
                isUnreadFor(unreadCandidate(previous), lastReadAtOnEntry, userId);
              const showNewDivider = isUnread && !previousUnread;
              return (
                <View key={event.id}>
                  {showNewDivider && <Text style={styles.newDivider}>New</Text>}
                  {showHeader && <Text style={styles.dayHeader}>{label}</Text>}
                  {userId && circleId && <EventRow event={event} circleId={circleId} userId={userId} />}
                </View>
              );
            })}
            {hasNextPage && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                accessibilityRole="button"
                accessibilityLabel="Load more activity"
              >
                {isFetchingNextPage ? (
                  <LoadingSpinner size={14} />
                ) : (
                  <Text style={styles.loadMoreLabel}>Load more</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Your journey starts today.</Text>
            <Text style={styles.emptyBody}>
              Complete your first goal to grow your garden and inspire your circle.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles({ colors, radii, shadow, cardShell }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    page: { padding: spacing.lg },
    greetingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    greeting: { fontSize: 26, fontFamily: fontFamily.bold, color: colors.textPrimary },
    date: { fontSize: 14, fontFamily: fontFamily.regular, color: colors.textSecondary, marginBottom: spacing.lg },
    sectionTitle: { fontSize: 20, fontFamily: fontFamily.bold, color: colors.textPrimary, marginBottom: spacing.md },
    list: { gap: 10 },
    dayHeader: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.textSecondary, marginTop: spacing.md, marginBottom: 6 },
    newDivider: {
      fontSize: 13,
      fontFamily: fontFamily.bold,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.primary,
      marginTop: spacing.md,
      marginBottom: 2,
    },
    loadMoreButton: {
      alignSelf: 'center',
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      minHeight: 48,
      justifyContent: 'center',
      borderRadius: radii.pill,
      backgroundColor: colors.inputBg,
    },
    loadMoreLabel: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.primary },
    // Tertiary level: no card chrome - quiet rows on the screen background
    // with a hairline separator (design/REDESIGN.md §4).
    eventCard: {
      paddingVertical: 6,
      gap: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    eventHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
    eventBody: { flex: 1, gap: 2 },
    eventText: { fontSize: 16, lineHeight: 22, fontFamily: fontFamily.semibold, color: colors.shellTitle },
    eventTime: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.textSecondary },
    nudgeRow: { flexDirection: 'row', gap: 6 },
    nudgeButton: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.pill,
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nudgeButtonText: { fontSize: 16, fontFamily: fontFamily.regular },
    waterButton: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.pill,
      minHeight: 48,
      justifyContent: 'center',
      alignItems: 'center',
    },
    waterButtonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    waterButtonText: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.primary },
    nudgeList: { gap: spacing.xs },
    photoThumb: { width: '100%', height: 160, borderRadius: radii.input },
    photoThumbLoading: { backgroundColor: colors.pillBg, alignItems: 'center', justifyContent: 'center' },
    photoOverlay: { flex: 1, backgroundColor: colors.overlayStrong, alignItems: 'center', justifyContent: 'center' },
    photoFull: { width: '100%', height: '80%' },
    nudgeMessage: { ...type.secondary, color: colors.textPrimary },
    nudgeSender: { fontFamily: fontFamily.bold },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.card,
      padding: spacing.xxl,
      alignItems: 'center',
      gap: 6,
      ...shadow,
    },
    emptyTitle: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.textPrimary, textAlign: 'center' },
    emptyBody: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  });
}
