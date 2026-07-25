import { useMemo, useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PillButton } from '../components/PillButton';
import { useTheme } from '../theme/ThemeProvider';
import BuddyIllustration from '../../assets/illustrations/kinly-ill-buddy.svg';
import GoalIllustration from '../../assets/illustrations/kinly-Goal.svg';
import ChatIllustration from '../../assets/illustrations/kinly-ill-chat.svg';
import RocketIllustration from '../../assets/illustrations/kinly-ill-rocket.svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    Illustration: BuddyIllustration,
    title: 'Growth doesn’t happen alone',
    body: 'Kinly is a private circle of 2–10 friends helping each other build better habits.',
  },
  {
    Illustration: GoalIllustration,
    title: 'Set goals, build streaks',
    body: 'Track what matters to you, log your progress, and watch your streak grow day by day.',
  },
  {
    Illustration: ChatIllustration,
    title: 'Your circle has your back',
    body: "Cheer each other on, water a friend's streak if they miss a day, and check in on how everyone's really doing.",
  },
  {
    Illustration: RocketIllustration,
    title: 'Ready when you are',
    body: 'Create your own circle or join one with an invite code — let’s get started.',
  },
];

// Shown once, before a device's first sign-in (see useAuthStore's
// hasSeenTutorial doc comment) - a swipeable "how Kinly works" carousel
// distinct from LaunchVideoScreen, which plays on every cold start and
// exists for brand impact, not explanation.
export function TutorialScreen({ onFinish }: { onFinish: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isLast = index === SLIDES.length - 1;

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
  }

  function handleNext() {
    if (isLast) {
      onFinish();
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * SCREEN_WIDTH, animated: true });
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.skip} onPress={onFinish} hitSlop={12} accessibilityRole="button">
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {SLIDES.map(({ Illustration, title, body }) => (
          <View key={title} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <Illustration width={200} height={200} />
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View key={slide.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <PillButton label={isLast ? 'Get started' : 'Next'} onPress={handleNext} />
      </View>
    </SafeAreaView>
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
    slide: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
    title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginTop: 8 },
    body: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
    footer: { padding: 24, paddingTop: 8, gap: 20 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.inputBg },
    dotActive: { backgroundColor: colors.primary, width: 20 },
  });
}
