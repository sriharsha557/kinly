import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useCircleAI } from '../hooks/useCircleAI';
import { useCreateChallenge } from '../hooks/useChallenges';
import { INTEREST_OPTIONS } from './InterestPicker';
import { IdeasIcon } from './icons/PillarIcons';
import { colors, radii, shadow } from '../theme/colors';
import IdeaBulb from '../../assets/illustrations/kinly-ill-idea-bulb.svg';

export function CircleAICard({
  circleId,
  userId,
  onChallengeStarted,
}: {
  circleId: string;
  userId: string;
  onChallengeStarted?: () => void;
}) {
  const { data } = useCircleAI(circleId);
  const createChallenge = useCreateChallenge(circleId);
  const [started, setStarted] = useState(false);

  if (!data || !data.message) return null;

  const strongestOpt = INTEREST_OPTIONS.find((o) => o.key === data.strongest);
  const weakestOpt = data.weakest ? INTEREST_OPTIONS.find((o) => o.key === data.weakest) : null;

  async function handleStartChallenge() {
    if (!data?.suggestedChallenge) return;
    await createChallenge.mutateAsync({ circleId, userId, title: data.suggestedChallenge, target: 7 });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStarted(true);
    onChallengeStarted?.();
  }

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <IdeaBulb width={20} height={20} />
        <Text style={styles.title}>Kinly AI</Text>
      </View>
      <Text style={styles.message}>{data.message}</Text>
      <View style={styles.pillRow}>
        {strongestOpt && (
          <View style={styles.pill}>
            <strongestOpt.Icon size={13} color={colors.textPrimary} />
            <Text style={styles.pillText}>Strongest: {strongestOpt.label}</Text>
          </View>
        )}
        {weakestOpt && (
          <View style={styles.pill}>
            <weakestOpt.Icon size={13} color={colors.textPrimary} />
            <Text style={styles.pillText}>Needs love: {weakestOpt.label}</Text>
          </View>
        )}
      </View>
      {data.suggestedChallenge &&
        (started ? (
          <View style={[styles.suggestion, styles.suggestionDone]}>
            <Text style={styles.suggestionText}>✓ Started — see Circle Challenges above</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.suggestion, styles.suggestionRow]}
            onPress={handleStartChallenge}
            disabled={createChallenge.isPending}
          >
            <IdeasIcon size={14} color="#fff" />
            <Text style={styles.suggestionText}>
              {createChallenge.isPending ? 'Starting…' : `Try: ${data.suggestedChallenge}`}
            </Text>
          </TouchableOpacity>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 20,
    gap: 10,
    ...shadow,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  message: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: { fontSize: 11, fontWeight: '600', color: colors.textPrimary },
  suggestion: {
    backgroundColor: colors.primary,
    borderRadius: radii.input,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  suggestionDone: { backgroundColor: colors.success },
  suggestionText: { fontSize: 13, fontWeight: '700', color: '#fff', textAlign: 'center' },
});
