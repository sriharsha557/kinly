import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

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

function createStyles({ colors, radii }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    wrapper: { gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    input: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.input,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.textPrimary,
    },
  });
}
