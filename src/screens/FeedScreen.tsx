import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../state/useAuthStore';
import { useEvents, useSendNudge, type EventWithProfile } from '../hooks/useEvents';
import { generateNudgeMessage } from '../lib/nudgeMessage';
import { CirclePulseStrip } from '../components/CirclePulseStrip';
import { colors, categoryColors, radii, shadow } from '../theme/colors';
import type { EventType, NudgeKind } from '../types/models';

const EVENT_STYLE: Record<EventType, { bg: string; text: string; icon: string }> = {
  goal_completed: { bg: categoryColors.health.bg, text: categoryColors.health.text, icon: '✅' },
  streak: { bg: '#FFE4D6', text: '#C2410C', icon: '🔥' },
  reminder: { bg: categoryColors.learning.bg, text: categoryColors.learning.text, icon: '⏰' },
  ask: { bg: categoryColors.ideas.bg, text: categoryColors.ideas.text, icon: '💬' },
  challenge_completed: { bg: categoryColors.wealth.bg, text: categoryColors.wealth.text, icon: '🚀' },
};

const NUDGE_KINDS: { kind: NudgeKind; emoji: string; label: string }[] = [
  { kind: 'cheer', emoji: '👏', label: 'Cheer' },
  { kind: 'water', emoji: '💧', label: 'Remind to drink water' },
  { kind: 'walk', emoji: '🚶', label: 'Remind to walk' },
  { kind: 'workout', emoji: '💪', label: 'Remind to work out' },
  { kind: 'keep_going', emoji: '📚', label: 'Encourage to keep going' },
  { kind: 'streak', emoji: '🔥', label: 'Cheer their streak' },
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

  const isCelebration = event.type === 'streak' || event.type === 'goal_completed';

  return (
    <Animated.View
      entering={isCelebration ? ZoomIn.springify().damping(14) : FadeInDown.duration(350)}
      style={[styles.eventCard, { backgroundColor: style.bg }]}
    >
      <View style={styles.eventHeader}>
        <Text style={styles.eventIcon}>{style.icon}</Text>
        <View style={styles.eventBody}>
          <Text style={[styles.eventText, { color: style.text }]}>{describeEvent(event)}</Text>
          <Text style={styles.eventTime}>{time}</Text>
        </View>
      </View>

      <View style={styles.nudgeRow}>
        {NUDGE_KINDS.map(({ kind, emoji, label }) => (
          <TouchableOpacity
            key={kind}
            style={styles.nudgeButton}
            onPress={() => handleNudge(kind)}
            disabled={sendingKind !== null}
            accessibilityRole="button"
            accessibilityLabel={label}
            hitSlop={4}
          >
            <Text style={styles.nudgeButtonText}>{sendingKind === kind ? '…' : emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>

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

export default function FeedScreen() {
  const userId = useAuthStore((state) => state.user?.id);
  const circleId = useAuthStore((state) => state.activeCircleId);
  const { data: events, isLoading } = useEvents(circleId ?? undefined);

  let lastLabel = '';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.title}>Feed</Text>

        {circleId && <CirclePulseStrip circleId={circleId} />}

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
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
          <Text style={styles.empty}>
            Nothing yet — complete a goal to send your first update to the circle.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  page: { padding: 16, paddingBottom: 110 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
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
  nudgeList: { gap: 4 },
  nudgeMessage: { fontSize: 13, color: colors.textPrimary },
  nudgeSender: { fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
});
