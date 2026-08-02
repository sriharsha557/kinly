import { useMemo, useState } from 'react';
import type { FC, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, motion, spacing } from '../theme/colors';

// Groups lower-frequency features behind a tap so the primary cards on a
// screen aren't competing for the same visual weight as everything else.
export function DisclosureSection({
  label,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  label: string;
  icon?: FC<SvgProps>;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Animated.View layout={LinearTransition.springify()} style={styles.wrap}>
      <AnimatedPressable
      accessibilityRole="button" style={styles.header} onPress={() => setOpen((prev) => !prev)}>
        <View style={styles.labelRow}>
          {Icon && <Icon width={18} height={18} />}
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
      </AnimatedPressable>
      {open && (
        <Animated.View
          entering={FadeIn.duration(motion.duration.base)}
          exiting={FadeOut.duration(motion.duration.quick)}
          style={styles.body}
        >
          {children}
        </Animated.View>
      )}
    </Animated.View>
  );
}

function createStyles({ colors, radii, shadow }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    wrap: { marginBottom: spacing.lg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: radii.card,
      paddingVertical: 15,
      paddingHorizontal: spacing.lg,
      ...shadow,
    },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    label: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.textPrimary },
    chevron: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.textSecondary },
    body: { marginTop: spacing.md, gap: 0 },
  });
}
