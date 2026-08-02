import { AnimatedPressable } from './AnimatedPressable';
import { fontFamily, spacing } from '../theme/colors';
import { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text, View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FC } from 'react';
import { PillButton } from './PillButton';
import { useUxHintsStore } from '../state/useUxHintsStore';
import { useTheme } from '../theme/ThemeProvider';
import { CircleScene, GoalScene, SproutScene, FlowerScene, ChatScene } from './illustrations/Scenes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Theme-tinted scenes (src/components/illustrations/Scenes.tsx) replaced the
// static clip-art SVG imports - they re-color with the user's accent and
// scheme instead of staying fixed blue/orange on every theme.
const STEPS: { Illustration: FC<{ size?: number }>; title: string; body: string }[] = [
  {
    Illustration: CircleScene,
    title: 'Invite 2–10 people you trust',
    body: 'Kinly circles are small and private — just you and the friends you pick.',
  },
  {
    Illustration: GoalScene,
    title: 'Everyone picks one goal',
    body: 'Something real you each want to stick to — workouts, water, reading, anything.',
  },
  {
    Illustration: SproutScene,
    title: 'Check in daily',
    body: 'Log your goal each day. A minute is enough — showing up is the whole point.',
  },
  {
    Illustration: FlowerScene,
    title: 'Watch your shared garden grow',
    body: "Every check-in grows your circle's garden. When everyone shows up, it thrives.",
  },
  {
    Illustration: ChatScene,
    title: 'Encourage each other',
    body: "Cheer friends on, and water their streak when they miss a day. That's the magic.",
  },
];

// A guided, skippable "how a circle works" walkthrough shown once, the
// first time this device opens Home with an active circle - i.e. right
// after creating or joining one. Distinct from TutorialScreen (pre-sign-in,
// "what is Kinly") - this one teaches the loop you're now actually in.
export function CircleWelcomeModal() {
  const hasSeenCircleGuide = useUxHintsStore((state) => state.hasSeenCircleGuide);
  const setHasSeenCircleGuide = useUxHintsStore((state) => state.setHasSeenCircleGuide);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (hasSeenCircleGuide) return null;

  const isLast = index === STEPS.length - 1;

  function finish() {
    setHasSeenCircleGuide(true);
  }

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
  }

  function handleNext() {
    if (isLast) {
      finish();
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * SCREEN_WIDTH, animated: true });
  }

  return (
    <Modal animationType="fade" onRequestClose={finish}>
      <SafeAreaView style={styles.container}>
        {/* Absolute children ignore SafeAreaView padding, so the inset is
            applied explicitly - without it, Skip sat under the status bar. */}
        <AnimatedPressable
          style={[styles.skip, { top: insets.top + 12 }]}
          onPress={finish}
          hitSlop={12}
          accessibilityRole="button"
        >
          <Text style={styles.skipText}>Skip</Text>
        </AnimatedPressable>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
        >
          {STEPS.map(({ Illustration, title, body }, i) => (
            <View key={title} style={[styles.slide, { width: SCREEN_WIDTH }]}>
              <Illustration size={180} />
              <Text style={styles.stepLabel}>
                Step {i + 1} of {STEPS.length}
              </Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.body}>{body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {STEPS.map((step, i) => (
              <View key={step.title} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
          <PillButton label={isLast ? "Let's grow" : 'Next'} onPress={handleNext} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function createStyles({ colors, radii, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    skip: {
      position: 'absolute',
      right: 20,
      zIndex: 1,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: spacing.s14,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceSubtle,
    },
    skipText: { ...type.caption, fontFamily: fontFamily.semibold, color: colors.textSecondary },
    slide: { alignItems: 'center', justifyContent: 'center', padding: spacing.section, gap: spacing.md },
    stepLabel: { ...type.caption, fontFamily: fontFamily.bold, color: colors.primary, marginTop: spacing.sm, letterSpacing: 0.5 },
    title: { ...type.title, fontFamily: fontFamily.bold, color: colors.textPrimary, textAlign: 'center' },
    body: { ...type.body, fontFamily: fontFamily.regular, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
    footer: { padding: spacing.xxl, paddingTop: spacing.sm, gap: spacing.xl },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    dotActive: { backgroundColor: colors.primary, width: 20 },
  });
}
