import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '../state/useAuthStore';
import { useCreateGoal, useDeleteGoal, useGoals, useSetGoalSource, useUpdateGoal } from '../hooks/useGoals';
import { useLogGoalWithCelebration, type Celebration } from '../hooks/useLogGoalWithCelebration';
import { useHealthSync } from '../hooks/useHealthSync';
import { useHasWaterMark } from '../hooks/useStreakSaves';
import { useCircleDetail } from '../hooks/useCircles';
import { pickAndUploadCheckinPhoto } from '../lib/checkinPhotoUpload';
import { ProgressBar } from '../components/ProgressBar';
import { PillButton } from '../components/PillButton';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { MilestoneCardModal } from '../components/MilestoneCardModal';
import { ActionSheet } from '../components/ActionSheet';
import { GOAL_CATEGORY_OPTIONS } from '../components/InterestPicker';
import { GoalSuggestions } from '../components/GoalSuggestions';
import { GoalCardSkeleton } from '../components/Skeleton';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { useTabBarClearance } from '../hooks/useTabBarClearance';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, motion, spacing, type } from '../theme/colors';
import type { Goal, GoalCategory } from '../types/models';
import StreakIcon from '../../assets/icons/nudges/streak.svg';
import WaterIcon from '../../assets/icons/nudges/water.svg';
import CameraIcon from '../../assets/icons/feed/camera.svg';

