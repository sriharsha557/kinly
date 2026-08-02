import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { AnimatedPressable } from '../AnimatedPressable';
import { GardenStageArt } from '../GardenStageArt';
import { growthVisual } from '../../lib/gardenGrowth';
import { swayProfile } from '../../lib/swayProfile';
import type { MemberGardenState } from '../../hooks/useGarden';
import { useTheme } from '../../theme/ThemeProvider';
import { fontFamily, motion } from '../../theme/colors';

// One plant in the row: stage art inside a 64dp target, idle sway when
// healthy, a slow lean when wilted, and a size that tracks the streak.
//
// The size is what makes an ordinary check-in visible. Stage art only changes
// at 3 / 14 / 30, so before this a member on day 8 looked exactly like they
// did on day 3 - eleven check-ins with nothing to show. growthVisual() maps
// the streak onto a monotonic scale between those thresholds, so every logged
// day moves the plant a little and none ever moves it back.
export function Plant({
  member,
  isSelf,
  artSize,
  animate,
  onPress,
}: {
  member: MemberGardenState;
  isSelf: boolean;
  artSize: number;
  // False while the row is off-screen, so the idle loop is not running on a
  // tab the user is not looking at.
  animate: boolean;
  onPress?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const wilted = member.stage === 'wilted';

  // Per-plant rhythm, derived from the member's id rather than their position
  // in the row - so a plant keeps its character when the row reorders, and
  // two plants never sway in step.
  const sway = useMemo(() => swayProfile(member.userId), [member.userId]);
  const targetScale = growthVisual(member.streak).scale;

  const lean = useSharedValue(0);
  const scale = useSharedValue(targetScale);
  const mountedStage = useRef(member.stage);
  const mountedStreak = useRef(member.streak);

  useEffect(() => {
    if (wilted || !animate) {
      // Droop: slow lean, no sway. Also the resting position when the row is
      // off-screen, so nothing loops in the background.
      lean.value = withTiming(wilted ? -8 : 0, {
        duration: reducedMotion || !animate ? 0 : 600,
        easing: Easing.inOut(Easing.ease),
      });
    } else if (reducedMotion) {
      lean.value = withTiming(0, { duration: 0 });
    } else {
      // Recover upright with a spring, then idle sway at this plant's own
      // amplitude and period.
      lean.value = withSequence(
        withSpring(0, { damping: 14 }),
        withDelay(
          sway.delay,
          withRepeat(
            withSequence(
              withTiming(sway.amplitude, { duration: sway.period, easing: Easing.inOut(Easing.ease) }),
              withTiming(-sway.amplitude, { duration: sway.period, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
            true,
          ),
        ),
      );
    }
  }, [wilted, reducedMotion, animate, sway, lean]);

  // Only spring when the streak actually moved. A re-render, a refetch that
  // returns the same numbers, or the first mount are all data display rather
  // than events - the same rule the stage pop below has always followed.
  useEffect(() => {
    const grew = member.streak !== mountedStreak.current;
    mountedStreak.current = member.streak;
    if (!grew) {
      scale.value = targetScale;
    } else if (reducedMotion) {
      scale.value = targetScale;
    } else {
      scale.value = withSpring(targetScale, { damping: motion.damping.pop });
    }
  }, [member.streak, targetScale, reducedMotion, scale]);

  const artStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${lean.value}deg` }, { scale: scale.value }],
  }));

  // Both transforms pivot at the base rather than the centre: a plant leans
  // from its roots, and growth pushes it up out of the soil instead of
  // expanding it evenly in all directions - including downward, which read as
  // the plant sinking.

  // Only animate stage *changes* (a check-in landing, a bloom) - never the
  // initial mount, which is data display, not an event.
  const stageChanged = mountedStage.current !== member.stage;
  useEffect(() => {
    mountedStage.current = member.stage;
  }, [member.stage]);

  const body = (
    <View style={styles.plantSlot}>
      <Animated.View style={[styles.art, artStyle, wilted && styles.plantWilted]}>
        <Animated.View
          key={member.stage}
          entering={stageChanged && !reducedMotion ? ZoomIn.springify().damping(motion.damping.pop) : undefined}
        >
          <GardenStageArt stage={member.stage} size={artSize} />
        </Animated.View>
      </Animated.View>
      <Text style={[styles.plantName, isSelf && styles.plantNameSelf]} numberOfLines={1}>
        {isSelf ? 'You' : member.name}
      </Text>
      {member.streak > 0 && <Text style={styles.plantStreak}>{member.streak}d</Text>}
    </View>
  );

  if (!onPress) return body;
  return (
    // The label carries everything the art does. Scale and sway add no
    // information a screen reader is missing, so nothing new is announced.
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${isSelf ? 'Your' : `${member.name}'s`} plant, ${member.stage}, ${member.streak} day streak`}
    >
      {body}
    </AnimatedPressable>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { colors, spacing, type, touch } = theme;
  return StyleSheet.create({
    plantSlot: {
      alignItems: 'center',
      minWidth: touch.min + 16,
      minHeight: touch.min,
      justifyContent: 'flex-end',
    },
    art: { transformOrigin: 'bottom center' },
    plantWilted: { opacity: 0.7 },
    plantName: {
      ...type.caption,
      fontFamily: fontFamily.medium,
      color: colors.textPrimary,
      marginTop: spacing.xs,
      maxWidth: 72,
    },
    // Your own plant is named in bold - the one place in the row that has to
    // read as "you" at a glance.
    plantNameSelf: { fontFamily: fontFamily.bold, color: colors.primary },
    plantStreak: { ...type.caption, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  });
}
