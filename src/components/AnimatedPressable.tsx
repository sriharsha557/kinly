import {
  AccessibilityRole,
  AccessibilityState,
  Insets,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { ReactNode } from 'react';
// Motion tokens are imported directly rather than read off useTheme():
// unlike colors they never vary by scheme, and these are animation props
// rather than StyleSheet values.
import { motion } from '../theme/colors';

// `style` has to reach the Pressable itself, not a View inside it.
//
// This used to render <Pressable><Animated.View style={style}/></Pressable>,
// which quietly dropped every LAYOUT property callers passed: `flex: 1` and
// `alignSelf` landed on a child, while the Pressable - the actual flex child
// of the parent row - kept sizing itself to its content. That is why the
// Appearance chips came out three different widths despite each carrying
// `flex: 1`, and why paired modal buttons passing `style={{ flex: 1 }}` never
// split their row evenly.
//
// Animating the Pressable directly fixes the layout and also makes the press
// scale the whole control, background included, rather than just its
// contents.
const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps {
  onPress?: () => void;
  // Long-press and hitSlop exist so this can replace a plain TouchableOpacity
  // anywhere, rather than only on the subset of buttons that happened not to
  // need them - the app had two different press feels purely because those
  // props were missing here.
  onLongPress?: () => void;
  delayLongPress?: number;
  hitSlop?: number | Insets;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
}

export function AnimatedPressable({
  onPress,
  onLongPress,
  delayLongPress,
  hitSlop,
  disabled,
  style,
  children,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressableBase
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      hitSlop={hitSlop}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
      style={[style, animatedStyle]}
      onPressIn={() => {
        scale.value = withSpring(0.94, motion.spring.pressIn);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring.pressOut);
      }}
    >
      {children}
    </AnimatedPressableBase>
  );
}
