import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import FeedScreen from '../screens/FeedScreen';
import GoalsScreen from '../screens/GoalsScreen';
import AskFriendsScreen from '../screens/AskFriendsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors, radii, shadow } from '../theme/colors';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Feed: 'home',
  Goals: 'flag',
  AskFriends: 'chatbubbles',
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
        tabBarIcon: ({ color, focused }) => (
          <View style={focused ? styles.activeIconWrap : styles.iconWrap}>
            <Ionicons name={ICONS[route.name]} size={22} color={focused ? '#fff' : color} />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Goals" component={GoalsScreen} />
      <Tab.Screen name="AskFriends" component={AskFriendsScreen} options={{ title: 'Ask Friends' }} />
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
    ...shadow,
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
