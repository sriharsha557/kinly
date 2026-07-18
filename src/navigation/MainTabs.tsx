import { useEffect } from 'react';
import type { FC } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import TodayScreen from '../screens/TodayScreen';
import CircleScreen from '../screens/CircleScreen';
import GoalsScreen from '../screens/GoalsScreen';
import ConnectionScreen from '../screens/ConnectionScreen';
import ProfileScreen from '../screens/ProfileScreen';
import {
  HomeTabIcon,
  PeopleTabIcon,
  GoalsTabIcon,
  ChatTabIcon,
  ProfileTabIcon,
} from '../components/icons/TabIcons';
import { colors } from '../theme/colors';
import { TAB_BAR_HEIGHT } from '../hooks/useTabBarClearance';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, FC<{ size?: number; color: string }>> = {
  Today: HomeTabIcon,
  Circle: PeopleTabIcon,
  Goals: GoalsTabIcon,
  Connection: ChatTabIcon,
  Profile: ProfileTabIcon,
};

// Instagram-style flat bar: no pill background behind the active icon, just
// a color change plus a small scale pop for tactile feedback.
function TabIcon({
  Icon,
  color,
  focused,
}: {
  Icon: FC<{ size?: number; color: string }>;
  color: string;
  focused: boolean;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.12 : 1, { damping: 14, stiffness: 220 });
  }, [focused, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={iconStyle}>
      <Icon size={24} color={color} />
    </Animated.View>
  );
}

export default function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarShowLabel: false,
        tabBarStyle: [
          styles.tabBar,
          { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
        ],
        tabBarItemStyle: styles.tabBarItem,
        tabBarIcon: ({ color, focused }) => (
          <TabIcon Icon={ICONS[route.name]} color={color} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Circle" component={CircleScreen} />
      <Tab.Screen name="Goals" component={GoalsScreen} />
      <Tab.Screen name="Connection" component={ConnectionScreen} options={{ title: 'Connection Moments' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = {
  tabBar: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.inputBg,
    elevation: 0,
  },
  tabBarItem: {
    height: TAB_BAR_HEIGHT,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};
