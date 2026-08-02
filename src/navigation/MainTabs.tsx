import { useEffect } from 'react';
import type { FC } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
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
import { useTheme, type Theme } from '../theme/ThemeProvider';
import { fontFamily, motion, spacing } from '../theme/colors';
import { useAuthStore } from '../state/useAuthStore';
import { useMomentsUnread } from '../hooks/useMomentsUnread';
import { useGoals } from '../hooks/useGoals';
import { useSyncStepGoals } from '../hooks/useSyncStepGoals';
import { MilestoneCardModal } from '../components/MilestoneCardModal';
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
  showDot,
  dotColor,
  dotBorderColor,
}: {
  Icon: FC<{ size?: number; color: string }>;
  color: string;
  focused: boolean;
  showDot?: boolean;
  dotColor: string;
  dotBorderColor: string;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.12 : 1, motion.spring.settle);
  }, [focused, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={iconStyle}>
      <Icon size={24} color={color} />
      {showDot && (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -3,
            width: 9,
            height: 9,
            borderRadius: 4.5,
            backgroundColor: dotColor,
            borderWidth: 1.5,
            borderColor: dotBorderColor,
          }}
        />
      )}
    </Animated.View>
  );
}

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { colors } = theme;
  const styles = createStyles(theme);
  const circleId = useAuthStore((state) => state.activeCircleId);
  const userId = useAuthStore((state) => state.user?.id);
  const { unreadCount } = useMomentsUnread(circleId ?? undefined, userId);
  const { data: goals } = useGoals(circleId ?? undefined);
  // Lives here rather than on the Goals screen so a step goal's progress -
  // and the garden, mission list and member rows derived from it - is
  // current whichever tab the app opens on.
  const { celebration: stepCelebration, dismissCelebration } = useSyncStepGoals(
    circleId ?? undefined,
    userId,
    goals,
  );

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          // Labels aid discoverability (icon-only nav forces guessing) and
          // give the active accent a second, readable signal.
          tabBarShowLabel: true,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarStyle: [
            styles.tabBar,
            { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
          ],
          tabBarItemStyle: styles.tabBarItem,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              Icon={ICONS[route.name]}
              color={color}
              focused={focused}
              // Only Today hosts the Moments feed, and a dot on the screen
              // you are already looking at is noise.
              showDot={route.name === 'Today' && !focused && unreadCount > 0}
              dotColor={colors.primary}
              dotBorderColor={colors.surface}
            />
          ),
        })}
      >
        <Tab.Screen name="Today" component={TodayScreen} />
        <Tab.Screen name="Circle" component={CircleScreen} />
        <Tab.Screen name="Goals" component={GoalsScreen} />
        <Tab.Screen
          name="Connection"
          component={ConnectionScreen}
          options={{ title: 'Together', tabBarLabel: 'Together' }}
        />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
      {stepCelebration && (
        <MilestoneCardModal
          title={stepCelebration.title}
          subtitle={stepCelebration.subtitle}
          onClose={dismissCelebration}
        />
      )}
    </>
  );
}

function createStyles({ colors }: Theme) {
  return {
    tabBar: {
      position: 'absolute' as const,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      elevation: 0,
    },
    tabBarItem: {
      height: TAB_BAR_HEIGHT,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    tabBarLabel: {
      // Below the 13px floor in design/PRINCIPLES.md, and deliberately so:
      // that floor governs content type, while tab bars are platform chrome
      // (Apple's HIG sets tab labels at 10pt). At 13px, five labels start
      // truncating on narrow devices.
      fontSize: 11,
      fontFamily: fontFamily.semibold,
      marginTop: spacing.s2,
    },
  };
}
