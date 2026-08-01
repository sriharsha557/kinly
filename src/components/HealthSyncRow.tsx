import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ToggleSwitch } from './ToggleSwitch';
import { AnimatedPressable } from './AnimatedPressable';
import { useHealthSync } from '../hooks/useHealthSync';
import { useAuthStore } from '../state/useAuthStore';
import { useTheme } from '../theme/ThemeProvider';

// Renders its own section heading and card, not just a row: the whole section
// has to disappear together on a device that cannot have the feature, or an
// iOS user would see a "Connect Health" heading with nothing under it.
//
// Always reflects real state, so "why aren't my steps syncing?" is answered on
// screen rather than guessed at. Android's permission denial is otherwise
// indistinguishable from nothing happening - the exact failure
// MOBILE_APP_LEARNINGS.md's UI-states checklist calls out.
export function HealthSyncRow() {
  const circleId = useAuthStore((state) => state.activeCircleId);
  const { status, isConnected, permissionDenied, isBusy, connect, disconnect, openSettings } =
    useHealthSync(circleId ?? undefined);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // iOS and Android-without-Health-Connect get nothing at all - a section
  // explaining a feature the device cannot have is just noise.
  if (status === 'checking' || status === 'unavailable') return null;

  let hint = 'Log walking goals automatically';
  if (isConnected) hint = "Reads today's step count from Health Connect";
  else if (status === 'needs-install') hint = "Health Connect isn't installed on this phone";
  else if (permissionDenied) hint = "Kinly doesn't have permission to read steps";

  const needsSettings = status === 'needs-install' || permissionDenied;

  return (
    <>
      <Text style={styles.sectionTitle}>Connect Health</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.label}>Sync steps</Text>
            <Text style={styles.hint}>{hint}</Text>
          </View>
          {needsSettings ? (
            <AnimatedPressable
              style={styles.fix}
              onPress={openSettings}
              accessibilityRole="button"
              accessibilityLabel={
                status === 'needs-install' ? 'Install Health Connect' : 'Open Health Connect settings'
              }
            >
              <Text style={styles.fixText}>
                {status === 'needs-install' ? 'Install' : 'Fix in Settings'}
              </Text>
            </AnimatedPressable>
          ) : (
            <ToggleSwitch
              value={isConnected}
              onValueChange={(next) => {
                if (isBusy) return;
                if (next) void connect();
                else disconnect();
              }}
            />
          )}
        </View>
      </View>
    </>
  );
}

function createStyles({ colors, radii, cardShell }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    // Matches ProfileScreen's own sectionTitle so this sits level with
    // Appearance and the rest rather than looking bolted on.
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 28,
      marginBottom: 12,
    },
    card: { ...cardShell, padding: 16 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 56,
    },
    copy: { flex: 1, gap: 2 },
    label: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    hint: { fontSize: 13, color: colors.textSecondary },
    fix: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceSubtle,
    },
    fixText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  });
}
