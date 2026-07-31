import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

export function ProgressBar({ progress, target }: { progress: number; target: number }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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

function createStyles({ colors }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    // Neutral track so the accent fill is the only colored element - the
    // accent-tinted track made low progress read as a full colored bar.
    track: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.surfaceSubtle,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 4,
    },
  });
}
