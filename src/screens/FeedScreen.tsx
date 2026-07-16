import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../state/useAuthStore';
import { useEvents, useSendNudge, type EventWithProfile } from '../hooks/useEvents';
import { generateNudgeMessage } from '../lib/nudgeMessage';
import { colors, categoryColors, radii, shadow } from '../theme/colors';
import type { EventType, NudgeKind } from '../types/models';

const EVENT_STYLE: Record<EventType, { bg: string; text: string; icon: string }> = {
  goal_completed: { bg: categoryColors.health.bg, text: categoryColors.health.text, icon: '✅' },
  streak: { bg: '#FFE4D6', text: '#C2410C', icon: '🔥' },
  reminder: { bg: categoryColors.learning.bg, text: categoryColors.learning.text, icon: '⏰' },
  ask: { bg: categoryColors.ideas.bg, text: categoryColors.ideas.text, icon: '💬' },
};

const NUDGE_KINDS: { kind: NudgeKind; emoji: string }[] = [
  { kind: 'cheer', emoji: '👏' },
  { kind: 'water', emoji: '💧' },
  { kind: 'walk', emoji: '🚶' },
  { kind: 'workout', emoji: '💪' },
  { kind: 'keep_going', emoji: '📚' },
  { kind: 'streak', emoji: '🔥' },
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
    setSendingKind(kind);
    try {
      const recipientName = event.profiles?.name ?? 'your friend';
      const message = await generateNudgeMessage(kind, recipientName, goalTitleFromEvent(event));
      await sendNudge.mutateAsync({ eventId: event.id, userId, kind, message });
    } finally {
      setSendingKind(null);
    }
  }

  return (
    <View style={[styles.eventCard, { backgroundColor: style.bg }]}>
      <View style={styles.eventHeader}>
        <Text style={styles.eventIcon}>{style.icon}</Text>
        <View style={styles.eventBody}>
          <Text style={[styles.eventText, { color: style.text }]}>{describeEvent(event)}</Text>
          <Text style={styles.eventTime}>{time}</Text>
        </View>
      </View>

      <View style={styles.nudgeRow}>
        {NUDGE_KINDS.map(({ kind, emoji }) => (
          <TouchableOpacity
            key={kind}
            style={styles.nudgeButton}
            onPress={() => handleNudge(kind)}
            disabled={sendingKind !== null}
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
    </View>
  );
}

export default function FeedScreen() {
  const userId = useAuthStore((state) => state.user?.id);
  const circleId = useAuthStore((state) => state.activeCircleId);
  const { data: events, isLoading } = useEvents(circleId ?? undefined);

  let lastLabel = '';

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Feed</Text>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : events && events.length > 0 ? (
        <ScrollView contentContainerStyle={styles.list}>
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
        </ScrollView>
      ) : (
        <Text style={styles.empty}>
          Nothing yet — complete a goal to send your first update to the circle.
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
  list: { paddingBottom: 110, gap: 10 },
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
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeButtonText: { fontSize: 16 },
  nudgeList: { gap: 4 },
  nudgeMessage: { fontSize: 13, color: colors.textPrimary },
  nudgeSender: { fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
});
