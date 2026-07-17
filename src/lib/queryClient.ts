import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Kept in memory (and, via the persister, on disk) long enough that
      // reopening the app offline still shows the last-known Feed/Goals
      // state instead of a blank loading screen.
      gcTime: 1000 * 60 * 60 * 24,
      retry: 2,
    },
  },
});
