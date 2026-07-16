import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../state/useAuthStore';
import { useEvents, useSendNudge, type EventWithProfile } from '../hooks/useEvents';
import { useGoals, useCreateGoal } from '../hooks/useGoals';
import { generateNudgeMessage } from '../lib/nudgeMessage';
import { pickSuggestions, type GoalSuggestion } from '../lib/suggestions';
import { PillButton } from '../components/PillButton';
import { GardenCard } from '../components/GardenCard';
import { ChallengesCard } from '../components/ChallengesCard';
import { BuddyCard } from '../components/BuddyCard';
import { WeeklyRecapCard } from '../components/WeeklyRecapCard';
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

function CustomizeGoalModal({
  suggestion,
  circleId,
  userId,
  onClose,
}: {
  suggestion: GoalSuggestion;
  circleId: string;
  userId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(suggestion.title);
  const [target, setTarget] = useState(String(suggestion.target));
  const createGoal = useCreateGoal();

  async function handleSave() {
    const targetValue = Number(target);
    if (!title.trim() || !targetValue) return;
    await createGoal.mutateAsync({ circleId, userId, title: title.trim(), target: targetValue });
    onClose();
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Customize goal</Text>
          <TextInput style={styles.modalInput} value={title} onChangeText={setTitle} placeholder="Goal title" />
          <TextInput
            style={styles.modalInput}
            value={target}
            onChangeText={setTarget}
            placeholder="Target"
            keyboardType="numeric"
          />
          <View style={styles.modalButtons}>
            <PillButton label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <PillButton
              label="Save"
              onPress={handleSave}
              loading={createGoal.isPending}
              disabled={!title.trim() || !target}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SuggestionCard({ suggestion, onPress }: { suggestion: GoalSuggestion; onPress: () => void }) {
  const category = categoryColors[suggestion.category];

  return (
    <TouchableOpacity style={[styles.suggestionCard, { backgroundColor: category.bg }]} onPress={onPress}>
      <Text style={[styles.suggestionText, { color: category.text }]}>{suggestion.title}</Text>
      <Text style={[styles.suggestionAdd, { color: category.text }]}>+ Add</Text>
    </TouchableOpacity>
  );
}

function SuggestionsRow({ circleId, userId }: { circleId: string; userId: string }) {
  const interests = useAuthStore((state) => state.user?.interests) ?? [];
  const { data: goals } = useGoals(circleId);
  const suggestions = pickSuggestions(interests, (goals ?? []).map((g) => g.title));
  const [editing, setEditing] = useState<GoalSuggestion | null>(null);

  if (suggestions.length === 0) return null;

  return (
    <View style={styles.suggestionsSection}>
      <Text style={styles.sectionTitle}>Suggested for you</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsRow}>
        {suggestions.map((s) => (
          <SuggestionCard key={s.title} suggestion={s} onPress={() => setEditing(s)} />
        ))}
      </ScrollView>
      {editing && (
        <CustomizeGoalModal
          suggestion={editing}
          circleId={circleId}
          userId={userId}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
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

        {circleId && <GardenCard circleId={circleId} />}

        {userId && circleId && <BuddyCard circleId={circleId} userId={userId} />}

        {userId && circleId && <ChallengesCard circleId={circleId} userId={userId} />}

        {circleId && <WeeklyRecapCard circleId={circleId} />}

        {userId && circleId && <SuggestionsRow circleId={circleId} userId={userId} />}

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
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  suggestionsSection: { marginBottom: 20 },
  suggestionsRow: { gap: 10, paddingRight: 16 },
  suggestionCard: {
    borderRadius: radii.card,
    padding: 14,
    width: 160,
    justifyContent: 'space-between',
    gap: 12,
  },
  suggestionText: { fontSize: 13, fontWeight: '600' },
  suggestionAdd: { fontSize: 12, fontWeight: '800' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalInput: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
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
