import { Pressable, StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';
import { colors } from '../theme/colors';

const WIDTH = 44;
const HEIGHT = 26;
const THUMB = 20;
const PADDING = 3;

export function ToggleSwitch({ value, onValueChange }: { value: boolean; onValueChange: (next: boolean) => void }) {
  const progress = useDerivedValue(() => withSpring(value ? 1 : 0, { damping: 14, stiffness: 200 }));

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.inputBg, colors.primary]),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (WIDTH - THUMB - PADDING * 2) }],
  }));

  return (
    <Pressable onPress={() => onValueChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    padding: PADDING,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#fff',
  },
});
