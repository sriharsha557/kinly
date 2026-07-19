import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/colors';

const WIDTH = 54;
const HEIGHT = 30;
const THUMB = 24;
const PADDING = 3;

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Track/thumb swap colors on toggle (colored track + white thumb when on,
// the reverse when off) rather than a plain sliding-dot switch. A small
// two-leaf sprout notch sits on the thumb, colored to match the track so it
// reads as a cutout - a nod to the app's own garden/growth iconography
// (GardenStageArt) instead of a bare flat circle.
export function ToggleSwitch({ value, onValueChange }: { value: boolean; onValueChange: (next: boolean) => void }) {
  const progress = useDerivedValue(() => withSpring(value ? 1 : 0, { damping: 14, stiffness: 200 }));

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.inputBg, colors.primary]),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (WIDTH - THUMB - PADDING * 2) }],
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.primary, colors.surface]),
  }));

  const leafProps = useAnimatedProps(() => ({
    fill: interpolateColor(progress.value, [0, 1], [colors.inputBg, colors.primary]),
  }));

  return (
    <Pressable onPress={() => onValueChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          <Svg width={THUMB} height={14} viewBox="0 0 24 14" style={styles.leaves}>
            <AnimatedPath d="M12 12 C6 12 4 6 6 1 C11 2 12 6 12 12 Z" animatedProps={leafProps} />
            <AnimatedPath d="M12 12 C18 12 20 6 18 1 C13 2 12 6 12 12 Z" animatedProps={leafProps} />
          </Svg>
        </Animated.View>
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
    overflow: 'visible',
  },
  leaves: {
    position: 'absolute',
    top: -7,
    left: 0,
  },
});
