import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { fontFamily } from '../../theme/colors';

// The opaque strip under the plants. Deliberately on `colors.surface` rather
// than on the gradient: it means the status copy's contrast is fixed, and the
// time-of-day wash above can never affect the readability of the one part of
// the hero that carries words.
export function GardenFooter({
  status,
  meta,
}: {
  status: string;
  meta: string | null;
}) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.footer}>
      <Text style={styles.title}>Circle Garden</Text>
      <Text style={styles.status}>{status}</Text>
      {meta && <Text style={styles.statusMeta}>{meta}</Text>}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { colors, spacing, type } = theme;
  return StyleSheet.create({
    footer: {
      backgroundColor: colors.surface,
      padding: spacing.xl,
      paddingTop: spacing.lg,
      gap: spacing.xs,
    },
    title: { ...type.subheading, fontFamily: fontFamily.bold, color: colors.textPrimary },
    status: { ...type.body, color: colors.textPrimary },
    statusMeta: { ...type.secondary, fontFamily: fontFamily.medium, color: colors.textSecondary },
  });
}
