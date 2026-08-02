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
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      hitSlop={hitSlop}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
      onPressIn={() => {
        scale.value = withSpring(0.94, motion.spring.pressIn);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring.pressOut);
      }}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
