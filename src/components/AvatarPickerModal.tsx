import { AnimatedPressable } from './AnimatedPressable';
import { fontFamily, spacing } from '../theme/colors';
import { useMemo, useState } from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import { PillButton } from './PillButton';
import { diceBearAvatarUrl, randomAvatarSeeds } from '../lib/avatarPresets';
import { useTheme } from '../theme/ThemeProvider';

export function AvatarPickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [seeds, setSeeds] = useState(() => randomAvatarSeeds());
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Choose an avatar</Text>
          <View style={styles.grid}>
            {seeds.map((seed, index) => {
              const url = diceBearAvatarUrl(seed);
              return (
                <AnimatedPressable
                  key={seed}
                  onPress={() => onSelect(url)}
                  style={styles.avatarWrap}
                  accessibilityRole="button"
                  accessibilityLabel={`Avatar option ${index + 1}`}
                >
                  <Image source={{ uri: url }} style={styles.avatarImage} />
                </AnimatedPressable>
              );
            })}
          </View>
          <PillButton
            label="Shuffle"
            variant="outline"
            onPress={() => setSeeds(randomAvatarSeeds())}
            style={{ marginTop: spacing.s14 }}
          />
          <AnimatedPressable
      accessibilityRole="button" onPress={onClose} style={{ marginTop: spacing.s10 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles({ colors, radii, shadow, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: spacing.xxl,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.card,
      padding: spacing.xl,
      alignItems: 'center',
      ...shadow,
    },
    title: { ...type.subheading, fontFamily: fontFamily.bold, color: colors.textPrimary, marginBottom: spacing.s14 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.s10 },
    avatarWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      overflow: 'hidden',
      backgroundColor: colors.inputBg,
    },
    avatarImage: { width: 64, height: 64 },
    cancel: { ...type.caption, fontFamily: fontFamily.semibold, color: colors.textSecondary },
  });
}
