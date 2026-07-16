import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCircleAI } from '../hooks/useCircleAI';
import { useCreateChallenge } from '../hooks/useChallenges';
import { INTEREST_OPTIONS } from './InterestPicker';
import { colors, radii, shadow } from '../theme/colors';

export function CircleAICard({ circleId, userId }: { circleId: string; userId: string }) {
  const { data } = useCircleAI(circleId);
  const createChallenge = useCreateChallenge(circleId);

  if (!data || !data.message) return null;

  const strongestOpt = INTEREST_OPTIONS.find((o) => o.key === data.strongest);
  const weakestOpt = data.weakest ? INTEREST_OPTIONS.find((o) => o.key === data.weakest) : null;

  async function handleStartChallenge() {
    if (!data?.suggestedChallenge) return;
    await createChallenge.mutateAsync({ circleId, userId, title: data.suggestedChallenge, target: 7 });
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🧠 Kinly AI</Text>
      <Text style={styles.message}>{data.message}</Text>
      <View style={styles.pillRow}>
        {strongestOpt && (
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              {strongestOpt.emoji} Strongest: {strongestOpt.label}
            </Text>
          </View>
        )}
        {weakestOpt && (
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              {weakestOpt.emoji} Needs love: {weakestOpt.label}
            </Text>
          </View>
        )}
      </View>
      {data.suggestedChallenge && (
        <TouchableOpacity
          style={styles.suggestion}
          onPress={handleStartChallenge}
          disabled={createChallenge.isPending}
        >
          <Text style={styles.suggestionText}>
            💡 {createChallenge.isPending ? 'Starting…' : `Try: ${data.suggestedChallenge}`}
          </Text>
        </TouchableOpacity>
      )}
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
  suggestionText: { fontSize: 13, fontWeight: '700', color: '#fff', textAlign: 'center' },
});
