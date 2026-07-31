import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { accents, ACCENT_OPTIONS, type AccentId, type ThemeMode } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';

const MODE_OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

// Accent swatches + appearance mode control, shared verbatim between the
// onboarding theme step and Profile's Appearance section so the two can
// never drift. Purely controlled - persistence is the caller's job.
export function ThemePicker({
  accent,
  mode,
  onChangeAccent,
  onChangeMode,
}: {
  accent: AccentId;
  mode: ThemeMode;
  onChangeAccent: (accent: AccentId) => void;
  onChangeMode: (mode: ThemeMode) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Accent color</Text>
      <View style={styles.swatchRow}>
        {ACCENT_OPTIONS.map(({ id, label }) => {
          const active = accent === id;
          return (
            <TouchableOpacity
              key={id}
              style={styles.swatchItem}
              onPress={() => onChangeAccent(id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${label} accent color`}
            >
              <View style={[styles.swatchRing, active && { borderColor: accents[id].primary }]}>
                <View style={[styles.swatch, { backgroundColor: accents[id].primary }]} />
              </View>
              <Text style={[styles.swatchLabel, active && styles.swatchLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Appearance</Text>
      <View style={styles.modeRow}>
        {MODE_OPTIONS.map(({ id, label }) => {
          const active = mode === id;
          return (
            <TouchableOpacity
              key={id}
              style={[styles.modeChip, active && styles.modeChipActive]}
              onPress={() => onChangeMode(id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${label} appearance`}
            >
              <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function createStyles({ colors, radii }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    wrap: { gap: 10 },
    label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    swatchRow: { flexDirection: 'row', gap: 16 },
    swatchItem: { alignItems: 'center', gap: 4, minWidth: 56 },
    swatchRing: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 3,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatch: { width: 30, height: 30, borderRadius: 15 },
    swatchLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    swatchLabelActive: { color: colors.textPrimary },
    modeRow: { flexDirection: 'row', gap: 8 },
    modeChip: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceSubtle,
    },
    modeChipActive: { backgroundColor: colors.primary },
    modeChipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
    modeChipTextActive: { color: colors.onAccent },
  });
}
