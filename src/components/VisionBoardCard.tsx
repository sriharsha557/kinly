import { useState } from 'react';
import { Alert, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAddVisionItem, useDeleteVisionItem, useVisionItems } from '../hooks/useVisionBoard';
import { pickAndUploadVisionImage } from '../lib/visionImageUpload';
import { PillButton } from './PillButton';
import { categoryColors, colors, radii, shadow } from '../theme/colors';

function AddVisionModal({
  circleId,
  userId,
  onClose,
}: {
  circleId: string;
  userId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const addItem = useAddVisionItem(circleId);

  async function handlePickImage() {
    setUploading(true);
    try {
      const url = await pickAndUploadVisionImage(userId);
      if (url) setImageUrl(url);
    } finally {
      setUploading(false);
    }
  }

  async function handleAdd() {
    if (!title.trim()) return;
    await addItem.mutateAsync({ userId, title: title.trim(), imageUrl });
    onClose();
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Add to your vision board</Text>
          <TextInput
            style={styles.modalInput}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Launch my first startup"
            placeholderTextColor={colors.textSecondary}
          />
          <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage} disabled={uploading}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
            ) : (
              <Text style={styles.imagePickerText}>{uploading ? 'Uploading…' : '📷 Add a photo (optional)'}</Text>
            )}
          </TouchableOpacity>
          <View style={styles.modalButtons}>
            <PillButton label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <PillButton label="Add" onPress={handleAdd} loading={addItem.isPending} disabled={!title.trim()} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function VisionBoardCard({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: items } = useVisionItems(circleId);
  const deleteItem = useDeleteVisionItem(circleId);
  const [adding, setAdding] = useState(false);

  function handleLongPress(id: string, isMine: boolean) {
    if (!isMine) return;
    Alert.alert('Remove this?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteItem.mutate(id) },
    ]);
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🌌 Vision Board</Text>
        <TouchableOpacity onPress={() => setAdding(true)}>
          <Text style={styles.newLink}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {items && items.length > 0 ? (
        <View style={styles.grid}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.itemCard}
              onLongPress={() => handleLongPress(item.id, item.user_id === userId)}
            >
              {item.image_url && <Image source={{ uri: item.image_url }} style={styles.itemImage} />}
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemOwner}>{item.profiles?.name ?? 'Someone'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>Add what you're working toward — your circle can see it here.</Text>
      )}

      {adding && <AddVisionModal circleId={circleId} userId={userId} onClose={() => setAdding(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: categoryColors.wealth.bg,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 20,
    ...shadow,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: categoryColors.wealth.text },
  newLink: { fontSize: 13, fontWeight: '700', color: categoryColors.wealth.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: '48%',
  },
  itemImage: { width: '100%', height: 80, borderRadius: radii.input - 4, marginBottom: 6 },
  itemTitle: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  itemOwner: { fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  empty: { fontSize: 12, color: categoryColors.wealth.text, opacity: 0.8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalInput: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
  },
  imagePicker: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.input,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePickerText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  imagePreview: { width: '100%', height: '100%' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
