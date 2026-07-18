import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient } from './src/lib/queryClient';
import { asyncStoragePersister } from './src/lib/persister';
import { Sentry } from './src/lib/sentry';
import RootNavigator from './src/navigation/RootNavigator';

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister }}>
          <RootNavigator />
          {/* App has no dark mode yet - background is always light, so the
              status bar text must always be dark regardless of the phone's
              system theme ("auto" follows system theme, not our UI). */}
          <StatusBar style="dark" />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);
