import { useCallback, useMemo, useState } from 'react';
import { LogoSplashScreen } from '../components/LogoSplashScreen';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../screens/OnboardingScreen';
import CircleSettingsScreen from '../screens/CircleSettingsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import { LaunchVideoScreen } from '../screens/LaunchVideoScreen';
import { TutorialScreen } from '../screens/TutorialScreen';
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
  const theme = useTheme();
  // React Navigation paints its own container/header/card backgrounds
  // between screen renders - without this, dark mode flashes white on
  // every transition and the native headers stay light.
  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      dark: theme.scheme === 'dark',
      colors: {
        ...DefaultTheme.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.textPrimary,
        border: theme.colors.border,
        notification: theme.colors.danger,
      },
    }),
    [theme],
  );
  const user = useAuthStore((state) => state.user);
  usePushRegistration(user?.id);
  const activeCircleId = useAuthStore((state) => state.activeCircleId);
  const sessionLoading = useAuthStore((state) => state.sessionLoading);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const passwordRecoveryMode = useAuthStore((state) => state.passwordRecoveryMode);
  const hasSeenTutorial = useAuthStore((state) => state.hasSeenTutorial);
  const setHasSeenTutorial = useAuthStore((state) => state.setHasSeenTutorial);
  const hasSeenLaunchVideo = useAuthStore((state) => state.hasSeenLaunchVideo);
  const setHasSeenLaunchVideo = useAuthStore((state) => state.setHasSeenLaunchVideo);
  const { data: myCircles, isLoading: circlesLoading } = useMyCircles(user?.id, PENDING_POLL_INTERVAL_MS);
  // Session bootstrap runs in the background while this plays, so the app
  // already knows where to route by the time the video finishes.
  const [videoPlaying, setVideoPlaying] = useState(true);
  const handleLaunchVideoFinish = useCallback(() => {
    setHasSeenLaunchVideo(true);
    setVideoPlaying(false);
  }, [setHasSeenLaunchVideo]);

  // hasHydrated has to resolve before we know whether the video already
  // played on this device - the same persisted store it lives in. That's a
  // single fast AsyncStorage read, so this is at most one blank frame,
  // covered by the same logo screen shown for every other loading gap below.
  if (!hasHydrated) {
    return <LogoSplashScreen />;
  }

  // Plays once ever, on this device's very first open (see useAuthStore's
  // hasSeenLaunchVideo doc comment) - every cold start after that shows the
  // lightweight LogoSplashScreen instead, for exactly as long as loading
  // below actually takes.
  if (!hasSeenLaunchVideo && videoPlaying) {
    return <LaunchVideoScreen onFinish={handleLaunchVideoFinish} />;
  }

  if (sessionLoading) {
    return <LogoSplashScreen />;
  }

  if (passwordRecoveryMode) {
    return <ResetPasswordScreen />;
  }

  // Only ever shown once, before this device's first sign-in - a returning
  // signed-out user (or anyone who's already been through it) skips
  // straight to Onboarding's AuthStep.
  if (!user && !hasSeenTutorial) {
    return <TutorialScreen onFinish={() => setHasSeenTutorial(true)} />;
  }

  const readyForMain = !!user && !!activeCircleId;

  // Membership status (migration 0022) isn't known until useMyCircles
  // resolves - avoid flashing Main (or the pending screen) before that,
  // only while we're actually about to route into a circle.
  if (readyForMain && circlesLoading) {
    return <LogoSplashScreen />;
  }

  const activeCircle = readyForMain ? myCircles?.find((c) => c.id === activeCircleId) : undefined;
  if (activeCircle && activeCircle.membershipStatus === 'pending') {
    return <PendingApprovalScreen pendingCircle={activeCircle} />;
  }

  return (
    <NavigationContainer theme={navTheme}>
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
