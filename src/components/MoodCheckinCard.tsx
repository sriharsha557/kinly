import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { FC } from 'react';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';
import { AnimatedPressable } from './AnimatedPressable';
import { useCircleMembers } from '../hooks/useCircles';
import { useSubmitMoodCheckin, useTodayMoodCheckins } from '../hooks/useMoodCheckins';
import { categoryColors, colors, radii, shadow } from '../theme/colors';
import type { MoodValue } from '../types/models';
import HappyIcon from '../../assets/icons/mood/happy.svg';
import NeutralIcon from '../../assets/icons/mood/neutral.svg';
import SadIcon from '../../assets/icons/mood/sad.svg';

const MOODS: { value: MoodValue; Icon: FC<SvgProps>; label: string }[] = [
  { value: 'great', Icon: HappyIcon, label: 'Great' },
  { value: 'okay', Icon: NeutralIcon, label: 'Okay' },
  { value: 'tough', Icon: SadIcon, label: 'Tough' },
];

const MOOD_ICON: Record<MoodValue, FC<SvgProps>> = { great: HappyIcon, okay: NeutralIcon, tough: SadIcon };

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
          {MOODS.map(({ value, Icon, label }) => (
            <AnimatedPressable
              key={value}
              style={styles.pickButton}
              onPress={() => handlePick(value)}
              disabled={submittingMood !== null}
            >
              {submittingMood === value ? <Text style={styles.pickLoading}>…</Text> : <Icon width={28} height={28} />}
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
          const MoodIcon = checkin ? MOOD_ICON[checkin.mood] : null;
          return (
            <View key={member.user_id} style={styles.memberChip}>
              <View style={[styles.moodBubble, checkin ? styles.moodBubbleFilled : styles.moodBubbleEmpty]}>
                {MoodIcon ? (
                  <MoodIcon width={22} height={22} />
                ) : (
                  <Text style={styles.moodBubbleText}>{(member.profiles?.name ?? '?').charAt(0).toUpperCase()}</Text>
                )}
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
  pickLoading: { fontSize: 26, color: colors.textSecondary },
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
