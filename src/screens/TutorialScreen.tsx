import { useMemo, useRef, useState, type FC } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PillButton } from '../components/PillButton';
import { useTheme } from '../theme/ThemeProvider';
import { CircleScene, GoalScene, ChatScene, RocketScene } from '../components/illustrations/Scenes';
import { fontFamily, spacing } from '../theme/colors';
import { AnimatedPressable } from '../components/AnimatedPressable';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Theme-tinted scenes (src/components/illustrations/Scenes.tsx) replaced the
// static clip-art SVG imports - they re-color with the user's accent and
// scheme instead of staying fixed blue/orange on every theme.
const SLIDES: { Illustration: FC<{ size?: number }>; title: string; body: string }[] = [
  {
    Illustration: CircleScene,
    title: 'Growth doesn’t happen alone',
    body: 'Kinly is a private circle of 2–10 friends helping each other build better habits.',
  },
  {
    Illustration: GoalScene,
    title: 'Set goals, build streaks',
    body: 'Track what matters to you, log your progress, and watch your streak grow day by day.',
  },
  {
    Illustration: ChatScene,
    title: 'Your circle has your back',
    body: "Cheer each other on, water a friend's streak if they miss a day, and check in on how everyone's really doing.",
  },
  {
    Illustration: RocketScene,
    title: 'Ready when you are',
    body: 'Create your own circle or join one with an invite code — let’s get started.',
  },
];

// Shown once, before a device's first sign-in (see useAuthStore's
// hasSeenTutorial doc comment) - a swipeable "how Kinly works" carousel
// distinct from LaunchVideoScreen, which plays on every cold start and
// exists for brand impact, not explanation.
export function TutorialScreen({ onFinish }: { onFinish: () => void }) {
  const insets = useSafeAreaInsets();
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
      {/* Absolute children ignore SafeAreaView padding, so the inset is
          applied explicitly - without it, Skip sat under the status bar. */}
      <AnimatedPressable
        style={[styles.skip, { top: insets.top + 12 }]}
        onPress={onFinish}
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
        {SLIDES.map(({ Illustration, title, body }) => (
          <View key={title} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <Illustration size={200} />
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

function createStyles({ colors, radii, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    skip: {
      position: 'absolute',
      right: 20,
      zIndex: 1,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 14,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceSubtle,
    },
    skipText: { ...type.caption, fontFamily: fontFamily.semibold, color: colors.textSecondary },
    slide: { alignItems: 'center', justifyContent: 'center', padding: spacing.section, gap: spacing.lg },
    title: { ...type.title, fontFamily: fontFamily.bold, color: colors.textPrimary, textAlign: 'center', marginTop: spacing.sm },
    body: { ...type.body, fontFamily: fontFamily.regular, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
    footer: { padding: spacing.xxl, paddingTop: spacing.sm, gap: spacing.xl },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    dotActive: { backgroundColor: colors.primary, width: 20 },
  });
}
