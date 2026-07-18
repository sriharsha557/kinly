import { useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PillButton } from './PillButton';
import { diceBearAvatarUrl, randomAvatarSeeds } from '../lib/avatarPresets';
import { colors, radii, shadow } from '../theme/colors';

export function AvatarPickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [seeds, setSeeds] = useState(() => randomAvatarSeeds());

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Choose an avatar</Text>
          <View style={styles.grid}>
            {seeds.map((seed) => {
              const url = diceBearAvatarUrl(seed);
              return (
                <TouchableOpacity key={seed} onPress={() => onSelect(url)} style={styles.avatarWrap}>
                  <Image source={{ uri: url }} style={styles.avatarImage} />
                </TouchableOpacity>
              );
            })}
          </View>
          <PillButton
            label="Shuffle"
            variant="outline"
            onPress={() => setSeeds(randomAvatarSeeds())}
            style={{ marginTop: 14 }}
          />
          <TouchableOpacity onPress={onClose} style={{ marginTop: 10 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 20,
    alignItems: 'center',
    ...shadow,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: colors.inputBg,
  },
  avatarImage: { width: 64, height: 64 },
  cancel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
});
