import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/colors';

const SIZE = 28;

// Same heart path as PillarIcons.tsx's RelationshipsIcon, so this toggle's
// shape matches the rest of the app's icon set rather than being a one-off.
const HEART_PATH =
  'M12,20.3 C12,20.3 4.3,14.8 4.3,9.4 C4.3,6.5 6.6,4.3 9.3,4.3 C10.7,4.3 12,5 12,6.5 C12,5 13.3,4.3 14.7,4.3 C17.4,4.3 19.7,6.5 19.7,9.4 C19.7,14.8 12,20.3 12,20.3 Z';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Offsets mirror the Uiverse.io source's --tx/--ty custom properties for
// its 6 spark particles.
const SPARKS = [
  { tx: -13, ty: -5 },
  { tx: 13, ty: -5 },
  { tx: -16, ty: 6 },
  { tx: 16, ty: 6 },
  { tx: 0, ty: -16 },
  { tx: 0, ty: 13 },
];

function Spark({ tx, ty, burst }: { tx: number; ty: number; burst: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: 1 - burst.value,
    transform: [
      { translateX: burst.value * tx },
      { translateY: burst.value * ty },
      { scale: 1 - burst.value * 0.7 },
    ],
  }));
  return <Animated.View style={[styles.spark, style]} />;
}

// A heart pops and bursts a few sparks when switched on, instead of a plain
// sliding-dot switch - a specific Uiverse.io reference the user picked
// (heart checkbox, recolored orange). Outline heart when off, filled +
// stroked orange when on; color alone (not fill) carries the on/off state.
export function ToggleSwitch({ value, onValueChange }: { value: boolean; onValueChange: (next: boolean) => void }) {
  const progress = useSharedValue(value ? 1 : 0);
  const scale = useSharedValue(1);
  const burst = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 200 });
    if (value) {
      scale.value = withSequence(
        withTiming(1.15, { duration: 135 }),
        withTiming(0.93, { duration: 140 }),
        withTiming(1, { duration: 120 }),
      );
      burst.value = 0;
      burst.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.ease) });
    } else {
      scale.value = withTiming(1, { duration: 150 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const heartProps = useAnimatedProps(() => ({
    fill: interpolateColor(progress.value, [0, 1], ['transparent', colors.primary]),
    stroke: interpolateColor(progress.value, [0, 1], [colors.inputBg, colors.primary]),
  }));

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={styles.wrap}>
        {SPARKS.map((s, i) => (
          <Spark key={i} tx={s.tx} ty={s.ty} burst={burst} />
        ))}
        <Animated.View style={heartStyle}>
          <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
            <AnimatedPath
              d={HEART_PATH}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              animatedProps={heartProps}
            />
          </Svg>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  spark: {
    position: 'absolute',
    top: SIZE / 2 - 1.5,
    left: SIZE / 2 - 1.5,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.primary,
  },
});
