import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  useChallenges,
  useCreateChallenge,
  useLogChallengeContribution,
  type ChallengeWithProgress,
} from '../hooks/useChallenges';
import { useLogEvent } from '../hooks/useEvents';
import { useCreateAchievement } from '../hooks/useAchievements';
import { useCircleDetail } from '../hooks/useCircles';
import { ProgressBar } from './ProgressBar';
import { PillButton } from './PillButton';
import { MilestoneCardModal } from './MilestoneCardModal';
import { categoryColors, colors, radii, shadow } from '../theme/colors';

function NewChallengeModal({
  circleId,
  userId,
  onClose,
}: {
  circleId: string;
  userId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const createChallenge = useCreateChallenge(circleId);

  async function handleCreate() {
    const targetValue = Number(target);
    if (!title.trim() || !targetValue) return;
    await createChallenge.mutateAsync({ circleId, userId, title: title.trim(), target: targetValue });
    onClose();
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>New Circle Challenge</Text>
          <TextInput
            style={styles.modalInput}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. 30-Day Water Challenge"
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            style={styles.modalInput}
            value={target}
            onChangeText={setTarget}
            placeholder="Shared target"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
          />
          <View style={styles.modalButtons}>
            <PillButton label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <PillButton
              label="Start"
              onPress={handleCreate}
              loading={createChallenge.isPending}
              disabled={!title.trim() || !target}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function LogContributionModal({
  challenge,
  circleId,
  userId,
  onClose,
  onCompleted,
}: {
  challenge: ChallengeWithProgress;
  circleId: string;
  userId: string;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [amount, setAmount] = useState('');
  const logContribution = useLogChallengeContribution(circleId);
  const logEvent = useLogEvent();
  const createAchievement = useCreateAchievement();

  async function handleLog() {
    const value = Number(amount);
    if (!value) return;
    await logContribution.mutateAsync({ challengeId: challenge.id, userId, amount: value });

    const justCompleted = challenge.progress < challenge.target && challenge.progress + value >= challenge.target;
    if (justCompleted) {
      await logEvent.mutateAsync({
        circleId,
        userId,
        type: 'challenge_completed',
        payload: { title: challenge.title },
      });
      await createAchievement.mutateAsync({
        userId,
        circleId,
        type: 'challenge_completed',
        title: `Circle completed "${challenge.title}"`,
      });
      onCompleted();
    } else {
      onClose();
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{challenge.title}</Text>
          <TextInput
            style={styles.modalInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="Your contribution"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            autoFocus
          />
          <View style={styles.modalButtons}>
            <PillButton label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <PillButton
              label="Log"
              onPress={handleLog}
              loading={logContribution.isPending}
              disabled={!amount}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ChallengesCard({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: challenges } = useChallenges(circleId);
  const { data: circle } = useCircleDetail(circleId);
  const [creating, setCreating] = useState(false);
  const [logging, setLogging] = useState<ChallengeWithProgress | null>(null);
  const [celebrating, setCelebrating] = useState<ChallengeWithProgress | null>(null);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🚀 Circle Challenges</Text>
        <TouchableOpacity onPress={() => setCreating(true)}>
          <Text style={styles.newLink}>+ New</Text>
        </TouchableOpacity>
      </View>

      {challenges && challenges.length > 0 ? (
        <View style={{ gap: 12 }}>
          {challenges.map((challenge) => (
            <View key={challenge.id} style={styles.challenge}>
              <Text style={styles.challengeTitle}>{challenge.title}</Text>
              <ProgressBar progress={challenge.progress} target={challenge.target} />
              <View style={styles.challengeFooter}>
                <Text style={styles.challengeMeta}>
                  {challenge.progress} / {challenge.target} · {challenge.contributors}{' '}
                  {challenge.contributors === 1 ? 'member' : 'members'}
                </Text>
                <TouchableOpacity onPress={() => setLogging(challenge)}>
                  <Text style={styles.logLink}>Log progress</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>No active challenges — start one your whole circle can chip in on.</Text>
      )}

      {creating && <NewChallengeModal circleId={circleId} userId={userId} onClose={() => setCreating(false)} />}
      {logging && (
        <LogContributionModal
          challenge={logging}
          circleId={circleId}
          userId={userId}
          onClose={() => setLogging(null)}
          onCompleted={() => {
            setCelebrating(logging);
            setLogging(null);
          }}
        />
      )}
      {celebrating && (
        <MilestoneCardModal
          title={`Circle completed "${celebrating.title}"! 🎉`}
          circleName={circle?.name}
          onClose={() => setCelebrating(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: categoryColors.ideas.bg,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 20,
    ...shadow,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: categoryColors.ideas.text },
  newLink: { fontSize: 13, fontWeight: '700', color: categoryColors.ideas.text },
  challenge: { gap: 6 },
  challengeTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  challengeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  challengeMeta: { fontSize: 11, color: colors.textSecondary },
  logLink: { fontSize: 12, fontWeight: '700', color: categoryColors.ideas.text },
  empty: { fontSize: 12, color: categoryColors.ideas.text, opacity: 0.8 },
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
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
