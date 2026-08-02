import { fontFamily, spacing } from '../theme/colors';
import { useMemo } from 'react';
import { StyleSheet, Text, ViewStyle } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { LoadingSpinner } from './LoadingSpinner';
import { useTheme } from '../theme/ThemeProvider';

interface PillButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'solid' | 'outline';
  style?: ViewStyle;
}

export function PillButton({ label, onPress, loading, disabled, variant = 'solid', style }: PillButtonProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isOutline = variant === 'outline';
  return (
    <AnimatedPressable
      accessibilityRole="button"
      style={[styles.base, isOutline ? styles.outline : styles.solid, style]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <LoadingSpinner size={9} color={isOutline ? theme.colors.primary : theme.colors.onAccent} />
      ) : (
        <Text style={isOutline ? styles.outlineText : styles.solidText}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}

function createStyles({ colors, radii, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    base: {
      borderRadius: radii.pill,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    solid: { backgroundColor: colors.primary },
    solidText: { color: colors.onAccent, ...type.body, fontFamily: fontFamily.bold },
    outline: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: 'transparent' },
    outlineText: { color: colors.primary, ...type.body, fontFamily: fontFamily.bold },
  });
}
