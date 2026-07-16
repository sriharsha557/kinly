import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../state/useAuthStore';
import { useEvents, useSendCheer, type EventWithProfile } from '../hooks/useEvents';
import { colors, categoryColors, radii, shadow } from '../theme/colors';
import type { EventType } from '../types/models';

const EVENT_STYLE: Record<EventType, { bg: string; text: string; icon: string }> = {
  goal_completed: { bg: categoryColors.health.bg, text: categoryColors.health.text, icon: '✅' },
  streak: { bg: '#FFE4D6', text: '#C2410C', icon: '🔥' },
  reminder: { bg: categoryColors.learning.bg, text: categoryColors.learning.text, icon: '⏰' },
  ask: { bg: categoryColors.ideas.bg, text: categoryColors.ideas.text, icon: '💬' },
};

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
  const sendCheer = useSendCheer(circleId);
  const time = new Date(event.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <View style={[styles.eventCard, { backgroundColor: style.bg }]}>
      <Text style={styles.eventIcon}>{style.icon}</Text>
      <View style={styles.eventBody}>
        <Text style={[styles.eventText, { color: style.text }]}>{describeEvent(event)}</Text>
        <Text style={styles.eventTime}>{time}</Text>
      </View>
      <TouchableOpacity
        style={styles.cheerButton}
        onPress={() => sendCheer.mutate({ eventId: event.id, userId })}
        disabled={sendCheer.isPending}
      >
        <Text style={styles.cheerButtonText}>Cheer</Text>
      </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.card,
    padding: 14,
    gap: 10,
    ...shadow,
  },
  eventIcon: { fontSize: 20 },
  eventBody: { flex: 1, gap: 2 },
  eventText: { fontSize: 14, fontWeight: '600' },
  eventTime: { fontSize: 11, color: colors.textSecondary },
  cheerButton: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cheerButtonText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
});