function EditGoalModal({ goal, circleId, onClose }: { goal: Goal; circleId: string; onClose: () => void }) {
  const [title, setTitle] = useState(goal.title);
  const [target, setTarget] = useState(String(goal.target));
  const updateGoal = useUpdateGoal();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  async function handleSave() {
    const targetValue = Number(target);
    if (!title.trim() || !targetValue) return;
    await updateGoal.mutateAsync({ goalId: goal.id, circleId, title: title.trim(), target: targetValue });
    onClose();
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Edit goal</Text>
          <TextInput style={styles.modalInput} value={title} onChangeText={setTitle} placeholder="Goal title" />
          <TextInput
            style={styles.modalInput}
            value={target}
            onChangeText={setTarget}
            placeholder="Target"
            keyboardType="numeric"
          />
          <View style={styles.modalButtons}>
            <PillButton label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <PillButton
              label="Save"
              onPress={handleSave}
              loading={updateGoal.isPending}
              disabled={!title.trim() || !target}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function GoalCard({
  goal,
  circleId,
  userId,
  friendsCompletedToday,
}: {
  goal: Goal;
  circleId: string;
  userId: string;
  // How many *other* circle members logged anything today - shown next to
  // the owner's own progress so a goal reads as a shared effort, not a
  // private task-manager row.
  friendsCompletedToday: number;
}) {
  const { data: circle } = useCircleDetail(circleId);
  const { logGoal, isPending } = useLogGoalWithCelebration(circleId, userId, circle);
  const deleteGoal = useDeleteGoal();
  const setGoalSource = useSetGoalSource();
  const { isConnected } = useHealthSync(circleId);
  const { data: hasWaterMark } = useHasWaterMark(goal.id);
  const [editing, setEditing] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isComplete = goal.progress >= goal.target;
  const isHealthStepsGoal = goal.goal_source === 'health_steps';
  // The Goals tab lists the whole circle's goals, not just yours - the
  // collective signals below each card depend on that. But Edit and Delete
  // only ever worked on your own, and RLS rejected the rest by matching
  // zero rows, which reads to a user as the button being broken.
  const isMine = goal.user_id === userId;
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  async function handleLogProgress() {
    const celebration = await logGoal(goal);
    if (celebration) setCelebration(celebration);
  }

  // A separate, deliberate opt-in tap - never required, never nagged. The
  // normal "Log progress" button stays exactly as fast as before; this is
  // the only path that opens the picker first.
  async function handleLogWithPhoto() {
    const photoPath = await pickAndUploadCheckinPhoto(circleId, userId);
    if (!photoPath) return; // cancelled or permission denied - no log happens
    const celebration = await logGoal(goal, photoPath);
    if (celebration) setCelebration(celebration);
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{goal.title}</Text>
        <View style={styles.cardHeaderRight}>
          {goal.streak_count > 0 && (
            <View style={styles.streakRow}>
              <StreakIcon width={14} height={14} color={theme.colors.textSecondary} />
              <Text style={styles.streak}>{goal.streak_count}</Text>
              {hasWaterMark && <WaterIcon width={13} height={13} color={theme.colors.primary} />}
            </View>
          )}
          {isMine && (
            <AnimatedPressable
              onPress={() => setMenuOpen(true)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Options for ${goal.title}`}
            >
              <Text style={styles.optionsButton}>⋯</Text>
            </AnimatedPressable>
          )}
        </View>
      </View>
      <ProgressBar progress={goal.progress} target={goal.target} />
      {/* Shown whenever the goal IS a step goal, connected or not - the badge
          carries the only control that converts it back to manual, and
          goal_source is a database column while the connection is
          device-local. Hiding this when disconnected stranded the goal on
          every other device, on iOS, and after any Sync steps toggle-off:
          no log button, no undo, and a label claiming it was syncing. */}
      {isHealthStepsGoal && (
        <View style={styles.autoBadge}>
          <Text style={styles.autoBadgeText}>
            {isConnected ? 'Auto · Health Connect' : 'Auto-tracking paused'}
          </Text>
          <AnimatedPressable
            onPress={() =>
              setGoalSource.mutate({ goalId: goal.id, circleId, source: 'manual' })
            }
            accessibilityRole="button"
            accessibilityLabel="Stop tracking this goal from Health Connect"
            style={styles.autoBadgeUndo}
          >
            <Text style={styles.autoBadgeUndoText}>✕</Text>
          </AnimatedPressable>
        </View>
      )}
      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>
          {goal.progress} / {goal.target}
          {friendsCompletedToday > 0 &&
            ` · ${friendsCompletedToday} ${friendsCompletedToday === 1 ? 'friend' : 'friends'} completed today`}
        </Text>
        {isComplete ? (
          <View style={styles.doneRow}>
            {/* Celebration, not a control - the heart pops when a goal hits
                its target. "Completed" beside it carries the meaning. */}
            <ToggleSwitch value decorative />
            <Text style={styles.doneBadge}>Completed</Text>
          </View>
        ) : isHealthStepsGoal && isConnected ? (
          <Text style={styles.syncedLabel}>Synced from Health Connect</Text>
        ) : (
          <View style={styles.logActions}>
            <AnimatedPressable
              onPress={handleLogWithPhoto}
              disabled={isPending}
              hitSlop={13}
              accessibilityRole="button"
              accessibilityLabel="Log progress with a photo"
            >
              <CameraIcon width={18} height={18} color={theme.colors.primary} />
            </AnimatedPressable>
            <AnimatedPressable
      accessibilityRole="button" style={styles.logButton} onPress={handleLogProgress} disabled={isPending}>
              <Text style={styles.logButtonText}>Log progress</Text>
            </AnimatedPressable>
          </View>
        )}
      </View>
      {editing && <EditGoalModal goal={goal} circleId={circleId} onClose={() => setEditing(false)} />}
      {menuOpen && (
        <ActionSheet
          title={goal.title}
          options={[
            {
              label: 'Edit',
              onPress: () => {
                setMenuOpen(false);
                setEditing(true);
              },
            },
            {
              label: 'Delete',
              destructive: true,
              onPress: () => {
                setMenuOpen(false);
                setConfirmingDelete(true);
              },
            },
          ]}
          onCancel={() => setMenuOpen(false)}
        />
      )}
      {confirmingDelete && (
        <ActionSheet
          title="Delete this goal?"
          message="This cannot be undone."
          options={[
            {
              label: 'Delete',
              destructive: true,
              onPress: () => {
                setConfirmingDelete(false);
                deleteGoal.mutate(
                  { goalId: goal.id, circleId },
                  {
                    onError: (err) =>
                      Alert.alert(
                        'Could not delete this goal',
                        err instanceof Error ? err.message : 'Please try again.',
                      ),
                  },
                );
              },
            },
          ]}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
      {celebration && (
        <MilestoneCardModal
          title={celebration.title}
          subtitle={celebration.subtitle}
          circleName={circle?.name}
          shareMessage={celebration.shareMessage}
          shareLabel={celebration.shareMessage ? 'Invite friends' : undefined}
          onClose={() => setCelebration(null)}
        />
      )}
    </View>
  );
}

function AddGoalForm({ circleId, userId }: { circleId: string; userId: string }) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [category, setCategory] = useState<GoalCategory | null>(null);
  const createGoal = useCreateGoal();
  const theme = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  // TouchableOpacity does not dim itself when disabled, so without an
  // explicit style the button looked tappable and silently did nothing until
  // both fields were filled.
  const canAdd = !createGoal.isPending && !!title.trim() && !!Number(target);

  async function handleAdd() {
    const targetValue = Number(target);
    if (!title.trim() || !targetValue) return;
    await createGoal.mutateAsync({
      circleId,
      userId,
      title: title.trim(),
      target: targetValue,
      category,
    });
    setTitle('');
    setTarget('');
    setCategory(null);
  }

  return (
    <View style={styles.addGoalWrap}>
      {/* Stacked, not a single row. Side by side, the narrow Target field
          read as a white pill button next to the coloured Add one, so the
          row looked like two unlabelled buttons and nobody could tell which
          was which. Labels above each field, and a full-width button that
          says what it does. */}
      <View style={styles.form}>
        <Text style={styles.fieldLabel}>Goal</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Drink 4L water"
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={setTitle}
        />
        <Text style={styles.fieldLabel}>Target</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 4"
          placeholderTextColor={colors.textSecondary}
          keyboardType="numeric"
          value={target}
          onChangeText={setTarget}
        />
        <AnimatedPressable
          style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
          onPress={handleAdd}
          disabled={!canAdd}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAdd }}
          accessibilityLabel="Add goal"
        >
          <Text style={[styles.addButtonText, !canAdd && styles.addButtonTextDisabled]}>
            {createGoal.isPending ? 'Adding…' : 'Add goal'}
          </Text>
        </AnimatedPressable>
      </View>
      {/* One-accent rule: resting chips are neutral with monochrome icons;
          only the selected chip takes the user's accent. */}
      <View style={styles.categoryRow}>
        {GOAL_CATEGORY_OPTIONS.map(({ key, label, Icon }) => {
          const active = category === key;
          return (
            <AnimatedPressable
              key={key}
              style={[styles.categoryChip, { backgroundColor: active ? colors.primary : colors.surfaceSubtle }]}
              onPress={() => setCategory(active ? null : key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={label}
            >
              <Icon size={15} color={active ? colors.onAccent : colors.textSecondary} />
              <Text style={[styles.categoryChipLabel, { color: active ? colors.onAccent : colors.textPrimary }]}>{label}</Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}

export default function GoalsScreen() {
  const userId = useAuthStore((state) => state.user?.id);
  const circleId = useAuthStore((state) => state.activeCircleId);
  const { data: goals, isLoading, isFetching, refetch } = useGoals(circleId ?? undefined);
  const tabBarClearance = useTabBarClearance();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Everyone who logged anything today, so each goal row can carry a
  // collective signal ("· 3 friends completed today") alongside the owner's
  // own progress. useGoals already returns the whole circle's goals.
  const today = new Date().toISOString().slice(0, 10);
  const loggedTodayUserIds = useMemo(
    () => new Set((goals ?? []).filter((g) => g.last_logged_date === today).map((g) => g.user_id)),
    [goals, today],
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Goals</Text>

      {userId && circleId && <GoalSuggestions circleId={circleId} userId={userId} />}

      {userId && circleId && <AddGoalForm circleId={circleId} userId={userId} />}

      {isLoading ? (
        <View style={{ marginTop: spacing.xs }}>
          <GoalCardSkeleton />
          <GoalCardSkeleton />
          <GoalCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={goals ?? []}
          keyExtractor={(goal) => goal.id}
          renderItem={({ item, index }) =>
            userId && circleId ? (
              <Animated.View
          entering={FadeInDown.duration(motion.duration.entrance).delay(
            Math.min(index, motion.stagger.maxItems) * motion.stagger.step,
          )}
        >
                <GoalCard
                  goal={item}
                  circleId={circleId}
                  userId={userId}
                  friendsCompletedToday={loggedTodayUserIds.size - (loggedTodayUserIds.has(item.user_id) ? 1 : 0)}
                />
              </Animated.View>
            ) : null
          }
          contentContainerStyle={[styles.list, { paddingBottom: tabBarClearance }]}
          ListEmptyComponent={<Text style={styles.empty}>No goals yet — add your first one above.</Text>}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={theme.colors.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}

function createStyles({ colors, radii, cardShell }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
    title: { ...type.title, color: colors.textPrimary, marginBottom: spacing.md },
    addGoalWrap: { marginBottom: spacing.lg, gap: spacing.md },
    form: { gap: 6 },
    fieldLabel: { ...type.secondary, fontFamily: fontFamily.semibold, color: colors.textSecondary, marginTop: spacing.xs },
    categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 48,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    categoryChipLabel: { ...type.secondary, fontFamily: fontFamily.semibold },
    input: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.input,
      paddingHorizontal: spacing.md,
      minHeight: 52,
      color: colors.textPrimary,
    },
    addButton: {
      backgroundColor: colors.primary,
      borderRadius: radii.input,
      paddingHorizontal: spacing.lg,
      minHeight: 52,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 6,
    },
    // surfaceSubtle rather than a dimmed accent: the one-accent rule reserves
    // colors.primary for things you can actually act on, and a faded accent
    // still reads as the primary action.
    addButtonDisabled: { backgroundColor: colors.surfaceSubtle },
    addButtonText: { ...type.body, color: colors.onAccent, fontFamily: fontFamily.bold },
    addButtonTextDisabled: { color: colors.textSecondary },
    list: { gap: spacing.md },
    card: {
      ...cardShell,
      padding: spacing.lg,
      gap: 10,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    // The goal title is the object this whole card is about - it reads as the
    // card's heading, not as body text alongside the meta row.
    cardTitle: { ...type.subheading, color: colors.textPrimary, flex: 1 },
    streakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    streak: { ...type.secondary, fontFamily: fontFamily.semibold, color: colors.textPrimary },
    // Raw size on purpose: this renders the "⋯" glyph, not text. Its size is
    // the affordance's diameter rather than a step in the type hierarchy, so
    // it has no business following the type scale.
    optionsButton: { fontSize: 18, color: colors.textSecondary, fontFamily: fontFamily.bold, paddingHorizontal: spacing.xs },
    autoBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      marginTop: spacing.sm,
      paddingLeft: 10,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceSubtle,
    },
    autoBadgeText: { ...type.caption, fontFamily: fontFamily.semibold, color: colors.textSecondary },
    autoBadgeUndo: { minHeight: 48, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
    // Raw size on purpose: a bare glyph, sized to its control rather than
    // to the type hierarchy - the token would also impose a lineHeight it
    // has never had, shifting it off-centre in a tight container.
    autoBadgeUndoText: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.textSecondary },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    // Progress and the social line are secondary body, not captions - they're
    // read, not glanced at.
    cardMeta: { ...type.secondary, color: colors.textSecondary },
    doneRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    doneBadge: { ...type.secondary, fontFamily: fontFamily.bold, color: colors.success },
    syncedLabel: { ...type.secondary, fontFamily: fontFamily.semibold, color: colors.textSecondary },
    logActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    logButton: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.lg,
      minHeight: 48,
      justifyContent: 'center',
    },
    // Matches PillButton's label size - a button is a button wherever it is.
    logButtonText: { ...type.body, fontFamily: fontFamily.bold, color: colors.primaryPressed },
    empty: { ...type.secondary, textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xxl },
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
      gap: spacing.md,
    },
    modalTitle: { ...type.subheading, fontFamily: fontFamily.bold, color: colors.textPrimary },
    modalInput: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.input,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      color: colors.textPrimary,
      ...type.body, fontFamily: fontFamily.regular,
    },
    modalButtons: { flexDirection: 'row', gap: 10, marginTop: spacing.xs },
  });
}
