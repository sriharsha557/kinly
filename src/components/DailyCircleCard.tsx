import { fontFamily, spacing } from '../theme/colors';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAnswerCircleCard, useCircleCard } from '../hooks/useCircleCard';
import { PillButton } from './PillButton';
import { useTheme } from '../theme/ThemeProvider';
import ChatIcon from '../../assets/illustrations/kinly-ill-chat.svg';

export function DailyCircleCard({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: answers, prompt, date } = useCircleCard(circleId);
  const answerMutation = useAnswerCircleCard(circleId);
  const [draft, setDraft] = useState('');
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const myAnswer = answers?.find((a) => a.user_id === userId);
  const hasAnswered = !!myAnswer;

  async function handleSubmit() {
    if (!draft.trim()) return;
    await answerMutation.mutateAsync({ userId, promptDate: date, promptText: prompt, answer: draft.trim() });
    setDraft('');
  }

  return (
    <LinearGradient colors={theme.gradients.brand} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={styles.titleRow}>
        <ChatIcon width={20} height={20} color={theme.colors.textSecondary} />
        <Text style={styles.title}>Circle Card</Text>
      </View>
      <Text style={styles.prompt}>{prompt}</Text>

      {!hasAnswered ? (
        <View style={styles.answerRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Your answer..."
            placeholderTextColor={theme.colors.onAccentFaint}
            multiline
          />
          <PillButton
            label="Share"
            onPress={handleSubmit}
            loading={answerMutation.isPending}
            disabled={!draft.trim()}
          />
        </View>
      ) : (
        <View style={styles.answers}>
          {answers?.map((a) => (
            <View key={a.id} style={styles.answerBubble}>
              <Text style={styles.answerAuthor}>{a.profiles?.name ?? 'Someone'}</Text>
              <Text style={styles.answerText}>{a.answer}</Text>
            </View>
          ))}
        </View>
      )}
    </LinearGradient>
  );
}

function createStyles({ colors, radii, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: { borderRadius: radii.card, padding: spacing.lg, marginBottom: spacing.xl, gap: spacing.s10 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { ...type.body, fontFamily: fontFamily.bold, color: colors.onAccent },
    prompt: { ...type.body, fontFamily: fontFamily.bold, color: colors.onAccent, lineHeight: 22 },
    answerRow: { gap: spacing.sm },
    input: {
      backgroundColor: colors.onAccentGlaze,
      borderRadius: radii.input,
      paddingHorizontal: spacing.s14,
      paddingVertical: spacing.md,
      color: colors.onAccent,
      ...type.secondary, fontFamily: fontFamily.regular,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    answers: { gap: spacing.sm },
    answerBubble: {
      backgroundColor: colors.onAccentGlaze,
      borderRadius: radii.input,
      padding: spacing.s10,
    },
    answerAuthor: { ...type.caption, fontFamily: fontFamily.bold, color: colors.background },
    answerText: { ...type.caption, fontFamily: fontFamily.regular, color: colors.onAccent, marginTop: spacing.s2 },
  });
}
