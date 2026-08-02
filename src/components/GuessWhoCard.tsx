import { AnimatedPressable } from './AnimatedPressable';
import { fontFamily, spacing } from '../theme/colors';
import { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCreateGuessWho, useGuessWhoPosts, useSubmitGuess, type GuessWhoPostWithGuesses } from '../hooks/useGuessWho';
import { useCircleMembers } from '../hooks/useCircles';
import { PillButton } from './PillButton';
import { useTheme } from '../theme/ThemeProvider';
import MasksIcon from '../../assets/icons/feed/masks.svg';
import CheckIcon from '../../assets/icons/feed/check.svg';

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
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
            placeholderTextColor={theme.colors.textSecondary}
            multiline
          />
          <Text style={styles.pickLabel}>Who is it about?</Text>
          <View style={styles.memberChips}>
            {members?.filter((m) => m.status === 'active').map((m) => (
              <AnimatedPressable
      accessibilityRole="button"
                key={m.user_id}
                style={[styles.chip, answerUserId === m.user_id && styles.chipActive]}
                onPress={() => setAnswerUserId(m.user_id)}
              >
                <Text style={[styles.chipText, answerUserId === m.user_id && styles.chipTextActive]}>
                  {m.profiles?.name ?? 'Member'}
                </Text>
              </AnimatedPressable>
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
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const myGuess = post.guess_who_guesses.find((g) => g.user_id === userId);
  const revealed = !!myGuess;

  return (
    <View style={styles.postCard}>
      <Text style={styles.fact}>{`"${post.fact}"`}</Text>
      {!revealed ? (
        <View>
          <Text style={styles.hint}>Tap who you think it is</Text>
          <View style={styles.memberChips}>
            {members
              ?.filter((m) => m.user_id !== post.created_by)
              .map((m) => (
                <AnimatedPressable
      accessibilityRole="button"
                  key={m.user_id}
                  style={styles.chip}
                  onPress={() => submitGuess.mutate({ postId: post.id, userId, guessedUserId: m.user_id })}
                >
                  <Text style={styles.chipText}>{m.profiles?.name ?? 'Member'}</Text>
                </AnimatedPressable>
              ))}
          </View>
        </View>
      ) : (
        <View>
          <View style={styles.revealedRow}>
            <CheckIcon width={14} height={14} color={theme.colors.primary} />
            <Text style={styles.revealed}>
              It was {members?.find((m) => m.user_id === post.answer_user_id)?.profiles?.name ?? 'someone'}!
            </Text>
          </View>
          <Text style={styles.guessCount}>{post.guess_who_guesses.length} guessed</Text>
        </View>
      )}
    </View>
  );
}

export function GuessWhoCard({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: posts } = useGuessWhoPosts(circleId);
  const [creating, setCreating] = useState(false);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MasksIcon width={18} height={18} color={theme.colors.textSecondary} />
          <Text style={styles.title}>Guess Who</Text>
        </View>
        <AnimatedPressable
      accessibilityRole="button" onPress={() => setCreating(true)}>
          <Text style={styles.newLink}>+ New</Text>
        </AnimatedPressable>
      </View>

      {posts && posts.length > 0 ? (
        <View style={{ gap: spacing.s10 }}>
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

function createStyles({ colors, radii, cardShell, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      ...cardShell,
      padding: spacing.xl,
      paddingLeft: spacing.s18,
      marginBottom: spacing.xl,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s6 },
    revealedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s6 },
    title: { ...type.body, fontFamily: fontFamily.medium, color: colors.shellTitle },
    newLink: { ...type.caption, fontFamily: fontFamily.medium, color: colors.primary },
    empty: { ...type.caption, fontFamily: fontFamily.regular, color: colors.shellSecondary },
    hint: { ...type.caption, fontFamily: fontFamily.regular, color: colors.shellSecondary, marginBottom: spacing.s6 },
    postCard: { backgroundColor: colors.surface, borderRadius: radii.input, padding: spacing.md, gap: spacing.sm },
    fact: { ...type.caption, fontFamily: fontFamily.semibold, color: colors.textPrimary, fontStyle: 'italic' },
    memberChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s6 },
    chip: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.s10,
      paddingVertical: spacing.s6,
    },
    chipActive: { backgroundColor: colors.primary },
    chipText: { ...type.caption, fontFamily: fontFamily.semibold, color: colors.textSecondary },
    chipTextActive: { color: colors.onAccent },
    revealed: { ...type.caption, fontFamily: fontFamily.bold, color: colors.success },
    guessCount: { ...type.caption, fontFamily: fontFamily.regular, color: colors.textSecondary, marginTop: spacing.s2 },
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
      gap: spacing.s10,
    },
    modalTitle: { ...type.subheading, fontFamily: fontFamily.bold, color: colors.textPrimary },
    modalInput: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.input,
      paddingHorizontal: spacing.s14,
      paddingVertical: spacing.md,
      color: colors.textPrimary,
      ...type.body, fontFamily: fontFamily.regular,
    },
    pickLabel: { ...type.caption, fontFamily: fontFamily.semibold, color: colors.textSecondary },
    modalButtons: { flexDirection: 'row', gap: spacing.s10, marginTop: spacing.xs },
  });
}
