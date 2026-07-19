import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMyLetters, useOpenLetter, useWriteLetter } from '../hooks/useFutureSelf';
import { PillButton } from './PillButton';
import { colors, radii, shadow } from '../theme/colors';
import type { FutureLetter } from '../types/models';
import MailIcon from '../../assets/icons/feed/mail.svg';
import LockIcon from '../../assets/icons/feed/lock.svg';
import CelebrateIcon from '../../assets/icons/feed/celebrate.svg';

function WriteLetterModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [content, setContent] = useState('');
  const writeLetter = useWriteLetter(userId);

  async function handleSend() {
    if (!content.trim()) return;
    await writeLetter.mutateAsync(content.trim());
    onClose();
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Dear future me...</Text>
          <Text style={styles.modalHint}>Sealed for one year. What do you want to remember about today?</Text>
          <TextInput
            style={styles.modalInput}
            value={content}
            onChangeText={setContent}
            placeholder="Write your letter..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={6}
          />
          <View style={styles.modalButtons}>
            <PillButton label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <PillButton
              label="Seal it"
              onPress={handleSend}
              loading={writeLetter.isPending}
              disabled={!content.trim()}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function LetterRow({ letter, userId }: { letter: FutureLetter; userId: string }) {
  const openLetter = useOpenLetter(userId);
  const [revealed, setRevealed] = useState(false);
  const isUnlocked = letter.unlock_date <= new Date().toISOString().slice(0, 10);

  if (!isUnlocked) {
    return (
      <View style={[styles.letterRow, styles.letterRowInline]}>
        <LockIcon width={14} height={14} />
        <Text style={styles.letterMeta}>Sealed until {letter.unlock_date}</Text>
      </View>
    );
  }

  if (!letter.opened_at && !revealed) {
    return (
      <TouchableOpacity
        style={[styles.letterRow, styles.letterRowInline]}
        onPress={() => {
          setRevealed(true);
          openLetter.mutate(letter.id);
        }}
      >
        <CelebrateIcon width={16} height={16} />
        <Text style={styles.letterReady}>A letter from your past self is ready — tap to read</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.letterRow}>
      <Text style={styles.letterMeta}>Written {letter.created_at.slice(0, 10)}</Text>
      <Text style={styles.letterContent}>{letter.content}</Text>
    </View>
  );
}

export function FutureSelfCard({ userId }: { userId: string }) {
  const { data: letters } = useMyLetters(userId);
  const [writing, setWriting] = useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MailIcon width={18} height={18} />
          <Text style={styles.title}>Future Self</Text>
        </View>
        <TouchableOpacity onPress={() => setWriting(true)}>
          <Text style={styles.newLink}>+ Write</Text>
        </TouchableOpacity>
      </View>

      {letters && letters.length > 0 ? (
        <View style={{ gap: 8 }}>
          {letters.map((letter) => (
            <LetterRow key={letter.id} letter={letter} userId={userId} />
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>Write a letter to open in a year.</Text>
      )}

      {writing && <WriteLetterModal userId={userId} onClose={() => setWriting(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    marginTop: 12,
    gap: 10,
    ...shadow,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  newLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
  empty: { fontSize: 12, color: colors.textSecondary },
  letterRow: { backgroundColor: colors.inputBg, borderRadius: radii.input, padding: 12, gap: 4 },
  letterRowInline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  letterMeta: { fontSize: 11, color: colors.textSecondary },
  letterReady: { fontSize: 13, fontWeight: '700', color: colors.primary },
  letterContent: { fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
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
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  modalHint: { fontSize: 12, color: colors.textSecondary },
  modalInput: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 14,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
