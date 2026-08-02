import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { PillButton } from './PillButton';
import { useCircleMembers } from '../hooks/useCircles';
import { useSubmitMoodCheckin, useTodayMoodCheckins } from '../hooks/useMoodCheckins';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, motion, spacing } from '../theme/colors';
import { HappyIcon, NeutralIcon, SadIcon } from './icons/MonoIcons';
import type { MoodValue } from '../types/models';

interface MoodIconProps {
  size?: number;
  color: string;
}

const MOOD_OPTIONS: { value: MoodValue; Icon: FC<MoodIconProps>; label: string }[] = [
  { value: 'great', Icon: HappyIcon, label: 'Feeling Great' },
  { value: 'okay', Icon: NeutralIcon, label: 'Doing Okay' },
  { value: 'tough', Icon: SadIcon, label: 'Having a Tough Day' },
];

// The circle-grid view below (everyone's mood at a glance) uses the same
// prop-driven icons as the picker - the raw hardcoded-orange imports it
// used before were the last place a fixed orange survived a theme change.
const MOOD_ICON: Record<MoodValue, FC<MoodIconProps>> = { great: HappyIcon, okay: NeutralIcon, tough: SadIcon };

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

const MOOD_SENTENCE: Record<MoodValue, string> = {
  great: "You're feeling great today",
  okay: "You're doing okay today",
  tough: "You're having a tough day",
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
  const theme = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const progress = useSharedValue(active ? 1 : 0);
  const tap = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: motion.duration.base });
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
    borderColor: interpolateColor(progress.value, [0, 1], [colors.border, colors.primary]),
    transform: [{ scale: tap.value }],
  }));

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.15 }],
  }));

  return (
    <TouchableOpacity activeOpacity={0.9} disabled={disabled} onPress={handlePress}>
      <Animated.View style={[styles.moodOption, cardStyle]}>
        <Animated.View style={iconWrapStyle}>
          <Icon size={30} color={active ? colors.onAccent : colors.primary} />
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
  const submitMood = useSubmitMoodCheckin(circleId);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
    } catch (err) {
      setSubmitting(false);
      Alert.alert('Could not save your check-in', err instanceof Error ? err.message : 'Please try again.');
      return;
    }
    setSubmitting(false);
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
      } catch (err) {
        setSubmitting(false);
        Alert.alert('Could not save your check-in', err instanceof Error ? err.message : 'Please try again.');
        return;
      }
      setSubmitting(false);
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
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (isLoading) return null;

  const myCheckin = checkins?.find((c) => c.user_id === userId);
  const activeMembers = (members ?? []).filter((m) => m.status === 'active');

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.title}>{"How's today going?"}</Text>
        {!myCheckin ? (
          <TouchableOpacity onPress={() => setModalOpen(true)} accessibilityRole="button" accessibilityLabel="Check in on today's mood">
            <Text style={styles.hint}>Tap to check in</Text>
          </TouchableOpacity>
        ) : (
          <Animated.View entering={FadeIn.duration(motion.duration.entrance)}>
            <View style={styles.gridHeader}>
              <Text style={styles.hint}>{MOOD_SENTENCE[myCheckin.mood]}</Text>
              <TouchableOpacity onPress={() => setModalOpen(true)} accessibilityRole="button" accessibilityLabel="Change your check-in">
                <Text style={styles.changeLink}>Change</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionCaption}>Circle check-ins today</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gridRow}>
              {activeMembers.map((member) => {
                const checkin = checkins?.find((c) => c.user_id === member.user_id);
                const firstName = (member.profiles?.name ?? 'Member').split(' ')[0];
                const MoodIcon = checkin ? MOOD_ICON[checkin.mood] : null;
                return (
                  <View key={member.user_id} style={styles.memberChip}>
                    <View style={[styles.moodBubble, checkin ? styles.moodBubbleFilled : styles.moodBubbleEmpty]}>
                      {MoodIcon ? (
                        <MoodIcon size={22} color={theme.colors.primary} />
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

function createStyles({ colors, radii, shadow, cardShell }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      ...cardShell,
      padding: spacing.xl,
      paddingLeft: 18,
      marginBottom: spacing.lg,
    },
    title: { fontSize: 15, fontFamily: fontFamily.medium, color: colors.shellTitle, marginBottom: 2 },
    hint: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.shellSecondary },
    gridHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    changeLink: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.primary },
    sectionCaption: {
      fontSize: 13,
      fontFamily: fontFamily.semibold,
      color: colors.shellSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: 14,
      marginBottom: spacing.sm,
    },
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
    moodBubbleText: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.textSecondary },
    memberName: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.shellSecondary, marginTop: spacing.xs },

    overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    overlayDismiss: { ...StyleSheet.absoluteFillObject },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: spacing.xxl,
      paddingBottom: 36,
      gap: spacing.xs,
      ...shadow,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    sheetTitle: { fontSize: 19, fontFamily: fontFamily.bold, color: colors.shellTitle, textAlign: 'center' },
    sheetSubtitle: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.shellSecondary, textAlign: 'center', marginTop: 2, marginBottom: spacing.lg },
    moodStack: { gap: spacing.md, marginTop: 18 },
    moodOption: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 20,
      paddingVertical: spacing.xl,
      alignItems: 'center',
      gap: 10,
      ...shadow,
    },
    moodOptionLabel: { fontSize: 16, fontFamily: fontFamily.semibold, color: colors.shellTitle },
    moodOptionLabelActive: { color: colors.onAccent },
    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tagChip: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.pill,
      paddingHorizontal: 14,
      minHeight: 48,
      justifyContent: 'center',
    },
    tagChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tagChipText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.shellTitle },
    tagChipTextActive: { color: colors.onAccent },
  });
}
