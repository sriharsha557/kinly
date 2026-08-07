import { AnimatedPressable } from '../components/AnimatedPressable';
import { useMemo, useState } from 'react';
import { FEATURES } from '../lib/features';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput, View,
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
import { useBlockUser, useReportContent } from '../hooks/useReports';
import { showModerationSheet } from '../lib/moderation';
import { ActionSheet } from '../components/ActionSheet';
import { ConceptHint } from '../components/ConceptHint';
import { DailyCircleCard } from '../components/DailyCircleCard';
import { WouldYouRatherCard } from '../components/WouldYouRatherCard';
import { GuessWhoCard } from '../components/GuessWhoCard';
import { DisclosureSection } from '../components/DisclosureSection';
import { AskCardSkeleton } from '../components/Skeleton';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useTabBarClearance } from '../hooks/useTabBarClearance';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, motion, spacing, type } from '../theme/colors';
import GoalIcon from '../../assets/illustrations/kinly-Goal.svg';
import DiceIcon from '../../assets/illustrations/kinly-ill-dice.svg';
import DeleteIcon from '../../assets/icons/feed/delete.svg';

function ReplyThread({ askPostId, circleId, userId }: { askPostId: string; circleId: string; userId: string }) {
  const { data: replies, isLoading } = useAskReplies(askPostId);
  const createReply = useCreateReply(circleId);
  const reportContent = useReportContent();
  const blockUser = useBlockUser();
  const [body, setBody] = useState('');
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  async function handleSend() {
    if (!body.trim()) return;
    await createReply.mutateAsync({ askPostId, userId, body: body.trim() });
    setBody('');
  }

  function handleReplyOptions(replyId: string, authorId: string, authorName: string) {
    if (authorId === userId) return;
    showModerationSheet({
      authorName,
      onReport: (reason) => reportContent.mutate({ targetType: 'ask_reply', targetId: replyId, reason }),
      onBlock: () => blockUser.mutate(authorId),
    });
  }

  return (
    <View style={styles.thread}>
      {isLoading ? (
        <LoadingSpinner size={10} />
      ) : (
        replies?.map((reply) => (
          <AnimatedPressable
      accessibilityRole="button"
            key={reply.id}
            style={styles.replyRow}
            onLongPress={() => handleReplyOptions(reply.id, reply.user_id, reply.profiles?.name ?? 'Someone')}
            delayLongPress={400}
          >
            <Text style={styles.replyAuthor}>{reply.profiles?.name ?? 'Someone'}</Text>
            <Text style={styles.replyBody}>{reply.body}</Text>
          </AnimatedPressable>
        ))
      )}
      <View style={styles.replyInputRow}>
        <TextInput
          style={styles.replyInput}
          placeholder="Write a reply..."
          placeholderTextColor={theme.colors.textSecondary}
          value={body}
          onChangeText={setBody}
        />
        <AnimatedPressable
      accessibilityRole="button" style={styles.replySend} onPress={handleSend} disabled={createReply.isPending}>
          <Text style={styles.replySendText}>Send</Text>
        </AnimatedPressable>
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
  const reportContent = useReportContent();
  const blockUser = useBlockUser();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isMine = post.user_id === userId;
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleOptions() {
    const authorName = post.profiles?.name ?? 'Someone';
    showModerationSheet({
      authorName,
      onReport: (reason) => reportContent.mutate({ targetType: 'ask_post', targetId: post.id, reason }),
      onBlock: () => blockUser.mutate(post.user_id),
    });
  }

  return (
    <View style={styles.card}>
      <AnimatedPressable
      accessibilityRole="button" onPress={onToggle}>
        <View style={styles.questionRow}>
          <Text style={styles.question}>{post.question}</Text>
          {isMine ? (
            <AnimatedPressable
              onPress={() => setConfirmingDelete(true)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Delete this post"
            >
              <DeleteIcon width={15} height={15} color={theme.colors.textSecondary} opacity={0.6} />
            </AnimatedPressable>
          ) : (
            <AnimatedPressable
              onPress={handleOptions}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Options for ${post.profiles?.name ?? 'this'} post`}
            >
              <Text style={styles.optionsButton}>⋯</Text>
            </AnimatedPressable>
          )}
        </View>
        {post.goals?.title && (
          <View style={styles.goalTagRow}>
            <GoalIcon width={13} height={13} />
            <Text style={styles.goalTag}>{post.goals.title}</Text>
          </View>
        )}
        <View style={styles.cardFooter}>
          <Text style={styles.meta}>{post.profiles?.name ?? 'Someone'}</Text>
          <Text style={styles.meta}>
            {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'} · {expanded ? 'Hide' : 'Discuss'}
          </Text>
        </View>
      </AnimatedPressable>
      {expanded && <ReplyThread askPostId={post.id} circleId={circleId} userId={userId} />}
      {confirmingDelete && (
        <ActionSheet
          title="Delete this post?"
          message="This will also delete its replies."
          options={[
            {
              label: 'Delete',
              destructive: true,
              onPress: () => {
                setConfirmingDelete(false);
                deletePost.mutate(post.id);
              },
            },
          ]}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </View>
  );
}

export default function ConnectionScreen() {
  const userId = useAuthStore((state) => state.user?.id);
  const circleId = useAuthStore((state) => state.activeCircleId);
  const { data: posts, isLoading, isFetching, refetch } = useAskPosts(circleId ?? undefined);
  const { data: goals } = useGoals(circleId ?? undefined);
  const createPost = useCreateAskPost();
  const tabBarClearance = useTabBarClearance();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
        <ScrollView
          contentContainerStyle={[styles.page, { paddingBottom: tabBarClearance }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={theme.colors.primary} />
          }
        >
          <Text style={styles.title}>Together</Text>
          <View style={styles.titleHint}>
            {FEATURES.circleCard ? (
              <ConceptHint id="connection-moments" text="A daily prompt your circle answers together." />
            ) : (
              // Different id from the circleCard variant on purpose: dismissal
              // is persisted per id, so a tester who already dismissed the
              // "daily prompt" copy still sees this Ask-Friends explanation
              // rather than having it silently suppressed.
              <ConceptHint id="connection-ask" text="Ask your circle for advice, and weigh in on theirs." />
            )}
          </View>

          {FEATURES.circleCard && userId && circleId && (
            <Animated.View entering={FadeInDown.duration(motion.duration.entrance)}>
              <DailyCircleCard circleId={circleId} userId={userId} />
            </Animated.View>
          )}

          <Text style={styles.sectionTitle}>Ask Friends</Text>
          <View style={styles.composer}>
            <TextInput
              style={styles.composerInput}
              placeholder="Should I invest in this? Review my resume?"
              placeholderTextColor={theme.colors.textSecondary}
              value={question}
              onChangeText={setQuestion}
              multiline
            />
            {myGoals.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goalChips}>
                {myGoals.map((goal) => {
                  const active = goalId === goal.id;
                  return (
                    <AnimatedPressable
      accessibilityRole="button"
                      key={goal.id}
                      style={[styles.goalChip, active && styles.goalChipActive]}
                      onPress={() => setGoalId(active ? null : goal.id)}
                    >
                      <View style={styles.goalChipRow}>
                        <GoalIcon width={12} height={12} />
                        <Text style={[styles.goalChipText, active && styles.goalChipTextActive]}>
                          {goal.title}
                        </Text>
                      </View>
                    </AnimatedPressable>
                  );
                })}
              </ScrollView>
            )}
            <AnimatedPressable
      accessibilityRole="button" style={styles.postButton} onPress={handlePost} disabled={createPost.isPending}>
              <Text style={styles.postButtonText}>Post</Text>
            </AnimatedPressable>
          </View>

          {isLoading ? (
            <View>
              <AskCardSkeleton />
              <AskCardSkeleton />
            </View>
          ) : posts && posts.length > 0 ? (
            <View style={styles.list}>
              {posts.map((post, index) =>
                userId && circleId ? (
                  <Animated.View
                key={post.id}
                entering={FadeInDown.duration(motion.duration.entrance).delay(
                  Math.min(index, motion.stagger.maxItems) * motion.stagger.step,
                )}
              >
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

          {/* Play: lighter, lower-stakes moments - tucked away so they don't
              outweigh accountability. Gated on its children so the section
              does not survive as an empty shell once both games are
              deferred. */}
          {(FEATURES.wouldYouRather || FEATURES.guessWho) && (
            <View style={styles.gamesSection}>
              <DisclosureSection label="Light Moments" icon={DiceIcon}>
                {FEATURES.wouldYouRather && userId && circleId && (
                  <WouldYouRatherCard circleId={circleId} userId={userId} />
                )}
                {FEATURES.guessWho && userId && circleId && (
                  <GuessWhoCard circleId={circleId} userId={userId} />
                )}
              </DisclosureSection>
              <View style={styles.gamesHint}>
                <ConceptHint
                  id="light-moments"
                  text={
                    FEATURES.wouldYouRather
                      ? 'A daily moment of reflection.'
                      : 'A member posts a fact about themselves - guess who in your circle it is.'
                  }
                />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles({ colors, radii, shadow }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    page: { padding: spacing.lg },
    title: { ...type.title, fontFamily: fontFamily.bold, color: colors.textPrimary },
    titleHint: { marginBottom: spacing.md },
    sectionTitle: { ...type.heading, fontFamily: fontFamily.bold, color: colors.textPrimary, marginBottom: spacing.md },
    composer: {
      backgroundColor: colors.surface,
      borderRadius: radii.card,
      padding: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.lg,
      ...shadow,
    },
    composerInput: { minHeight: 52, color: colors.textPrimary, ...type.body, fontFamily: fontFamily.regular },
    goalChips: { gap: spacing.s6 },
    goalChip: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      minHeight: 44,
      justifyContent: 'center',
    },
    goalChipActive: { backgroundColor: colors.primary },
    goalChipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s6 },
    goalChipText: { ...type.secondary, fontFamily: fontFamily.semibold, color: colors.textSecondary },
    goalChipTextActive: { color: colors.onAccent },
    goalTagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s6 },
    goalTag: { ...type.caption, color: colors.primary, fontFamily: fontFamily.semibold },
    postButton: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.lg,
      minHeight: 48,
      justifyContent: 'center',
    },
    postButtonText: { ...type.secondary, color: colors.onAccent, fontFamily: fontFamily.bold },
    list: { gap: spacing.md },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.card,
      padding: spacing.lg,
      gap: spacing.sm,
      ...shadow,
    },
    questionRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
    question: { ...type.body, fontFamily: fontFamily.semibold, color: colors.textPrimary, flex: 1 },
    // Raw size on purpose: this renders the "⋯" glyph, not text. Its size is
    // the affordance's diameter rather than a step in the type hierarchy, so
    // it has no business following the type scale.
    optionsButton: { fontSize: 18, color: colors.textSecondary, fontFamily: fontFamily.bold, paddingHorizontal: spacing.xs },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
    meta: { ...type.caption, fontFamily: fontFamily.regular, color: colors.textSecondary },
    thread: { marginTop: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.inputBg, paddingTop: spacing.md },
    replyRow: { gap: spacing.s2 },
    replyAuthor: { ...type.caption, fontFamily: fontFamily.bold, color: colors.textPrimary },
    replyBody: { ...type.secondary, color: colors.textSecondary },
    replyInputRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    replyInput: {
      flex: 1,
      backgroundColor: colors.inputBg,
      borderRadius: radii.input,
      paddingHorizontal: spacing.s10,
      minHeight: 48,
      color: colors.textPrimary,
      ...type.caption, fontFamily: fontFamily.regular,
    },
    replySend: {
      backgroundColor: colors.primary,
      borderRadius: radii.input,
      paddingHorizontal: spacing.lg,
      minHeight: 48,
      justifyContent: 'center',
    },
    replySendText: { ...type.secondary, color: colors.onAccent, fontFamily: fontFamily.bold },
    empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xxl },
    gamesSection: { marginTop: spacing.xxl },
    // Sits under the collapsed DisclosureSection header (which owns a 16px
    // bottom margin), so pull the hint back up toward its label.
    gamesHint: { marginTop: -10, paddingHorizontal: spacing.lg },
  });
}
