import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { FC } from 'react';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';
import { AnimatedPressable } from './AnimatedPressable';
import { useCircleMembers } from '../hooks/useCircles';
import { useSubmitMoodCheckin, useTodayMoodCheckins } from '../hooks/useMoodCheckins';
import { cardShell, colors } from '../theme/colors';
import { HappyIcon, NeutralIcon, SadIcon } from './icons/MonoIcons';
import type { MoodValue } from '../types/models';
import HappyIconRaw from '../../assets/icons/mood/happy.svg';
import NeutralIconRaw from '../../assets/icons/mood/neutral.svg';
import SadIconRaw from '../../assets/icons/mood/sad.svg';

// Muted, not the app's default textSecondary brown - this row's unpicked
// buttons need to read as quiet/inactive against a white background, which
// a warm brown (tuned for body-text contrast) doesn't convey as clearly as
// a neutral gray does at this size and weight.
const MUTED = '#B8B39A';

interface MoodIconProps {
  size?: number;
  color: string;
}

const MOODS: { value: MoodValue; Icon: FC<MoodIconProps>; label: string }[] = [
  { value: 'great', Icon: HappyIcon, label: 'Great' },
  { value: 'okay', Icon: NeutralIcon, label: 'Okay' },
  { value: 'tough', Icon: SadIcon, label: 'Tough' },
];

// The circle-grid view below (everyone's mood at a glance) stays on the raw
// hardcoded-orange imports - those bubbles are always on a light inputBg/
// background fill, so contrast is fine and there's no active/inactive
// state to flip between.
const MOOD_ICON: Record<MoodValue, FC<SvgProps>> = { great: HappyIconRaw, okay: NeutralIconRaw, tough: SadIconRaw };

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
  const [editing, setEditing] = useState(false);

  if (isLoading) return null;

  const myCheckin = checkins?.find((c) => c.user_id === userId);
  const activeMembers = (members ?? []).filter((m) => m.status === 'active');

  // Same upsert either way - useSubmitMoodCheckin only fires a fresh Circle
  // Activity event on today's *first* check-in, so re-picking to change
  // your mind later just updates the row silently, no feed spam.
  async function handlePick(mood: MoodValue) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSubmittingMood(mood);
    try {
      await submitMood.mutateAsync(mood);
      setEditing(false);
    } finally {
      setSubmittingMood(null);
    }
  }

  if (!myCheckin || editing) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{"How's today going?"}</Text>
        <Text style={styles.hint}>
          {myCheckin ? "Tap to update today's check-in" : "Tap to check in - you can change this later today"}
        </Text>
        <View style={styles.pickRow}>
          {MOODS.map(({ value, Icon, label }) => {
            const active = submittingMood ? submittingMood === value : myCheckin?.mood === value;
            return (
              <AnimatedPressable
                key={value}
                style={[styles.pickButton, active && styles.pickButtonActive]}
                onPress={() => handlePick(value)}
                disabled={submittingMood !== null}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <Icon size={24} color={active ? '#FFFFFF' : MUTED} />
                <Text style={[styles.pickLabel, active && styles.pickLabelActive]}>{label}</Text>
              </AnimatedPressable>
            );
          })}
        </View>
        {editing && (
          <TouchableOpacity onPress={() => setEditing(false)} disabled={submittingMood !== null}>
            <Text style={styles.cancelLink}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.card}>
      <View style={styles.gridHeader}>
        <Text style={styles.title}>{"How the circle's doing today"}</Text>
        <TouchableOpacity onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Change your check-in">
          <Text style={styles.changeLink}>Change</Text>
        </TouchableOpacity>
      </View>
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
    ...cardShell,
    padding: 20,
    paddingLeft: 18,
    marginBottom: 16,
  },
  title: { fontSize: 15, fontWeight: '500', color: colors.shellTitle },
  hint: { fontSize: 11, color: colors.shellSecondary, marginTop: 2, marginBottom: 12 },
  cancelLink: { fontSize: 12, fontWeight: '600', color: colors.shellSecondary, textAlign: 'center', marginTop: 10 },
  gridHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  changeLink: { fontSize: 12, fontWeight: '600', color: colors.primary },
  pickRow: { flexDirection: 'row', gap: 10 },
  pickButton: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4DFD1',
    backgroundColor: 'transparent',
  },
  pickButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pickLabel: { fontSize: 11, fontWeight: '500', color: MUTED },
  pickLabelActive: { color: '#FFFFFF' },
  gridRow: { gap: 14 },
  memberChip: { alignItems: 'center', width: 52 },
  moodBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodBubbleFilled: { backgroundColor: colors.inputBg },
  moodBubbleEmpty: { backgroundColor: colors.background },
  moodBubbleText: { fontSize: 18, fontWeight: '700', color: colors.textSecondary },
  memberName: { fontSize: 11, fontWeight: '600', color: colors.shellSecondary, marginTop: 4 },
});
