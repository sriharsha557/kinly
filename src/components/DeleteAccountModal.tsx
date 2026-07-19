import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { AppTextInput } from './AppTextInput';
import { PillButton } from './PillButton';
import { deleteAccount } from '../lib/auth';
import { colors, radii, shadow } from '../theme/colors';

const CONFIRM_WORD = 'DELETE';

export function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setSubmitting(true);
    try {
      await deleteAccount();
      // Signing out inside deleteAccount() flips the auth state, which
      // RootNavigator picks up to leave the app - no local success state
      // to handle here.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete your account.');
      setSubmitting(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
        <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.card}>
          <Text style={styles.title}>Delete your account?</Text>
          <Text style={styles.body}>
            This permanently deletes your account, your goals, posts, and Vision Board images, and removes you
            from every circle. This cannot be undone.
          </Text>
          <AppTextInput
            label={`Type ${CONFIRM_WORD} to confirm`}
            autoCapitalize="characters"
            autoCorrect={false}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={CONFIRM_WORD}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <PillButton label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} disabled={submitting} />
            <PillButton
              label="Delete account"
              onPress={handleDelete}
              loading={submitting}
              disabled={confirmText.trim() !== CONFIRM_WORD}
              style={{ flex: 1, backgroundColor: colors.danger }}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 24,
    gap: 14,
    ...shadow,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
