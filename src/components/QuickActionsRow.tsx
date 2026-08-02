import { useMemo } from 'react';
import type { FC } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { useTheme } from '../theme/ThemeProvider';
import { motion } from '../theme/colors';
import type { MainTabParamList } from '../navigation/types';
import ChatIcon from '../../assets/illustrations/kinly-ill-chat.svg';
import RocketIcon from '../../assets/illustrations/kinly-ill-rocket.svg';
import CheckIcon from '../../assets/icons/feed/check.svg';

// Ordered left-to-right to ascend through the tab bar's own order
// (Today, Circle, Goals, Connection, Profile), so tapping through the row
// feels like moving forward across tabs instead of jumping around.
const ACTIONS: { label: string; icon: FC<SvgProps>; tab: keyof MainTabParamList }[] = [
  { label: 'Start Challenge', icon: RocketIcon, tab: 'Circle' },
  // "Check In" collided with the mood check-in directly above this row on
  // Home, and was ambiguous between mood, attendance, daily login and goal
  // progress. All three labels are verb phrases now.
  { label: 'Log Progress', icon: CheckIcon, tab: 'Goals' },
  { label: 'Ask Friends', icon: ChatIcon, tab: 'Connection' },
];

export function QuickActionsRow() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      {ACTIONS.map(({ label, icon: Icon, tab }, index) => (
        <Animated.View
          key={tab}
          entering={FadeInDown.duration(motion.duration.entrance).delay(index * motion.stagger.step)}
          style={{ flex: 1 }}
        >
          <AnimatedPressable style={styles.action} onPress={() => navigation.navigate(tab)}>
            <Icon width={22} height={22} color={theme.colors.primary} />
            <Text style={styles.label}>{label}</Text>
          </AnimatedPressable>
        </Animated.View>
      ))}
    </View>
  );
}

function createStyles({ colors, radii, shadow }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    action: {
      backgroundColor: colors.surface,
      borderRadius: radii.input,
      paddingVertical: 14,
      alignItems: 'center',
      gap: 6,
      ...shadow,
    },
    label: { fontSize: 11, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  });
}
