import { AccessibilityRole, AccessibilityState, Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { ReactNode } from 'react';
// Motion tokens are imported directly rather than read off useTheme():
// unlike colors they never vary by scheme, and these are animation props
// rather than StyleSheet values.
import { motion } from '../theme/colors';

interface AnimatedPressableProps {
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
}

export function AnimatedPressable({
  onPress,
  disabled,
  style,
  children,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
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
