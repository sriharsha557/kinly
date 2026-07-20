import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';

const LEG_DURATION = 380;

// Each square takes turns occupying the same 3 corners of an L (top-left,
// top-right, bottom-right), phase-shifted by one step, so they read as a
// continuous chase rather than 3 independently bouncing dots - a scaled-down
// 3-square take on a Uiverse.io 5-square shuffling-squares spinner.
function useShufflePosition(offset: number, startPhase: number) {
  const positions = [
    { left: 0, top: 0 },
    { left: offset, top: 0 },
    { left: offset, top: offset },
  ];
  const order = [0, 1, 2].map((i) => positions[(startPhase + i) % 3]);
  const left = useSharedValue(order[0].left);
  const top = useSharedValue(order[0].top);

  useEffect(() => {
    const timing = { duration: LEG_DURATION, easing: Easing.inOut(Easing.ease) };
    left.value = withRepeat(
      withSequence(
        withTiming(order[1].left, timing),
        withTiming(order[2].left, timing),
        withTiming(order[0].left, timing),
      ),
      -1,
    );
    top.value = withRepeat(
      withSequence(
        withTiming(order[1].top, timing),
        withTiming(order[2].top, timing),
        withTiming(order[0].top, timing),
      ),
      -1,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, startPhase]);

  return useAnimatedStyle(() => ({ left: left.value, top: top.value }));
}

export function LoadingSpinner({ size = 10, color = colors.primary }: { size?: number; color?: string }) {
  const offset = size + 2;
  const square0 = useShufflePosition(offset, 0);
  const square1 = useShufflePosition(offset, 1);
  const square2 = useShufflePosition(offset, 2);
  const squareStyle = { width: size, height: size, borderRadius: 2, backgroundColor: color };

  return (
    <View style={{ width: offset + size, height: offset + size }}>
      <Animated.View style={[{ position: 'absolute' }, squareStyle, square0]} />
      <Animated.View style={[{ position: 'absolute' }, squareStyle, square1]} />
      <Animated.View style={[{ position: 'absolute' }, squareStyle, square2]} />
    </View>
  );
}
