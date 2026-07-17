import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '../state/useAuthStore';
import {
  useAskPosts,
  useAskReplies,
  useCreateAskPost,
  useCreateReply,
  useDeleteAskPost,
  type AskPostWithProfile,
} from '../hooks/useAskPosts';
import { useGoals } from '../hooks/useGoals';
import { DailyCircleCard } from '../components/DailyCircleCard';
import { WouldYouRatherCard } from '../components/WouldYouRatherCard';
import { GuessWhoCard } from '../components/GuessWhoCard';
import { DisclosureSection } from '../components/DisclosureSection';
import { colors, radii, shadow } from '../theme/colors';

function ReplyThread({ askPostId, circleId, userId }: { askPostId: string; circleId: string; userId: string }) {
  const { data: replies, isLoading } = useAskReplies(askPostId);
  const createReply = useCreateReply(circleId);
  const [body, setBody] = useState('');

  async function handleSend() {
    if (!body.trim()) return;
    await createReply.mutateAsync({ askPostId, userId, body: body.trim() });
    setBody('');
  }

  return (
    <View style={styles.thread}>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        replies?.map((reply) => (
          <View key={reply.id} style={styles.replyRow}>
            <Text style={styles.replyAuthor}>{reply.profiles?.name ?? 'Someone'}</Text>
            <Text style={styles.replyBody}>{reply.body}</Text>
          </View>
        ))
      )}
      <View style={styles.replyInputRow}>
        <TextInput
          style={styles.replyInput}
          placeholder="Write a reply..."
          placeholderTextColor={colors.textSecondary}
          value={body}
          onChangeText={setBody}
        />
        <TouchableOpacity style={styles.replySend} onPress={handleSend} disabled={createReply.isPending}>
          <Text style={styles.replySendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AskCard({
  post,
  circleId,
  userId,
  expanded,
  onToggle,
}: {
  post: AskPostWithProfile;
  circleId: string;
  userId: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const deletePost = useDeleteAskPost(circleId);
  const isMine = post.user_id === userId;

  function handleDelete() {
    Alert.alert('Delete this post?', 'This will also delete its replies.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePost.mutate(post.id) },
    ]);
  }

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onToggle}>
        <View style={styles.questionRow}>
          <Text style={styles.question}>{post.question}</Text>
          {isMine && (
            <TouchableOpacity
              onPress={handleDelete}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Delete this post"
            >
              <Text style={styles.deleteButton}>🗑</Text>
            </TouchableOpacity>
          )}
        </View>
        {post.goals?.title && <Text style={styles.goalTag}>🎯 {post.goals.title}</Text>}
        <View style={styles.cardFooter}>
          <Text style={styles.meta}>{post.profiles?.name ?? 'Someone'}</Text>
          <Text style={styles.meta}>
            {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'} · {expanded ? 'Hide' : 'Discuss'}
          </Text>
        </View>
      </TouchableOpacity>
      {expanded && <ReplyThread askPostId={post.id} circleId={circleId} userId={userId} />}
    </View>
  );
}

export default function ConnectionScreen() {
  const userId = useAuthStore((state) => state.user?.id);
  const circleId = useAuthStore((state) => state.activeCircleId);
  const { data: posts, isLoading } = useAskPosts(circleId ?? undefined);
  const { data: goals } = useGoals(circleId ?? undefined);
  const createPost = useCreateAskPost();

  const [question, setQuestion] = useState('');
  const [goalId, setGoalId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const myGoals = (goals ?? []).filter((g) => g.user_id === userId);

  async function handlePost() {
    if (!question.trim() || !circleId || !userId) return;
    await createPost.mutateAsync({ circleId, userId, question: question.trim(), goalId });
    setQuestion('');
    setGoalId(null);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Connection Moments</Text>

          {/* Support: daily check-in + advice from your circle */}
          {userId && circleId && (
            <Animated.View entering={FadeInDown.duration(350)}>
              <DailyCircleCard circleId={circleId} userId={userId} />
            </Animated.View>
          )}

          <Text style={styles.sectionTitle}>Ask Friends</Text>
          <View style={styles.composer}>
            <TextInput
              style={styles.composerInput}
              placeholder="Should I invest in this? Review my resume?"
              placeholderTextColor={colors.textSecondary}
              value={question}
              onChangeText={setQuestion}
              multiline
            />
            {myGoals.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goalChips}>
                {myGoals.map((goal) => {
                  const active = goalId === goal.id;
                  return (
                    <TouchableOpacity
                      key={goal.id}
                      style={[styles.goalChip, active && styles.goalChipActive]}
                      onPress={() => setGoalId(active ? null : goal.id)}
                    >
                      <Text style={[styles.goalChipText, active && styles.goalChipTextActive]}>
                        🎯 {goal.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.postButton} onPress={handlePost} disabled={createPost.isPending}>
              <Text style={styles.postButtonText}>Post</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : posts && posts.length > 0 ? (
            <View style={styles.list}>
              {posts.map((post, index) =>
                userId && circleId ? (
                  <Animated.View key={post.id} entering={FadeInDown.duration(300).delay(Math.min(index, 6) * 50)}>
                    <AskCard
                      post={post}
                      circleId={circleId}
                      userId={userId}
                      expanded={expandedId === post.id}
                      onToggle={() => setExpandedId(expandedId === post.id ? null : post.id)}
                    />
                  </Animated.View>
                ) : null,
              )}
            </View>
          ) : (
            <Text style={styles.empty}>No open questions yet — ask your circle something above.</Text>
          )}

          {/* Play: lighter, lower-stakes moments — tucked away so they don't outweigh accountability */}
          <View style={styles.gamesSection}>
            <DisclosureSection label="✨ Light Moments">
              {userId && circleId && <WouldYouRatherCard circleId={circleId} userId={userId} />}
              {userId && circleId && <GuessWhoCard circleId={circleId} userId={userId} />}
            </DisclosureSection>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  page: { padding: 16, paddingBottom: 110 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  composer: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 12,
    gap: 8,
    marginBottom: 16,
    ...shadow,
  },
  composerInput: { minHeight: 44, color: colors.textPrimary, fontSize: 14 },
  goalChips: { gap: 6 },
  goalChip: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  goalChipActive: { backgroundColor: colors.primary },
  goalChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  goalChipTextActive: { color: '#fff' },
  goalTag: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  postButton: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  postButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  list: { gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    gap: 8,
    ...shadow,
  },
  questionRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  question: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  deleteButton: { fontSize: 15, opacity: 0.6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { fontSize: 12, color: colors.textSecondary },
  thread: { marginTop: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.inputBg, paddingTop: 12 },
  replyRow: { gap: 2 },
  replyAuthor: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  replyBody: { fontSize: 13, color: colors.textSecondary },
  replyInputRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  replyInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: radii.input,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.textPrimary,
    fontSize: 13,
  },
  replySend: {
    backgroundColor: colors.primary,
    borderRadius: radii.input,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  replySendText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 24 },
  gamesSection: { marginTop: 24 },
});
