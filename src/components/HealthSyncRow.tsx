import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ToggleSwitch } from './ToggleSwitch';
import { AnimatedPressable } from './AnimatedPressable';
import { useHealthSync } from '../hooks/useHealthSync';
import { useAuthStore } from '../state/useAuthStore';
import { useTheme } from '../theme/ThemeProvider';

// Always reflects real state, so "why aren't my steps syncing?" is answered
// on screen rather than guessed at. Android's permission denial is otherwise
// indistinguishable from nothing happening - the exact failure
// MOBILE_APP_LEARNINGS.md's UI-states checklist calls out.
export function HealthSyncRow() {
  const circleId = useAuthStore((state) => state.activeCircleId);
  const { status, isConnected, permissionDenied, isBusy, connect, disconnect, openSettings } =
    useHealthSync(circleId ?? undefined);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // iOS and Android-without-Health-Connect get nothing at all - a row
  // explaining a feature the device cannot have is just noise.
  if (status === 'checking' || status === 'unavailable') return null;

  let hint = 'Log walking goals automatically';
  if (isConnected) hint = "Reads today's step count from Health Connect";
  else if (status === 'needs-install') hint = "Health Connect isn't installed on this phone";
  else if (permissionDenied) hint = "Kinly doesn't have permission to read steps";

  const needsSettings = status === 'needs-install' || permissionDenied;

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.label}>Sync steps</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      {needsSettings ? (
        <AnimatedPressable style={styles.fix} onPress={openSettings} accessibilityRole="button">
          <Text style={styles.fixText}>{status === 'needs-install' ? 'Install' : 'Fix in Settings'}</Text>
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
  );
}

function createStyles({ colors, radii }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 56,
      paddingVertical: 8,
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
