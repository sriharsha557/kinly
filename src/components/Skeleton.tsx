import { useEffect } from 'react';
import type { DimensionValue } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radii } from '../theme/colors';

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
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.inputBg }, animatedStyle, style]}
    />
  );
}

export function GoalCardSkeleton() {
  return (
    <Animated.View style={skeletonCardStyle}>
      <Skeleton width="60%" height={16} />
      <Skeleton width="100%" height={8} radius={radii.card} style={{ marginTop: 12 }} />
      <Skeleton width="30%" height={11} style={{ marginTop: 10 }} />
    </Animated.View>
  );
}

export function EventRowSkeleton() {
  return (
    <Animated.View style={[skeletonCardStyle, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
      <Skeleton width={20} height={20} radius={10} />
      <Skeleton width="70%" height={14} />
    </Animated.View>
  );
}

export function AskCardSkeleton() {
  return (
    <Animated.View style={skeletonCardStyle}>
      <Skeleton width="85%" height={15} />
      <Skeleton width="40%" height={11} style={{ marginTop: 12 }} />
    </Animated.View>
  );
}

const skeletonCardStyle = {
  backgroundColor: colors.surface,
  borderRadius: radii.card,
  padding: 16,
  marginBottom: 12,
};
