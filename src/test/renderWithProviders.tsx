import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';

// Every component in the app calls useTheme(), and most call a React Query
// hook, so rendering one bare throws on a missing context rather than on
// anything the test is about. This wraps the three providers the app itself
// mounts above the navigator, so a component under test sees the same context
// shape it sees in production.
//
// Deliberately NOT wrapping PersistQueryClientProvider: persistence is the one
// piece of app setup a render test should not inherit. It would read and write
// real AsyncStorage, leaking state between test files in whatever order Jest
// happened to run them. Tests that need to simulate rehydrated data should
// seed it explicitly via `seedQueries` below, which is both isolated and
// visible in the test body.
function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // No retries: a failing query in a test should surface its failure on
        // the first attempt instead of stalling the test for three rounds of
        // backoff and then timing out with a misleading message.
        retry: false,
        // Nothing under test should refetch on its own. Tests assert on the
        // data they seed.
        staleTime: Infinity,
        gcTime: Infinity,
      },
      mutations: { retry: false },
    },
  });
}

export interface RenderOptions {
  // Query entries to place in the cache before the component mounts, as
  // [queryKey, data] pairs. This is how a test reproduces cache state -
  // including deliberately malformed state from an older app version, which is
  // exactly the bug class that crashed the Circle tab.
  seedQueries?: [readonly unknown[], unknown][];
}

// async because @testing-library/react-native 14 made `render` return a
// Promise - it awaits the initial render internally instead of leaving callers
// to wrap things in act(). Every caller must await this, and a test that
// forgets gets "getByText is not a function" rather than anything that points
// at the real cause, so it is worth knowing.
export async function renderWithProviders(ui: ReactElement, { seedQueries = [] }: RenderOptions = {}) {
  const queryClient = makeTestQueryClient();
  for (const [key, data] of seedQueries) {
    queryClient.setQueryData(key, data);
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return Object.assign(await render(ui, { wrapper: Wrapper }), { queryClient });
}
