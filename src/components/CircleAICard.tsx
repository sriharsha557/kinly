import { AnimatedPressable } from './AnimatedPressable';
import { fontFamily, spacing } from '../theme/colors';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useCircleAI } from '../hooks/useCircleAI';
import { useCreateChallenge } from '../hooks/useChallenges';
import { INTEREST_OPTIONS } from './InterestPicker';
import { IdeasIcon } from './icons/PillarIcons';
import { useTheme } from '../theme/ThemeProvider';
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
  const theme = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

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
        {/* Not "Kinly AI" any more - nothing here calls an AI, and leaving
            the name would be a false claim about how the app works. */}
        <Text style={styles.title}>Circle Ideas</Text>
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
          <AnimatedPressable
      accessibilityRole="button"
            style={[styles.suggestion, styles.suggestionRow]}
            onPress={handleStartChallenge}
            disabled={createChallenge.isPending}
          >
            <IdeasIcon size={14} color={colors.onAccent} />
            <Text style={styles.suggestionText}>
              {createChallenge.isPending ? 'Starting…' : `Try: ${data.suggestedChallenge}`}
            </Text>
          </AnimatedPressable>
        ))}
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
      gap: 10,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { ...type.body, fontFamily: fontFamily.medium, color: colors.shellTitle },
    message: { ...type.caption, fontFamily: fontFamily.regular, color: colors.textSecondary },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    pill: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.pill,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    pillText: { ...type.caption, fontFamily: fontFamily.semibold, color: colors.textPrimary },
    suggestion: {
      backgroundColor: colors.primary,
      borderRadius: radii.input,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
    },
    suggestionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    suggestionDone: { backgroundColor: colors.success },
    suggestionText: { ...type.caption, fontFamily: fontFamily.bold, color: colors.onAccent, textAlign: 'center' },
  });
}
