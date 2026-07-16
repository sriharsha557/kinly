import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors } from '../theme/colors';

export function ProgressBar({ progress, target }: { progress: number; target: number }) {
  const pct = target > 0 ? Math.min(1, progress / target) * 100 : 0;
  const width = useSharedValue(pct);

  useEffect(() => {
    width.value = withTiming(pct, { duration: 500 });
  }, [pct, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.inputBg,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
});
