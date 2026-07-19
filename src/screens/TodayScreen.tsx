import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { FC } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { SvgProps } from 'react-native-svg';
import { useAuthStore } from '../state/useAuthStore';
import { useEvents, useSendNudge, type EventWithProfile } from '../hooks/useEvents';
import { useWaterStreak } from '../hooks/useStreakSaves';
import { useSignedCheckinPhotoUrl } from '../hooks/useCheckinPhoto';
import { generateNudgeMessage } from '../lib/nudgeMessage';
import { timeOfDayGreeting, todayDateLabel } from '../lib/greeting';
import { GardenTeaser } from '../components/GardenTeaser';
import { MoodCheckinCard } from '../components/MoodCheckinCard';
import { TodayGoalsChecklist } from '../components/TodayGoalsChecklist';
import { QuickActionsRow } from '../components/QuickActionsRow';
import { EventRowSkeleton } from '../components/Skeleton';
import { useTabBarClearance } from '../hooks/useTabBarClearance';
import { colors, categoryColors, radii, shadow } from '../theme/colors';
import type { EventType, NudgeKind } from '../types/models';
import CheckIcon from '../../assets/icons/feed/check.svg';
import StreakIcon from '../../assets/icons/nudges/streak.svg';
import CameraIcon from '../../assets/icons/feed/camera.svg';
import WaterIcon from '../../assets/icons/nudges/water.svg';
import HappyIcon from '../../assets/icons/mood/happy.svg';
import NeutralIcon from '../../assets/icons/mood/neutral.svg';
import SadIcon from '../../assets/icons/mood/sad.svg';
import CheerIcon from '../../assets/icons/nudges/cheer.svg';
import WalkIcon from '../../assets/icons/nudges/walk.svg';
import WorkoutIcon from '../../assets/icons/nudges/workout.svg';
import StudyIcon from '../../assets/icons/nudges/study.svg';
import WaveIcon from '../../assets/icons/feed/wave.svg';
import ClockIcon from '../../assets/icons/feed/clock.svg';
import ChatIcon from '../../assets/icons/feed/chat.svg';
import RocketIcon from '../../assets/icons/feed/rocket.svg';

type EventIcon = FC<SvgProps> | string;

const EVENT_STYLE: Record<EventType, { bg: string; text: string; icon: EventIcon }> = {
  goal_completed: { bg: categoryColors.health.bg, text: categoryColors.health.text, icon: CheckIcon },
  streak: { bg: '#FFE4D6', text: '#C2410C', icon: StreakIcon },
  reminder: { bg: categoryColors.learning.bg, text: categoryColors.learning.text, icon: ClockIcon },
  ask: { bg: categoryColors.ideas.bg, text: categoryColors.ideas.text, icon: ChatIcon },
  challenge_completed: { bg: categoryColors.wealth.bg, text: categoryColors.wealth.text, icon: RocketIcon },
  mood_checkin: { bg: categoryColors.wealth.bg, text: categoryColors.wealth.text, icon: NeutralIcon },
  streak_saved: { bg: categoryColors.ideas.bg, text: categoryColors.ideas.text, icon: WaterIcon },
  progress_photo: { bg: categoryColors.health.bg, text: categoryColors.health.text, icon: CameraIcon },
};

const MOOD_ICON: Record<string, FC<SvgProps>> = { great: HappyIcon, okay: NeutralIcon, tough: SadIcon };

