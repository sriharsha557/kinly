import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, spacing } from '../theme/colors';

export function AppTextInput({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={theme.colors.textSecondary} {...props} />
    </View>
  );
}

function createStyles({ colors, radii, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    wrapper: { gap: spacing.s6 },
    label: { ...type.caption, fontFamily: fontFamily.semibold, color: colors.textSecondary },
    input: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.input,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.s14,
      ...type.body, fontFamily: fontFamily.regular,
      color: colors.textPrimary,
    },
  });
}
