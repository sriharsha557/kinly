import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../screens/OnboardingScreen';
import CircleSettingsScreen from '../screens/CircleSettingsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import { LaunchVideoScreen } from '../screens/LaunchVideoScreen';
import PendingApprovalScreen from '../screens/PendingApprovalScreen';
import MainTabs from './MainTabs';
import { useAuthStore } from '../state/useAuthStore';
import { useBootstrapSession } from '../hooks/useBootstrapSession';
import { usePushRegistration } from '../hooks/usePushRegistration';
import { useAuthDeepLink } from '../hooks/useAuthDeepLink';
import { useMyCircles } from '../hooks/useCircles';
import type { RootStackParamList } from './types';

// While waiting on approval, poll every 5s - frequent enough to feel live,
// far short of anything that would strain the DB for a single-row lookup.
const PENDING_POLL_INTERVAL_MS = 5000;

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  useBootstrapSession();
  useAuthDeepLink();
  const user = useAuthStore((state) => state.user);
  usePushRegistration(user?.id);
  const activeCircleId = useAuthStore((state) => state.activeCircleId);
  const sessionLoading = useAuthStore((state) => state.sessionLoading);
  const passwordRecoveryMode = useAuthStore((state) => state.passwordRecoveryMode);
  const { data: myCircles, isLoading: circlesLoading } = useMyCircles(user?.id, PENDING_POLL_INTERVAL_MS);
  // Session bootstrap runs in the background while this plays, so the app
  // already knows where to route by the time the video finishes.
  const [showLaunchVideo, setShowLaunchVideo] = useState(true);
  const handleLaunchVideoFinish = useCallback(() => setShowLaunchVideo(false), []);

  if (showLaunchVideo) {
    return <LaunchVideoScreen onFinish={handleLaunchVideoFinish} />;
  }

  if (sessionLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (passwordRecoveryMode) {
    return <ResetPasswordScreen />;
  }

  const readyForMain = !!user && !!activeCircleId;

  // Membership status (migration 0022) isn't known until useMyCircles
  // resolves - avoid flashing Main (or the pending screen) before that,
  // only while we're actually about to route into a circle.
  if (readyForMain && circlesLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  const activeCircle = readyForMain ? myCircles?.find((c) => c.id === activeCircleId) : undefined;
  if (activeCircle && activeCircle.membershipStatus === 'pending') {
    return <PendingApprovalScreen pendingCircle={activeCircle} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {readyForMain ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="CircleSettings"
              component={CircleSettingsScreen}
              options={{ headerShown: true, title: 'Circle Settings' }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ headerShown: true, title: 'Edit Profile' }}
            />
          </>
        ) : (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
