import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { FC } from 'react';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';
import { PillButton } from './PillButton';
import { useCircleMembers } from '../hooks/useCircles';
import { useSubmitMoodCheckin, useTodayMoodCheckins } from '../hooks/useMoodCheckins';
import { cardShell, colors, radii, shadow } from '../theme/colors';
import { HappyIcon, NeutralIcon, SadIcon } from './icons/MonoIcons';
import type { MoodValue } from '../types/models';
import HappyIconRaw from '../../assets/icons/mood/happy.svg';
import NeutralIconRaw from '../../assets/icons/mood/neutral.svg';
import SadIconRaw from '../../assets/icons/mood/sad.svg';

interface MoodIconProps {
  size?: number;
  color: string;
}

const MOOD_OPTIONS: { value: MoodValue; Icon: FC<MoodIconProps>; label: string }[] = [
  { value: 'great', Icon: HappyIcon, label: 'Feeling Great' },
  { value: 'okay', Icon: NeutralIcon, label: 'Doing Okay' },
  { value: 'tough', Icon: SadIcon, label: 'Having a Tough Day' },
];

// The circle-grid view below (everyone's mood at a glance) stays on the raw
// hardcoded-orange imports - those bubbles are always on a light inputBg/
// background fill, so contrast is fine and there's no active/inactive
// state to flip between.
const MOOD_ICON: Record<MoodValue, FC<SvgProps>> = { great: HappyIconRaw, okay: NeutralIconRaw, tough: SadIconRaw };

// Second, optional layer shown after the required one-tap mood - a fixed,
// predefined set per mood for now. Text-only, deliberately no emoji/icons:
// most of these ("Loved today", "Financial", "Lonely") don't have a
// matching icon in the app's custom set, and re-introducing emoji here
// would undo the icon migration done everywhere else this session.
// Custom user-created tags are a separate follow-up, not this pass - they
// need their own storage/vocabulary design, not just a UI affordance.
const MOOD_TAGS: Record<MoodValue, string[]> = {
  great: ['Workout', 'Loved today', 'Celebration', 'Game day', 'Productive', 'Hit my goal', 'Family time', 'Relaxed'],
  okay: ['Sleepy', 'Low energy', 'Busy', 'Normal day', 'Stayed home', 'Work'],
  tough: ['Lots of work', 'Exhausted', 'Sick', 'Stressed', 'Personal', 'Financial', 'Lonely', 'Frustrated'],
};

const MOOD_PROMPT: Record<MoodValue, string> = {
  great: 'What made today feel great?',
  okay: 'What kind of day was it?',
  tough: 'What made today tough?',
};

