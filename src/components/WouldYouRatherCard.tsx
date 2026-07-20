import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useCreatePoll, useLatestPoll, useVotePoll } from '../hooks/useWouldYouRather';
import { PillButton } from './PillButton';
import { cardShell, colors, radii } from '../theme/colors';
import { RelationshipsIcon } from './icons/PillarIcons';

function NewPollModal({
  circleId,
  userId,
  onClose,
}: {
  circleId: string;
  userId: string;
  onClose: () => void;
}) {
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const createPoll = useCreatePoll(circleId);

  async function handleCreate() {
    if (!optionA.trim() || !optionB.trim()) return;
    await createPoll.mutateAsync({ userId, optionA: optionA.trim(), optionB: optionB.trim() });
    onClose();
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Would you rather...</Text>
          <TextInput style={styles.modalInput} value={optionA} onChangeText={setOptionA} placeholder="Option A" placeholderTextColor={colors.textSecondary} />
          <Text style={styles.orText}>or</Text>
          <TextInput style={styles.modalInput} value={optionB} onChangeText={setOptionB} placeholder="Option B" placeholderTextColor={colors.textSecondary} />
          <View style={styles.modalButtons}>
            <PillButton label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <PillButton
              label="Post"
              onPress={handleCreate}
              loading={createPoll.isPending}
              disabled={!optionA.trim() || !optionB.trim()}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function WouldYouRatherCard({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: poll } = useLatestPoll(circleId, userId);
  const votePoll = useVotePoll(circleId);
  const [creating, setCreating] = useState(false);

  const total = (poll?.votesA ?? 0) + (poll?.votesB ?? 0);
  const pctA = total > 0 ? Math.round(((poll?.votesA ?? 0) / total) * 100) : 0;
  const pctB = total > 0 ? Math.round(((poll?.votesB ?? 0) / total) * 100) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <RelationshipsIcon size={16} color={colors.primary} />
          <Text style={styles.title}>Would You Rather</Text>
        </View>
        <TouchableOpacity onPress={() => setCreating(true)}>
          <Text style={styles.newLink}>+ New</Text>
        </TouchableOpacity>
      </View>

      {!poll ? (
        <Text style={styles.empty}>No poll yet — start one for your circle to vote on.</Text>
      ) : (
        <View style={styles.options}>
          <Text style={styles.hint}>{poll.myChoice ? 'Tap the other one to change your vote' : 'Tap an option to vote'}</Text>
          <TouchableOpacity
            style={[styles.option, poll.myChoice === 'a' && styles.optionActive]}
            onPress={() => votePoll.mutate({ pollId: poll.id, userId, choice: 'a' })}
          >
            <Text style={styles.optionText}>{poll.option_a}</Text>
            {poll.myChoice && <Text style={styles.optionPct}>{pctA}%</Text>}
          </TouchableOpacity>
          <Text style={styles.orDivider}>or</Text>
          <TouchableOpacity
            style={[styles.option, poll.myChoice === 'b' && styles.optionActive]}
            onPress={() => votePoll.mutate({ pollId: poll.id, userId, choice: 'b' })}
          >
            <Text style={styles.optionText}>{poll.option_b}</Text>
            {poll.myChoice && <Text style={styles.optionPct}>{pctB}%</Text>}
          </TouchableOpacity>
        </View>
      )}

      {creating && <NewPollModal circleId={circleId} userId={userId} onClose={() => setCreating(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardShell,
    padding: 20,
    paddingLeft: 18,
    marginBottom: 20,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '500', color: colors.shellTitle },
  newLink: { fontSize: 13, fontWeight: '500', color: colors.primary },
  empty: { fontSize: 13, color: colors.shellSecondary },
  hint: { fontSize: 11, color: colors.shellSecondary, marginBottom: 2 },
  options: { gap: 8 },
  option: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionActive: { borderWidth: 1.5, borderColor: colors.primary },
  optionText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  optionPct: { fontSize: 13, fontWeight: '800', color: colors.primary },
  orDivider: { textAlign: 'center', fontSize: 11, color: colors.textSecondary },
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
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalInput: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
  },
  orText: { textAlign: 'center', color: colors.textSecondary },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
