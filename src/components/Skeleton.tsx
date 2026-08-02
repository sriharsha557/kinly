import { useEffect } from 'react';
import type { DimensionValue } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme, type Theme } from '../theme/ThemeProvider';
import { spacing } from '../theme/colors';

// Lightweight pulse (no gradient-mask library available) instead of a true
// shimmer sweep - reads as "loading" without pulling in a new dependency.
export function Skeleton({
  width,
  height,
  radius = 8,
  style,
}: {
  width: DimensionValue;
  height: number;
  radius?: number;
  style?: object;
}) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.4);
  // Reanimated already drops one-shot animations when the OS asks for reduced
  // motion, but a withRepeat loop keeps running - it has no end to jump to.
  // The pulse is decorative (the grey block already reads as "loading"), so
  // it rests at a flat mid-opacity instead.
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 0.7;
      return;
    }
    opacity.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.inputBg }, animatedStyle, style]}
    />
  );
}

export function GoalCardSkeleton() {
  const theme = useTheme();
  return (
    <Animated.View style={skeletonCardStyle(theme)}>
      <Skeleton width="60%" height={16} />
      <Skeleton width="100%" height={8} radius={theme.radii.card} style={{ marginTop: spacing.md }} />
      <Skeleton width="30%" height={11} style={{ marginTop: 10 }} />
    </Animated.View>
  );
}

export function EventRowSkeleton() {
  const theme = useTheme();
  return (
    <Animated.View style={[skeletonCardStyle(theme), { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
      <Skeleton width={20} height={20} radius={10} />
      <Skeleton width="70%" height={14} />
    </Animated.View>
  );
}

export function AskCardSkeleton() {
  const theme = useTheme();
  return (
    <Animated.View style={skeletonCardStyle(theme)}>
      <Skeleton width="85%" height={15} />
      <Skeleton width="40%" height={11} style={{ marginTop: spacing.md }} />
    </Animated.View>
  );
}

function skeletonCardStyle({ colors, radii }: Theme) {
  return {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
  };
}