function MoodOptionCard({
  Icon,
  label,
  active,
  disabled,
  onPress,
}: {
  Icon: FC<MoodIconProps>;
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(active ? 1 : 0);
  const tap = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 200 });
  }, [active, progress]);

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    tap.value = withSequence(
      withTiming(0.98, { duration: 90 }),
      withTiming(1, { duration: 160 }),
    );
    onPress();
  }

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.surface, colors.primary]),
    borderColor: interpolateColor(progress.value, [0, 1], ['#E4DFD1', colors.primary]),
    transform: [{ scale: tap.value }],
  }));

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.15 }],
  }));

  return (
    <TouchableOpacity activeOpacity={0.9} disabled={disabled} onPress={handlePress}>
      <Animated.View style={[styles.moodOption, cardStyle]}>
        <Animated.View style={iconWrapStyle}>
          <Icon size={30} color={active ? '#FFFFFF' : colors.primary} />
        </Animated.View>
        <Text style={[styles.moodOptionLabel, active && styles.moodOptionLabelActive]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function MoodPickerModal({
  circleId,
  userId,
  existingMood,
  existingTags,
  onClose,
}: {
  circleId: string;
  userId: string;
  existingMood: MoodValue | null;
  existingTags: string[];
  onClose: () => void;
}) {
  const submitMood = useSubmitMoodCheckin(circleId, userId);
  const [step, setStep] = useState<'mood' | 'tags'>('mood');
  const [selectedMood, setSelectedMood] = useState<MoodValue | null>(existingMood);
  const [selectedTags, setSelectedTags] = useState<string[]>(existingTags);
  const [submitting, setSubmitting] = useState(false);

  async function handlePickMood(mood: MoodValue) {
    // Picking a different mood than what's stored starts its tag set over -
    // the two moods' tag lists don't overlap, so carrying old tags across
    // wouldn't make sense.
    const tags = mood === existingMood ? existingTags : [];
    setSelectedMood(mood);
    setSelectedTags(tags);
    setSubmitting(true);
    try {
      await submitMood.mutateAsync({ mood, tags });
    } finally {
      setSubmitting(false);
    }
    // Let the tap/fill/bounce animation actually be seen before the sheet
    // switches to the tag step.
    setTimeout(() => setStep('tags'), 320);
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleDone() {
    if (selectedMood) {
      setSubmitting(true);
      try {
        await submitMood.mutateAsync({ mood: selectedMood, tags: selectedTags });
      } finally {
        setSubmitting(false);
      }
    }
    onClose();
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayDismiss} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          {step === 'mood' ? (
            <>
              <Text style={styles.sheetTitle}>{"How's today going?"}</Text>
              <View style={styles.moodStack}>
                {MOOD_OPTIONS.map(({ value, Icon, label }) => (
                  <MoodOptionCard
                    key={value}
                    Icon={Icon}
                    label={label}
                    active={selectedMood === value}
                    disabled={submitting}
                    onPress={() => handlePickMood(value)}
                  />
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sheetTitle}>{MOOD_PROMPT[selectedMood as MoodValue]}</Text>
              <Text style={styles.sheetSubtitle}>Optional - pick as many as fit</Text>
              <View style={styles.tagWrap}>
                {MOOD_TAGS[selectedMood as MoodValue].map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.tagChip, active && styles.tagChipActive]}
                      onPress={() => toggleTag(tag)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                    >
                      <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>{tag}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <PillButton label="Done" onPress={handleDone} loading={submitting} style={{ marginTop: 18 }} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// Works with zero goals set - deliberately the first thing a brand-new user
// can do, and the only Today card that doesn't need any goal data to be
// useful. The picker itself lives in a bottom-sheet modal (MoodPickerModal)
// so it can hold two steps - required mood, then optional context tags -
// without cramming both into the inline card. Members who haven't checked
// in show a quiet, uncolored placeholder - never a red mark. No shame
// mechanics.
export function MoodCheckinCard({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: checkins, isLoading } = useTodayMoodCheckins(circleId);
  const { data: members } = useCircleMembers(circleId);
  const [modalOpen, setModalOpen] = useState(false);

  if (isLoading) return null;

  const myCheckin = checkins?.find((c) => c.user_id === userId);
  const activeMembers = (members ?? []).filter((m) => m.status === 'active');

  return (
    <>
      <View style={styles.card}>
        {!myCheckin ? (
          <TouchableOpacity onPress={() => setModalOpen(true)} accessibilityRole="button" accessibilityLabel="Check in on today's mood">
            <Text style={styles.title}>{"How's today going?"}</Text>
            <Text style={styles.hint}>Tap to check in</Text>
          </TouchableOpacity>
        ) : (
          <Animated.View entering={FadeIn.duration(300)}>
            <View style={styles.gridHeader}>
              <Text style={styles.title}>{"How the circle's doing today"}</Text>
              <TouchableOpacity onPress={() => setModalOpen(true)} accessibilityRole="button" accessibilityLabel="Change your check-in">
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
        )}
      </View>

      {modalOpen && (
        <MoodPickerModal
          circleId={circleId}
          userId={userId}
          existingMood={myCheckin?.mood ?? null}
          existingTags={myCheckin?.tags ?? []}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
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
  hint: { fontSize: 11, color: colors.shellSecondary, marginTop: 2 },
  gridHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  changeLink: { fontSize: 12, fontWeight: '600', color: colors.primary },
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

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  overlayDismiss: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    gap: 4,
    ...shadow,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E4DFD1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 19, fontWeight: '700', color: colors.shellTitle, textAlign: 'center' },
  sheetSubtitle: { fontSize: 13, color: colors.shellSecondary, textAlign: 'center', marginTop: 2, marginBottom: 16 },
  moodStack: { gap: 12, marginTop: 18 },
  moodOption: {
    borderWidth: 1.5,
    borderColor: '#E4DFD1',
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 10,
    ...shadow,
  },
  moodOptionLabel: { fontSize: 16, fontWeight: '600', color: colors.shellTitle },
  moodOptionLabelActive: { color: '#FFFFFF' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#E4DFD1',
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  tagChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tagChipText: { fontSize: 13, fontWeight: '600', color: colors.shellTitle },
  tagChipTextActive: { color: '#FFFFFF' },
});
