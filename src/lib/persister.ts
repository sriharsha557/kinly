import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

// Persists React Query's cache to disk so Feed/Goals/etc. still render
// last-known data immediately on cold start, even offline - queries then
// refetch and update once a connection is available.
//
// BUMP THIS whenever a persisted query's data SHAPE changes - a new field on
// a derived object, a renamed key, a different element type.
//
// What goes on disk is not the raw API row, it is whatever a queryFn returns,
// including fields computed client-side (useChallenges builds `progress`,
// `contributors` and `contributions` from two separate tables). Nothing
// re-derives a persisted entry on rehydration: it is handed to the current
// build of the component verbatim, however old it is. gcTime is 24h, so it
// comfortably outlives an app update.
//
// That combination crashed the Circle tab. Commit c9b377d added
// `contributions` to useChallenges' result and had ChallengesCard read
// `challenge.contributions.length`; every device that had opened the Circle
// tab on the previous build rehydrated a challenge object predating that
// field, and reading `.length` off undefined threw during render. It escaped
// to Sentry.ErrorBoundary, and because "Try again" only remounts the tree
// against the same stored bytes, it threw again immediately - only "Go home",
// which calls removeClient(), could break the loop.
//
// A buster fixes that class of bug outright: the stored buster is compared
// with this one on restore, and a mismatch discards the whole cache instead
// of feeding an old shape to new code. The cost of bumping it is one extra
// fetch per query on next launch - a spinner, not a crash.
// Lives here beside the persister it versions, but is applied where the cache
// is actually restored - `buster` is an option on PersistQueryClientProvider's
// persistOptions, not on the persister factory (the factory only knows how to
// read and write bytes; comparing busters is the restore step's job).
export const CACHE_SCHEMA_VERSION = 'v2-challenge-contributions';

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'kinly-query-cache',
});
