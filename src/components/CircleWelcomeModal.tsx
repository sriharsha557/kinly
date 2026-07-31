import { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';
import { PillButton } from './PillButton';
import { useUxHintsStore } from '../state/useUxHintsStore';
import { useTheme } from '../theme/ThemeProvider';
import BuddyIllustration from '../../assets/illustrations/kinly-ill-buddy.svg';
import GoalIllustration from '../../assets/illustrations/kinly-Goal.svg';
import SproutIllustration from '../../assets/illustrations/kinly-ill-sprout-soil.svg';
import FlowerIllustration from '../../assets/illustrations/kinly-ill-flower.svg';
import ChatIllustration from '../../assets/illustrations/kinly-ill-chat.svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STEPS: { Illustration: FC<SvgProps>; title: string; body: string }[] = [
  {
    Illustration: BuddyIllustration,
    title: 'Invite 2–10 people you trust',
    body: 'Kinly circles are small and private — just you and the friends you pick.',
  },
  {
    Illustration: GoalIllustration,
    title: 'Everyone picks one goal',
    body: 'Something real you each want to stick to — workouts, water, reading, anything.',
  },
  {
    Illustration: SproutIllustration,
    title: 'Check in daily',
    body: 'Log your goal each day. A minute is enough — showing up is the whole point.',
  },
  {
    Illustration: FlowerIllustration,
    title: 'Watch your shared garden grow',
    body: "Every check-in grows your circle's garden. When everyone shows up, it thrives.",
  },
  {
    Illustration: ChatIllustration,
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
        <TouchableOpacity style={styles.skip} onPress={finish} hitSlop={12} accessibilityRole="button">
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
        >
          {STEPS.map(({ Illustration, title, body }, i) => (
            <View key={title} style={[styles.slide, { width: SCREEN_WIDTH }]}>
              <Illustration width={180} height={180} />
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

function createStyles({ colors, radii }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    skip: {
      position: 'absolute',
      top: 16,
      right: 20,
      zIndex: 1,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.inputBg,
    },
    skipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    slide: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
    stepLabel: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 8, letterSpacing: 0.5 },
    title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
    body: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
    footer: { padding: 24, paddingTop: 8, gap: 20 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.inputBg },
    dotActive: { backgroundColor: colors.primary, width: 20 },
  });
}
