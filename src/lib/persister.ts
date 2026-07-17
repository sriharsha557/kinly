import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

// Persists React Query's cache to disk so Feed/Goals/etc. still render
// last-known data immediately on cold start, even offline - queries then
// refetch and update once a connection is available.
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'kinly-query-cache',
});
