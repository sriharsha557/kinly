import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PillButton } from './PillButton';
import { queryClient } from '../lib/queryClient';
import { asyncStoragePersister } from '../lib/persister';
import { colors } from '../theme/colors';
import { SadIcon } from './icons/MonoIcons';

// Sentry.ErrorBoundary's fallback render prop - shown instead of a blank/
// frozen screen when a render-time error escapes every screen's own
// handling. Sentry.ErrorBoundary already reports the error on its own
// (that's the whole point of using their component instead of a hand-
// rolled one); this only needs to give the user a way back in.
//
// Two distinct recovery paths, not one button duplicated: "Try again"
// just remounts the tree (resetError) - the right first move, since most
// crashes are one-off (a stale cache entry, a null that shouldn't have
// been). "Go home" additionally wipes the persisted React Query cache
// before remounting, for the harder case where the crash keeps recurring
// because the corrupted data causing it is sitting in cache and "Try
// again" alone just re-reads the same bad state.
export function ErrorFallback({ resetError }: { resetError: () => void }) {
  const [clearing, setClearing] = useState(false);

  async function handleGoHome() {
    setClearing(true);
    try {
      queryClient.clear();
      await asyncStoragePersister.removeClient();
    } finally {
      setClearing(false);
      resetError();
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <SadIcon size={40} color={colors.primary} />
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          Kinly hit a snag. This has been reported - tap below to try again.
        </Text>
        <View style={styles.actions}>
          <PillButton label="Try again" onPress={resetError} style={{ flex: 1 }} />
          <PillButton label="Go home" variant="outline" onPress={handleGoHome} loading={clearing} style={{ flex: 1 }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  title: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 8, textAlign: 'center' },
  body: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24, width: '100%' },
});