// Thumbnail + tap-to-view-full-screen for an event's optional check-in
// photo (checkin-photos is a private bucket, so this always resolves a
// fresh signed URL rather than using a static one).
function EventPhoto({ path }: { path: string }) {
  const { data: url, isLoading } = useSignedCheckinPhotoUrl(path);
  const [viewing, setViewing] = useState(false);

  if (isLoading || !url) {
    return (
      <View style={[styles.photoThumb, styles.photoThumbLoading]}>
        <ActivityIndicator size="small" color={colors.textSecondary} />
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
// actual mood (😊/😐/😞) is far more expressive than a placeholder.
function eventIcon(event: EventWithProfile): EventIcon {
  if (event.type === 'mood_checkin') {
    const mood = (event.payload as Record<string, unknown>).mood as string;
    return MOOD_ICON[mood] ?? EVENT_STYLE.mood_checkin.icon;
  }
  return EVENT_STYLE[event.type].icon;
}

const NUDGE_KINDS: { kind: NudgeKind; Icon: FC<SvgProps>; label: string }[] = [
  { kind: 'cheer', Icon: CheerIcon, label: 'Cheer' },
  { kind: 'water', Icon: WaterIcon, label: 'Remind to drink water' },
  { kind: 'walk', Icon: WalkIcon, label: 'Remind to walk' },
  { kind: 'workout', Icon: WorkoutIcon, label: 'Remind to work out' },
  { kind: 'keep_going', Icon: StudyIcon, label: 'Encourage to keep going' },
  { kind: 'streak', Icon: StreakIcon, label: 'Cheer their streak' },
];

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
      return `Your circle completed "${payload.title ?? 'a challenge'}"! 🎉 (${name} sealed it)`;
    case 'mood_checkin': {
      const mood = payload.mood as string;
      if (mood === 'tough') return `${name} is having a tough day`;
      if (mood === 'okay') return `${name} is having an okay day`;
      return `${name} is having a great day`;
    }
    case 'streak_saved':
      return `${name} watered ${payload.to_user_name ?? "a friend's"} streak 💧`;
    case 'progress_photo':
      return `${name} logged progress on "${payload.title ?? 'a goal'}"`;
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
  const style = EVENT_STYLE[event.type];
  const sendNudge = useSendNudge(circleId);
  const waterStreak = useWaterStreak(circleId);
  const [sendingKind, setSendingKind] = useState<NudgeKind | null>(null);
  const time = new Date(event.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  async function handleNudge(kind: NudgeKind) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSendingKind(kind);
    try {
      const recipientName = event.profiles?.name ?? 'your friend';
      const message = await generateNudgeMessage(kind, recipientName, goalTitleFromEvent(event));
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

  async function handleWater() {
    if (!waterableGoalId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await waterStreak.mutateAsync(waterableGoalId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Could not water this streak', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  const isCelebration = event.type === 'streak' || event.type === 'goal_completed';

  return (
    <Animated.View
      entering={isCelebration ? ZoomIn.springify().damping(14) : FadeInDown.duration(350)}
      style={[styles.eventCard, { backgroundColor: style.bg }]}
    >
      <View style={styles.eventHeader}>
        {(() => {
          const Icon = eventIcon(event);
          return typeof Icon === 'string' ? (
            <Text style={styles.eventIcon}>{Icon}</Text>
          ) : (
            <Icon width={20} height={20} />
          );
        })()}
        <View style={styles.eventBody}>
          <Text style={[styles.eventText, { color: style.text }]}>{describeEvent(event)}</Text>
          <Text style={styles.eventTime}>{time}</Text>
        </View>
      </View>

      {typeof payload.photo_path === 'string' && <EventPhoto path={payload.photo_path} />}

      {event.user_id !== userId && (
        <View style={styles.nudgeRow}>
          {NUDGE_KINDS.map(({ kind, Icon, label }) => (
            <TouchableOpacity
              key={kind}
              style={styles.nudgeButton}
              onPress={() => handleNudge(kind)}
              disabled={sendingKind !== null}
              accessibilityRole="button"
              accessibilityLabel={label}
              hitSlop={4}
            >
              {sendingKind === kind ? <Text style={styles.nudgeButtonText}>…</Text> : <Icon width={18} height={18} />}
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
          <Text style={styles.waterButtonText}>{waterStreak.isPending ? 'Watering…' : '💧 Water their streak'}</Text>
        </TouchableOpacity>
      )}

      {event.nudges.length > 0 && (
        <View style={styles.nudgeList}>
          {event.nudges.map((nudge) => (
            <Text key={nudge.id} style={styles.nudgeMessage}>
              <Text style={styles.nudgeSender}>{nudge.profiles?.name ?? 'Someone'}: </Text>
              {nudge.message}
            </Text>
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
  const { data: events, isLoading, isFetching, refetch } = useEvents(circleId ?? undefined);
  const tabBarClearance = useTabBarClearance();

  let lastLabel = '';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingBottom: tabBarClearance }]}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>
            {timeOfDayGreeting()}, {user?.name?.split(' ')[0] ?? 'there'}
          </Text>
          <WaveIcon width={22} height={22} />
        </View>
        <Text style={styles.date}>{todayDateLabel()}</Text>

        {userId && circleId && <MoodCheckinCard circleId={circleId} userId={userId} />}
        {circleId && <GardenTeaser circleId={circleId} />}
        {userId && circleId && <TodayGoalsChecklist circleId={circleId} userId={userId} />}
        <QuickActionsRow />

        <Text style={styles.sectionTitle}>Circle Activity</Text>
        {isLoading ? (
          <View>
            <EventRowSkeleton />
            <EventRowSkeleton />
            <EventRowSkeleton />
          </View>
        ) : events && events.length > 0 ? (
          <View style={styles.list}>
            {events.map((event) => {
              const label = dayLabel(event.created_at);
              const showHeader = label !== lastLabel;
              lastLabel = label;
              return (
                <View key={event.id}>
                  {showHeader && <Text style={styles.dayHeader}>{label}</Text>}
                  {userId && circleId && <EventRow event={event} circleId={circleId} userId={userId} />}
                </View>
              );
            })}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  page: { padding: 16 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  date: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  list: { gap: 10 },
  dayHeader: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 12, marginBottom: 6 },
  eventCard: {
    borderRadius: radii.card,
    padding: 14,
    gap: 10,
    ...shadow,
  },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventIcon: { fontSize: 20 },
  eventBody: { flex: 1, gap: 2 },
  eventText: { fontSize: 14, fontWeight: '600' },
  eventTime: { fontSize: 11, color: colors.textSecondary },
  nudgeRow: { flexDirection: 'row', gap: 6 },
  nudgeButton: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: radii.pill,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeButtonText: { fontSize: 16 },
  waterButton: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: radii.pill,
    paddingVertical: 8,
    alignItems: 'center',
  },
  waterButtonText: { fontSize: 13, fontWeight: '700', color: categoryColors.ideas.text },
  nudgeList: { gap: 4 },
  photoThumb: { width: '100%', height: 160, borderRadius: radii.input },
  photoThumbLoading: { backgroundColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  photoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  photoFull: { width: '100%', height: '80%' },
  nudgeMessage: { fontSize: 13, color: colors.textPrimary },
  nudgeSender: { fontWeight: '700' },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 24,
    alignItems: 'center',
    gap: 6,
    ...shadow,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  emptyBody: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
});
