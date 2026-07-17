import { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import TodayScreen from '../screens/TodayScreen';
import CircleScreen from '../screens/CircleScreen';
import GoalsScreen from '../screens/GoalsScreen';
import ConnectionScreen from '../screens/ConnectionScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors, radii, shadow } from '../theme/colors';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Today: 'home',
  Circle: 'people',
  Goals: 'flag',
  Connection: 'happy',
  Profile: 'person',
};

function TabIcon({
  name,
  color,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}) {
  const scale = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0, { damping: 14, stiffness: 220 });
  }, [focused, scale]);

  const wrapStyle = useAnimatedStyle(() => ({
    backgroundColor: colors.primary,
    opacity: scale.value,
    transform: [{ scale: 0.6 + scale.value * 0.4 }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + scale.value * 0.08 }],
  }));

  return (
    <View style={styles.iconWrap}>
      <Animated.View style={[styles.activeIconWrap, wrapStyle]} />
      <Animated.View style={[styles.iconOverlay, iconStyle]}>
        <Ionicons name={name} size={22} color={focused ? '#fff' : color} />
      </Animated.View>
    </View>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarIconStyle: styles.tabBarIconStyle,
        tabBarIcon: ({ color, focused }) => (
          <TabIcon name={ICONS[route.name]} color={color} focused={focused} />
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
    left: 20,
    right: 20,
    bottom: 20,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    paddingHorizontal: 8,
    ...shadow,
  },
  tabBarItem: {
    height: 64,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tabBarIconStyle: {
    margin: 0,
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  activeIconWrap: {
    position: 'absolute' as const,
    width: 40,
    height: 40,
    borderRadius: radii.pill,
  },
  iconOverlay: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};
