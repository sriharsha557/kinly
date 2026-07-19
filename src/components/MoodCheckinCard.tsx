import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { useCircleMembers } from '../hooks/useCircles';
import { useSubmitMoodCheckin, useTodayMoodCheckins } from '../hooks/useMoodCheckins';
import { categoryColors, colors, radii, shadow } from '../theme/colors';
import type { MoodValue } from '../types/models';

const MOODS: { value: MoodValue; emoji: string; label: string }[] = [
  { value: 'great', emoji: '😊', label: 'Great' },
  { value: 'okay', emoji: '😐', label: 'Okay' },
  { value: 'tough', emoji: '😞', label: 'Tough' },
];

const MOOD_EMOJI: Record<MoodValue, string> = { great: '😊', okay: '😐', tough: '😞' };

// Works with zero goals set - deliberately the first thing a brand-new user
// can do, and the only Today card that doesn't need any goal data to be
// useful. Two states: pick a mood, then flip to the circle's grid for
// today. Members who haven't checked in show a quiet, uncolored
// placeholder - never a red mark. No shame mechanics.
export function MoodCheckinCard({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: checkins, isLoading } = useTodayMoodCheckins(circleId);
  const { data: members } = useCircleMembers(circleId);
  const submitMood = useSubmitMoodCheckin(circleId, userId);
  const [submittingMood, setSubmittingMood] = useState<MoodValue | null>(null);

  if (isLoading) return null;

  const myCheckin = checkins?.find((c) => c.user_id === userId);
  const activeMembers = (members ?? []).filter((m) => m.status === 'active');

  async function handlePick(mood: MoodValue) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSubmittingMood(mood);
    try {
      await submitMood.mutateAsync(mood);
    } finally {
      setSubmittingMood(null);
    }
  }

  if (!myCheckin) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>How's today going?</Text>
        <View style={styles.pickRow}>
          {MOODS.map(({ value, emoji, label }) => (
            <AnimatedPressable
              key={value}
              style={styles.pickButton}
              onPress={() => handlePick(value)}
              disabled={submittingMood !== null}
            >
              <Text style={styles.pickEmoji}>{submittingMood === value ? '…' : emoji}</Text>
              <Text style={styles.pickLabel}>{label}</Text>
            </AnimatedPressable>
          ))}
        </View>
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.card}>
      <Text style={styles.title}>How the circle's doing today</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gridRow}>
        {activeMembers.map((member) => {
          const checkin = checkins?.find((c) => c.user_id === member.user_id);
          const firstName = (member.profiles?.name ?? 'Member').split(' ')[0];
          return (
            <View key={member.user_id} style={styles.memberChip}>
              <View style={[styles.moodBubble, checkin ? styles.moodBubbleFilled : styles.moodBubbleEmpty]}>
                <Text style={styles.moodBubbleText}>
                  {checkin ? MOOD_EMOJI[checkin.mood] : (member.profiles?.name ?? '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.memberName} numberOfLines={1}>
                {firstName}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: categoryColors.relationships.bg,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 16,
    ...shadow,
  },
  title: { fontSize: 15, fontWeight: '700', color: categoryColors.relationships.text, marginBottom: 12 },
  pickRow: { flexDirection: 'row', gap: 10 },
  pickButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  pickEmoji: { fontSize: 26 },
  pickLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  gridRow: { gap: 14 },
  memberChip: { alignItems: 'center', width: 52 },
  moodBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodBubbleFilled: { backgroundColor: colors.surface },
  moodBubbleEmpty: { backgroundColor: 'rgba(255,255,255,0.5)' },
  moodBubbleText: { fontSize: 18, fontWeight: '700', color: colors.textSecondary },
  memberName: { fontSize: 11, fontWeight: '600', color: categoryColors.relationships.text, marginTop: 4 },
});
