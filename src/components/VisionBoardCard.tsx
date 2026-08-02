import { AnimatedPressable } from './AnimatedPressable';
import { fontFamily, spacing } from '../theme/colors';
import { useMemo, useState } from 'react';
import { Image, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAddVisionItem, useDeleteVisionItem, useVisionItems } from '../hooks/useVisionBoard';
import { pickAndUploadVisionImage } from '../lib/visionImageUpload';
import { PillButton } from './PillButton';
import { ActionSheet } from './ActionSheet';
import { useTheme } from '../theme/ThemeProvider';
import GalaxyIcon from '../../assets/icons/feed/galaxy.svg';
import CameraIcon from '../../assets/icons/feed/camera.svg';

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
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
            placeholderTextColor={theme.colors.textSecondary}
          />
          <AnimatedPressable
      accessibilityRole="button" style={styles.imagePicker} onPress={handlePickImage} disabled={uploading}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
            ) : uploading ? (
              <Text style={styles.imagePickerText}>Uploading…</Text>
            ) : (
              <View style={styles.imagePickerRow}>
                <CameraIcon width={16} height={16} color={theme.colors.primary} />
                <Text style={styles.imagePickerText}>Add a photo (optional)</Text>
              </View>
            )}
          </AnimatedPressable>
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
  const [removingId, setRemovingId] = useState<string | null>(null);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  function handleLongPress(id: string, isMine: boolean) {
    if (!isMine) return;
    setRemovingId(id);
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <GalaxyIcon width={18} height={18} color={theme.colors.textSecondary} />
          <Text style={styles.title}>Vision Board</Text>
        </View>
        <AnimatedPressable
      accessibilityRole="button" onPress={() => setAdding(true)}>
          <Text style={styles.newLink}>+ Add</Text>
        </AnimatedPressable>
      </View>

      {items && items.length > 0 ? (
        <View style={styles.grid}>
          {items.map((item) => (
            <AnimatedPressable
      accessibilityRole="button"
              key={item.id}
              style={styles.itemCard}
              onLongPress={() => handleLongPress(item.id, item.user_id === userId)}
            >
              {item.image_url && <Image source={{ uri: item.image_url }} style={styles.itemImage} />}
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemOwner}>{item.profiles?.name ?? 'Someone'}</Text>
            </AnimatedPressable>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>{"Add what you're working toward — your circle can see it here."}</Text>
      )}

      {adding && <AddVisionModal circleId={circleId} userId={userId} onClose={() => setAdding(false)} />}
      {removingId && (
        <ActionSheet
          title="Remove this?"
          options={[
            {
              label: 'Remove',
              destructive: true,
              onPress: () => {
                deleteItem.mutate(removingId);
                setRemovingId(null);
              },
            },
          ]}
          onCancel={() => setRemovingId(null)}
        />
      )}
    </View>
  );
}

function createStyles({ colors, radii, cardShell, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      ...cardShell,
      padding: spacing.xl,
      paddingLeft: spacing.s18,
      marginBottom: spacing.xl,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s6 },
    title: { ...type.body, fontFamily: fontFamily.medium, color: colors.shellTitle },
    newLink: { ...type.caption, fontFamily: fontFamily.medium, color: colors.primary },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    itemCard: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.input,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.s10,
      maxWidth: '48%',
    },
    itemImage: { width: '100%', height: 80, borderRadius: radii.input - 4, marginBottom: spacing.s6 },
    itemTitle: { ...type.caption, fontFamily: fontFamily.semibold, color: colors.textPrimary },
    itemOwner: { ...type.caption, fontFamily: fontFamily.regular, color: colors.textSecondary, marginTop: spacing.s2 },
    empty: { ...type.caption, fontFamily: fontFamily.regular, color: colors.shellSecondary },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: spacing.xxl,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.card,
      padding: spacing.xl,
      gap: spacing.md,
    },
    modalTitle: { ...type.subheading, fontFamily: fontFamily.bold, color: colors.textPrimary },
    modalInput: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.input,
      paddingHorizontal: spacing.s14,
      paddingVertical: spacing.md,
      color: colors.textPrimary,
      ...type.body, fontFamily: fontFamily.regular,
    },
    imagePicker: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.input,
      height: 100,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    imagePickerText: { ...type.caption, color: colors.textSecondary, fontFamily: fontFamily.semibold },
    imagePickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s6 },
    imagePreview: { width: '100%', height: '100%' },
    modalButtons: { flexDirection: 'row', gap: spacing.s10, marginTop: spacing.xs },
  });
}
