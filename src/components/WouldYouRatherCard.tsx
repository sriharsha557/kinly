import { AnimatedPressable } from './AnimatedPressable';
import { fontFamily, spacing } from '../theme/colors';
import { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCreatePoll, useLatestPoll, useVotePoll } from '../hooks/useWouldYouRather';
import { PillButton } from './PillButton';
import { useTheme } from '../theme/ThemeProvider';
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
  const theme = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

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
  const theme = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

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
        <AnimatedPressable
      accessibilityRole="button" onPress={() => setCreating(true)}>
          <Text style={styles.newLink}>+ New</Text>
        </AnimatedPressable>
      </View>

      {!poll ? (
        <Text style={styles.empty}>No poll yet — start one for your circle to vote on.</Text>
      ) : (
        <View style={styles.options}>
          <Text style={styles.hint}>{poll.myChoice ? 'Tap the other one to change your vote' : 'Tap an option to vote'}</Text>
          <AnimatedPressable
      accessibilityRole="button"
            style={[styles.option, poll.myChoice === 'a' && styles.optionActive]}
            onPress={() => votePoll.mutate({ pollId: poll.id, userId, choice: 'a' })}
          >
            <Text style={styles.optionText}>{poll.option_a}</Text>
            {poll.myChoice && <Text style={styles.optionPct}>{pctA}%</Text>}
          </AnimatedPressable>
          <Text style={styles.orDivider}>or</Text>
          <AnimatedPressable
      accessibilityRole="button"
            style={[styles.option, poll.myChoice === 'b' && styles.optionActive]}
            onPress={() => votePoll.mutate({ pollId: poll.id, userId, choice: 'b' })}
          >
            <Text style={styles.optionText}>{poll.option_b}</Text>
            {poll.myChoice && <Text style={styles.optionPct}>{pctB}%</Text>}
          </AnimatedPressable>
        </View>
      )}

      {creating && <NewPollModal circleId={circleId} userId={userId} onClose={() => setCreating(false)} />}
    </View>
  );
}

function createStyles({ colors, radii, cardShell, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      ...cardShell,
      padding: spacing.xl,
      paddingLeft: 18,
      marginBottom: spacing.xl,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { ...type.body, fontFamily: fontFamily.medium, color: colors.shellTitle },
    newLink: { ...type.caption, fontFamily: fontFamily.medium, color: colors.primary },
    empty: { ...type.caption, fontFamily: fontFamily.regular, color: colors.shellSecondary },
    hint: { ...type.caption, fontFamily: fontFamily.regular, color: colors.shellSecondary, marginBottom: 2 },
    options: { gap: spacing.sm },
    option: {
      backgroundColor: colors.surface,
      borderRadius: radii.input,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    optionActive: { borderWidth: 1.5, borderColor: colors.primary },
    optionText: { ...type.secondary, fontFamily: fontFamily.semibold, color: colors.textPrimary, flex: 1 },
    optionPct: { ...type.caption, fontFamily: fontFamily.bold, color: colors.primary },
    orDivider: { textAlign: 'center', ...type.caption, fontFamily: fontFamily.regular, color: colors.textSecondary },
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
      gap: 10,
    },
    modalTitle: { ...type.subheading, fontFamily: fontFamily.bold, color: colors.textPrimary },
    modalInput: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.input,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      color: colors.textPrimary,
      ...type.body, fontFamily: fontFamily.regular,
    },
    orText: { textAlign: 'center', color: colors.textSecondary },
    modalButtons: { flexDirection: 'row', gap: 10, marginTop: spacing.xs },
  });
}
