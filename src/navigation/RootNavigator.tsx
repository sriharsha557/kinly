import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../screens/OnboardingScreen';
import CircleSettingsScreen from '../screens/CircleSettingsScreen';
import MainTabs from './MainTabs';
import { useAuthStore } from '../state/useAuthStore';
import { useBootstrapSession } from '../hooks/useBootstrapSession';
import { usePushRegistration } from '../hooks/usePushRegistration';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  useBootstrapSession();
  const user = useAuthStore((state) => state.user);
  usePushRegistration(user?.id);
  const activeCircleId = useAuthStore((state) => state.activeCircleId);
  const sessionLoading = useAuthStore((state) => state.sessionLoading);

  if (sessionLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
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
          </>
        ) : (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
