import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { ToggleSwitch } from './ToggleSwitch';
import { AnimatedPressable } from './AnimatedPressable';
import { useHealthSync } from '../hooks/useHealthSync';
import { useAuthStore } from '../state/useAuthStore';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, spacing } from '../theme/colors';

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

  // Hidden only where the feature can genuinely never apply. It used to hide
  // on 'unavailable' too, which meant an Android user with Health Connect not
  // installed - or on a build predating the native module - saw no section at
  // all and no way to tell whether the feature was missing, broken, or just
  // not on their phone. "I can't find Sync steps" is the report that produced
  // this change.
  if (Platform.OS !== 'android' || status === 'checking') return null;

  const unavailable = status === 'unavailable';

  let hint = 'Log walking goals automatically';
  if (isConnected) hint = "Reads today's step count from Health Connect";
  else if (unavailable) hint = 'Health Connect is not available on this phone';
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
          {unavailable ? (
            // No control: we cannot open settings for an app that is not
            // there, and a dead button is worse than none. The hint says why.
            <Text style={styles.hint}>Not supported</Text>
          ) : needsSettings ? (
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
      fontFamily: fontFamily.bold,
      color: colors.textPrimary,
      marginTop: 28,
      marginBottom: spacing.md,
    },
    card: { ...cardShell, padding: spacing.lg },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      minHeight: 56,
    },
    copy: { flex: 1, gap: 2 },
    label: { fontSize: 15, fontFamily: fontFamily.semibold, color: colors.textPrimary },
    hint: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.textSecondary },
    fix: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceSubtle,
    },
    fixText: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.primary },
  });
}
