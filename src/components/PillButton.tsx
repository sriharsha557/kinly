import { StyleSheet, Text, ViewStyle } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { LoadingSpinner } from './LoadingSpinner';
import { colors, radii } from '../theme/colors';

interface PillButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'solid' | 'outline';
  style?: ViewStyle;
}

export function PillButton({ label, onPress, loading, disabled, variant = 'solid', style }: PillButtonProps) {
  const isOutline = variant === 'outline';
  return (
    <AnimatedPressable
      style={[styles.base, isOutline ? styles.outline : styles.solid, style]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <LoadingSpinner size={9} color={isOutline ? colors.primary : '#fff'} />
      ) : (
        <Text style={isOutline ? styles.outlineText : styles.solidText}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: { backgroundColor: colors.primary },
  solidText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  outline: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: 'transparent' },
  outlineText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
});
