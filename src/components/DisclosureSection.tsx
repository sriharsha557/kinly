import { useState } from 'react';
import type { FC, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { colors, radii, shadow } from '../theme/colors';

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

  return (
    <Animated.View layout={LinearTransition.springify()} style={styles.wrap}>
      <AnimatedPressable style={styles.header} onPress={() => setOpen((prev) => !prev)}>
        <View style={styles.labelRow}>
          {Icon && <Icon width={18} height={18} />}
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
      </AnimatedPressable>
      {open && (
        <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} style={styles.body}>
          {children}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...shadow,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  chevron: { fontSize: 11, color: colors.textSecondary },
  body: { marginTop: 12, gap: 0 },
});
