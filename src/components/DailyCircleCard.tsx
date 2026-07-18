import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAnswerCircleCard, useCircleCard } from '../hooks/useCircleCard';
import { PillButton } from './PillButton';
import { gradients, colors, radii } from '../theme/colors';
import ChatIcon from '../../assets/illustrations/kinly-ill-chat.svg';

export function DailyCircleCard({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: answers, prompt, date } = useCircleCard(circleId);
  const answerMutation = useAnswerCircleCard(circleId);
  const [draft, setDraft] = useState('');

  const myAnswer = answers?.find((a) => a.user_id === userId);
  const hasAnswered = !!myAnswer;

  async function handleSubmit() {
    if (!draft.trim()) return;
    await answerMutation.mutateAsync({ userId, promptDate: date, promptText: prompt, answer: draft.trim() });
    setDraft('');
  }

  return (
    <LinearGradient colors={gradients.brand} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={styles.titleRow}>
        <ChatIcon width={20} height={20} />
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
            placeholderTextColor="rgba(255,255,255,0.6)"
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

const styles = StyleSheet.create({
  card: { borderRadius: radii.card, padding: 16, marginBottom: 20, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '700', color: '#fff' },
  prompt: { fontSize: 16, fontWeight: '700', color: '#fff', lineHeight: 22 },
  answerRow: { gap: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  answers: { gap: 8 },
  answerBubble: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radii.input,
    padding: 10,
  },
  answerAuthor: { fontSize: 11, fontWeight: '700', color: colors.background },
  answerText: { fontSize: 13, color: '#fff', marginTop: 2 },
});
