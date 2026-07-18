import type { FC } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { colors, radii, shadow } from '../theme/colors';
import type { MainTabParamList } from '../navigation/types';
import ChatIcon from '../../assets/illustrations/kinly-ill-chat.svg';
import RocketIcon from '../../assets/illustrations/kinly-ill-rocket.svg';

// Ordered left-to-right to ascend through the tab bar's own order
// (Today, Circle, Goals, Connection, Profile), so tapping through the row
// feels like moving forward across tabs instead of jumping around.
const ACTIONS: { label: string; emoji?: string; icon?: FC<SvgProps>; tab: keyof MainTabParamList }[] = [
  { label: 'Start Challenge', icon: RocketIcon, tab: 'Circle' },
  { label: 'Check In', emoji: '✅', tab: 'Goals' },
  { label: 'Ask Friends', icon: ChatIcon, tab: 'Connection' },
];

export function QuickActionsRow() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  return (
    <View style={styles.row}>
      {ACTIONS.map(({ label, emoji, icon: Icon, tab }, index) => (
        <Animated.View key={tab} entering={FadeInDown.duration(350).delay(index * 60)} style={{ flex: 1 }}>
          <AnimatedPressable style={styles.action} onPress={() => navigation.navigate(tab)}>
            {Icon ? <Icon width={22} height={22} /> : <Text style={styles.emoji}>{emoji}</Text>}
            <Text style={styles.label}>{label}</Text>
          </AnimatedPressable>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  action: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
    ...shadow,
  },
  emoji: { fontSize: 20 },
  label: { fontSize: 11, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
});
