import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient } from './src/lib/queryClient';
import { asyncStoragePersister, CACHE_SCHEMA_VERSION } from './src/lib/persister';
import { Sentry } from './src/lib/sentry';
import { ErrorFallback } from './src/components/ErrorFallback';
import RootNavigator from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/theme/ThemeProvider';

function App() {
  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          {/* buster discards the whole persisted cache when its string does
              not match the one the cache was written with. It is what stops a
              query entry produced by an older build - a derived shape missing
              a field today's components read - from being handed to those
              components on rehydration. See lib/persister.ts for the crash
              that made it necessary and when to bump it. */}
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister: asyncStoragePersister, buster: CACHE_SCHEMA_VERSION }}
          >
            {/* Sentry.ErrorBoundary reports the error itself (that's the
                point of using their component over a hand-rolled one) and
                replaces a blank/frozen screen with ErrorFallback on any
                uncaught render error. resetError just remounts the tree - it
                can't undo whatever bad state caused the crash, so a repeat
                crash on retry is still possible, but most causes (a stale
                cache entry, a one-off null) clear on a fresh render. */}
            <Sentry.ErrorBoundary fallback={ErrorFallback}>
              <RootNavigator />
            </Sentry.ErrorBoundary>
            {/* Status bar now lives inside ThemeProvider, which styles it
                from the resolved light/dark scheme. */}
          </PersistQueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

export default Sentry.wrap(App);
