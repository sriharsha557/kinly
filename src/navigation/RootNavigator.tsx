import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../screens/OnboardingScreen';
import CircleSettingsScreen from '../screens/CircleSettingsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import { LaunchVideoScreen } from '../screens/LaunchVideoScreen';
import MainTabs from './MainTabs';
import { useAuthStore } from '../state/useAuthStore';
import { useBootstrapSession } from '../hooks/useBootstrapSession';
import { usePushRegistration } from '../hooks/usePushRegistration';
import { useAuthDeepLink } from '../hooks/useAuthDeepLink';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  useBootstrapSession();
  useAuthDeepLink();
  const user = useAuthStore((state) => state.user);
  usePushRegistration(user?.id);
  const activeCircleId = useAuthStore((state) => state.activeCircleId);
  const sessionLoading = useAuthStore((state) => state.sessionLoading);
  const passwordRecoveryMode = useAuthStore((state) => state.passwordRecoveryMode);
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
