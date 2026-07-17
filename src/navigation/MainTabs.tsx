import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
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
          <View style={focused ? styles.activeIconWrap : styles.iconWrap}>
            <Ionicons name={ICONS[route.name]} size={22} color={focused ? '#fff' : color} />
          </View>
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
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};
