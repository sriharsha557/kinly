import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PillButton } from './PillButton';
import { colors } from '../theme/colors';
import { SadIcon } from './icons/MonoIcons';

// Sentry.ErrorBoundary's fallback render prop - shown instead of a blank/
// frozen screen when a render-time error escapes every screen's own
// handling. Sentry.ErrorBoundary already reports the error on its own
// (that's the whole point of using their component instead of a hand-
// rolled one); this only needs to give the user a way back in.
export function ErrorFallback({ resetError }: { resetError: () => void }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <SadIcon size={40} color={colors.primary} />
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          Kinly hit a snag. This has been reported - tap below to try again.
        </Text>
        <PillButton label="Try again" onPress={resetError} style={{ marginTop: 24 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  title: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 8, textAlign: 'center' },
  body: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
