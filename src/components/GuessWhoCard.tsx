import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useCreateGuessWho, useGuessWhoPosts, useSubmitGuess, type GuessWhoPostWithGuesses } from '../hooks/useGuessWho';
import { useCircleMembers } from '../hooks/useCircles';
import { PillButton } from './PillButton';
import { categoryColors, colors, radii, shadow } from '../theme/colors';

function NewFactModal({
  circleId,
  userId,
  onClose,
}: {
  circleId: string;
  userId: string;
  onClose: () => void;
}) {
  const { data: members } = useCircleMembers(circleId);
  const [fact, setFact] = useState('');
  const [answerUserId, setAnswerUserId] = useState<string | null>(null);
  const createPost = useCreateGuessWho(circleId);

  async function handlePost() {
    if (!fact.trim() || !answerUserId) return;
    await createPost.mutateAsync({ userId, fact: fact.trim(), answerUserId });
    onClose();
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Someone in this circle...</Text>
          <TextInput
            style={styles.modalInput}
            value={fact}
            onChangeText={setFact}
            placeholder="once forgot their passport at the airport"
            placeholderTextColor={colors.textSecondary}
            multiline
          />
          <Text style={styles.pickLabel}>Who is it about?</Text>
          <View style={styles.memberChips}>
            {members?.filter((m) => m.status === 'active').map((m) => (
              <TouchableOpacity
                key={m.user_id}
                style={[styles.chip, answerUserId === m.user_id && styles.chipActive]}
                onPress={() => setAnswerUserId(m.user_id)}
              >
                <Text style={[styles.chipText, answerUserId === m.user_id && styles.chipTextActive]}>
                  {m.profiles?.name ?? 'Member'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.modalButtons}>
            <PillButton label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <PillButton
              label="Post"
              onPress={handlePost}
              loading={createPost.isPending}
              disabled={!fact.trim() || !answerUserId}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function GuessWhoPostRow({
  post,
  circleId,
  userId,
}: {
  post: GuessWhoPostWithGuesses;
  circleId: string;
  userId: string;
}) {
  const { data: members } = useCircleMembers(circleId);
  const submitGuess = useSubmitGuess(circleId);
  const myGuess = post.guess_who_guesses.find((g) => g.user_id === userId);
  const revealed = !!myGuess;

  return (
    <View style={styles.postCard}>
      <Text style={styles.fact}>"{post.fact}"</Text>
      {!revealed ? (
        <View style={styles.memberChips}>
          {members
            ?.filter((m) => m.user_id !== post.created_by)
            .map((m) => (
              <TouchableOpacity
                key={m.user_id}
                style={styles.chip}
                onPress={() => submitGuess.mutate({ postId: post.id, userId, guessedUserId: m.user_id })}
              >
                <Text style={styles.chipText}>{m.profiles?.name ?? 'Member'}</Text>
              </TouchableOpacity>
            ))}
        </View>
      ) : (
        <View>
          <Text style={styles.revealed}>
            ✅ It was {members?.find((m) => m.user_id === post.answer_user_id)?.profiles?.name ?? 'someone'}!
          </Text>
          <Text style={styles.guessCount}>{post.guess_who_guesses.length} guessed</Text>
        </View>
      )}
    </View>
  );
}

export function GuessWhoCard({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: posts } = useGuessWhoPosts(circleId);
  const [creating, setCreating] = useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🎭 Guess Who</Text>
        <TouchableOpacity onPress={() => setCreating(true)}>
          <Text style={styles.newLink}>+ New</Text>
        </TouchableOpacity>
      </View>

      {posts && posts.length > 0 ? (
        <View style={{ gap: 10 }}>
          {posts.slice(0, 3).map((post) => (
            <GuessWhoPostRow key={post.id} post={post} circleId={circleId} userId={userId} />
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>Share a fact about someone in the circle — others guess who.</Text>
      )}

      {creating && <NewFactModal circleId={circleId} userId={userId} onClose={() => setCreating(false)} />}
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
  empty: { fontSize: 12, color: categoryColors.ideas.text, opacity: 0.8 },
  postCard: { backgroundColor: colors.surface, borderRadius: radii.input, padding: 12, gap: 8 },
  fact: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, fontStyle: 'italic' },
  memberChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
  revealed: { fontSize: 13, fontWeight: '700', color: colors.success },
  guessCount: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
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
  pickLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
