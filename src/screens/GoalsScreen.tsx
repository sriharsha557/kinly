import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '../state/useAuthStore';
import { useCreateGoal, useEndGoal, useGoals, useSetGoalSource, useUpdateGoal } from '../hooks/useGoals';
import { useLogGoalWithCelebration, type Celebration } from '../hooks/useLogGoalWithCelebration';
import { useHealthSync } from '../hooks/useHealthSync';
import { useHasWaterMark } from '../hooks/useStreakSaves';
import { useCircleDetail } from '../hooks/useCircles';
import { pickAndUploadCheckinPhoto } from '../lib/checkinPhotoUpload';
import { PillButton } from '../components/PillButton';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { MilestoneCardModal } from '../components/MilestoneCardModal';
import { ActionSheet } from '../components/ActionSheet';
import { GoalSuggestions } from '../components/GoalSuggestions';
import { GoalCardSkeleton } from '../components/Skeleton';
import { AreaPicker } from '../components/AreaPicker';
import { CadencePicker } from '../components/CadencePicker';
import { GoalCadenceRow } from '../components/GoalCadenceRow';
import { useGoalCheckins, useCheckIn, useUndoCheckIn } from '../hooks/useCheckins';
import { useCircleAreas } from '../hooks/useAreas';
import { validateCadence, type CadenceDraft } from '../lib/cadence';
import { streak } from '../lib/showingUp';
import { toIsoDate } from '../lib/periods';
import { errorMessage } from '../lib/errorMessage';
import { useTabBarClearance } from '../hooks/useTabBarClearance';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, motion, spacing, type } from '../theme/colors';
import type { EndedReason, Goal } from '../types/models';
import WaterIcon from '../../assets/icons/nudges/water.svg';
import CameraIcon from '../../assets/icons/feed/camera.svg';

function EditGoalModal({ goal, circleId, onClose }: { goal: Goal; circleId: string; onClose: () => void }) {
  const [title, setTitle] = useState(goal.title);
  const [cadence, setCadence] = useState<CadenceDraft>({
    target_type: goal.target_type,
    target_count: goal.target_count,
    target_weekdays: goal.target_weekdays,
  });
  const [error, setError] = useState<string | null>(null);
  const updateGoal = useUpdateGoal();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  async function handleSave() {
    setError(null);
    if (!title.trim()) return;
    const cadenceError = validateCadence(cadence);
    if (cadenceError) {
      setError(cadenceError);
      return;
    }
    try {
      await updateGoal.mutateAsync({ goalId: goal.id, circleId, title: title.trim(), cadence });
      onClose();
    } catch (err) {
      // Was an unhandled rejection: mutateAsync throws on failure and
      // nothing here caught it, so a failed update silently left the modal
      // open with no feedback at all. errorMessage covers supabase-js's
      // plain-object error shape, not just Error instances.
      setError(errorMessage(err, 'Could not save that goal.'));
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* The cadence row grew to a type chip row plus up to 7 weekday
              chips - tall enough on a small device to push the Save button
              off-screen with no way to reach it. maxHeight caps the card at
              a fraction of the viewport; ScrollView lets the content that
              no longer fits still be reached. */}
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <Text style={styles.modalTitle}>Edit goal</Text>
            <TextInput style={styles.modalInput} value={title} onChangeText={setTitle} placeholder="Goal title" />
            <CadencePicker value={cadence} onChange={setCadence} />
            {error && <Text style={styles.formError}>{error}</Text>}
          </ScrollView>
          <View style={styles.modalButtons}>
            <PillButton label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <PillButton
              label="Save"
              onPress={handleSave}
              loading={updateGoal.isPending}
              disabled={!title.trim()}
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
  checkinsByGoal,
}: {
  goal: Goal;
  circleId: string;
  userId: string;
  // How many *other* circle members logged anything today - shown next to
  // the owner's own progress so a goal reads as a shared effort, not a
  // private task-manager row.
  friendsCompletedToday: number;
  checkinsByGoal: Record<string, string[]>;
}) {
  const { data: circle } = useCircleDetail(circleId);
  const { logGoal, isPending } = useLogGoalWithCelebration(circleId, userId, circle);
  const setGoalSource = useSetGoalSource();
  const endGoal = useEndGoal();
  const checkIn = useCheckIn();
  const undoCheckIn = useUndoCheckIn();
  const { isConnected } = useHealthSync(circleId);
  const { data: hasWaterMark } = useHasWaterMark(goal.id);
  const [editing, setEditing] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const cadence = {
    target_type: goal.target_type,
    target_count: goal.target_count,
    target_weekdays: goal.target_weekdays,
  };
  const myCheckins = checkinsByGoal[goal.id] ?? [];
  const today = toIsoDate(new Date());
  const checkedInToday = myCheckins.includes(today);
  // Deliberately not computing showing-up here. On a personal card the
  // streak and the consistency figure already carry the story, and the
  // button says whether today is done. Showing-up is the cadence-aware
  // rollup primitive - "is this person honoring their own commitment" -
  // which earns its place on the circle summary and the Area grid, where
  // one number stands in for several people. Rendering it here too would
  // just be a fourth way of saying the same thing to an audience of one.
  const isHealthStepsGoal = goal.goal_source === 'health_steps';
  // The Goals tab lists the whole circle's goals, not just yours - the
  // collective signals below each card depend on that. But Edit and Delete
  // only ever worked on your own, and RLS rejected the rest by matching
  // zero rows, which reads to a user as the button being broken.
  const isMine = goal.user_id === userId;
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // A separate, deliberate opt-in tap - never required, never nagged. The
  // normal "Log progress" button stays exactly as fast as before; this is
  // the only path that opens the picker first.
  async function handleLogWithPhoto() {
    const photoPath = await pickAndUploadCheckinPhoto(circleId, userId);
    if (!photoPath) return; // cancelled or permission denied - no log happens
    const celebration = await logGoal(goal, photoPath);
    if (celebration) setCelebration(celebration);
  }

  // A cadence goal is open-ended and has no finish line, so ending it offers
  // two distinct endings rather than one Delete. Without "I've finished
  // this" nothing in the model could ever produce ended_reason ='completed',
  // and someone who genuinely completed a commitment would have to record it
  // as a deletion. Deleting is not a failure either - choosing not to
  // participate in an Area for now is a valid resting state.
  function endWith(reason: EndedReason) {
    setMenuOpen(false);
    endGoal.mutate(
      {
        goal,
        circleId,
        reason,
        bestStreak: streak(cadence, myCheckins, Date.now()),
        hadCheckins: myCheckins.length > 0,
      },
      {
        onError: (err) => Alert.alert('Could not end this goal', errorMessage(err, 'Please try again.')),
      },
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{goal.title}</Text>
        <View style={styles.cardHeaderRight}>
          {/* GoalCadenceRow below is the one place a streak is stated now -
              goal.streak_count used to render a second, disagreeing number
              right beside it. The water mark itself is unrelated to that
              dead column, so it keeps rendering on its own. */}
          {hasWaterMark && <WaterIcon width={13} height={13} color={theme.colors.primary} />}
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
      <GoalCadenceRow cadence={cadence} checkins={myCheckins} now={Date.now()} />
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
          {friendsCompletedToday > 0 &&
            `${friendsCompletedToday} ${friendsCompletedToday === 1 ? 'friend' : 'friends'} completed today`}
        </Text>
        {isHealthStepsGoal && isConnected ? (
          <Text style={styles.syncedLabel}>Synced from Health Connect</Text>
        ) : (
          <View style={styles.logActions}>
            {/* The camera icon writes progress/streak_count/last_logged_date
                through log_goal_progress, which does `least(progress + n,
                target)` in Postgres. least(NULL, x) returns x, so on a
                cadence goal (target == null) progress would climb unbounded
                right next to a check-in-ledger streak badge for the same
                goal - two disagreeing streak numbers on one card. Only
                goals that still carry a numeric target (legacy and
                health_steps) get this control; a cadence commitment is
                recorded by a check-in only. */}
            {goal.target != null && (
              <AnimatedPressable
                onPress={handleLogWithPhoto}
                disabled={isPending}
                hitSlop={13}
                accessibilityRole="button"
                accessibilityLabel="Log progress with a photo"
              >
                <CameraIcon width={18} height={18} color={theme.colors.primary} />
              </AnimatedPressable>
            )}
            {/* The insert policy on goal_checkins requires user_id =
                auth.uid(), so tapping this on a friend's card can only ever
                fail with 42501 - and checkinsByGoal[goal.id] on their card is
                THEIR ledger, so it can even read "Done today" for something
                the viewer never did. Someone else's card still shows their
                cadence/streak/consistency (the point of a shared circle);
                it just doesn't offer an action that cannot succeed. */}
            {isMine && (
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityLabel={checkedInToday ? 'Undo today’s check-in' : 'Check in'}
                style={styles.logButton}
                disabled={checkIn.isPending || undoCheckIn.isPending}
                onPress={() =>
                  checkedInToday
                    ? undoCheckIn.mutate(
                        { goalId: goal.id, circleId, date: today },
                        { onError: (err) => Alert.alert('Could not undo check-in', errorMessage(err, 'Please try again.')) },
                      )
                    : checkIn.mutate(
                        { goalId: goal.id, circleId, userId },
                        { onError: (err) => Alert.alert('Could not check in', errorMessage(err, 'Please try again.')) },
                      )
                }
              >
                <Text style={styles.logButtonText}>{checkedInToday ? 'Done today' : 'Check in'}</Text>
              </AnimatedPressable>
            )}
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
            // Not destructive, no confirmation needed - see the comment on
            // endWith above.
            { label: "I've finished this", onPress: () => endWith('completed') },
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
        // A second ActionSheet, not Alert.alert: Alert.alert on Android
        // silently keeps only buttons.slice(0, 3) and hardcodes
        // cancelable: false, which is exactly wrong for a confirm/cancel
        // pair the user must be able to dismiss. Delete is irreversible
        // (it archives the goal and writes ended_reason='deleted'), so it
        // gets the confirm step that "I've finished this" deliberately
        // skips.
        <ActionSheet
          title={`Delete "${goal.title}"?`}
          message="This can't be undone."
          options={[
            {
              label: 'Delete',
              destructive: true,
              onPress: () => {
                setConfirmingDelete(false);
                endWith('deleted');
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
  const [areaId, setAreaId] = useState<string | null>(null);
  const [cadence, setCadence] = useState<CadenceDraft>({
    target_type: 'daily',
    target_count: null,
    target_weekdays: null,
  });
  const [error, setError] = useState<string | null>(null);
  const { data: areas } = useCircleAreas(circleId);
  const createGoal = useCreateGoal();
  const theme = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  // No numeric target to check any more. A cadence is always set (it starts
  // at daily), so what is actually required is a title and an Area.
  const canAdd = !createGoal.isPending && !!title.trim() && !!areaId;

  async function handleAdd() {
    setError(null);
    if (!title.trim() || !areaId) return;

    const cadenceError = validateCadence(cadence);
    if (cadenceError) {
      setError(cadenceError);
      return;
    }

    try {
      await createGoal.mutateAsync({ circleId, userId, areaId, title: title.trim(), cadence });
      setTitle('');
      setAreaId(null);
      setCadence({ target_type: 'daily', target_count: null, target_weekdays: null });
    } catch (err) {
      // useCreateGoal turns the one-active-goal-per-Area constraint into
      // readable copy; anything else surfaces its own message rather than a
      // silent failure. errorMessage covers the raw-object case too - a
      // database error like the 23502 not-null violation isn't an Error
      // instance, so `err instanceof Error` alone would hide it behind this
      // generic fallback.
      setError(errorMessage(err, 'Could not add that goal.'));
    }
  }

  return (
    <View style={styles.addGoalWrap}>
      <View style={styles.form}>
        <Text style={styles.fieldLabel}>Goal</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Walk 10,000 steps"
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.fieldLabel}>Area</Text>
        <AreaPicker areas={areas ?? []} selectedId={areaId} onSelect={setAreaId} />

        <CadencePicker value={cadence} onChange={setCadence} />

        {error && <Text style={styles.formError}>{error}</Text>}

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
    </View>
  );
}

export default function GoalsScreen() {
  const userId = useAuthStore((state) => state.user?.id);
  const circleId = useAuthStore((state) => state.activeCircleId);
  const { data: goals, isLoading, isFetching, refetch } = useGoals(circleId ?? undefined);
  const { data: checkinsByGoal = {} } = useGoalCheckins(circleId ?? undefined);
  const tabBarClearance = useTabBarClearance();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Everyone who checked in today, so each goal row can carry a collective
  // signal ("· 3 friends completed today") alongside the owner's own
  // progress - a goal reads as a shared effort, not a private
  // task-manager row. Built from the check-in ledger, keyed back to the
  // goal's owner, since checkinsByGoal carries no user_id of its own.
  const today = new Date().toISOString().slice(0, 10);
  const goalOwnerById = useMemo(() => {
    const byId = new Map<string, string>();
    for (const g of goals ?? []) byId.set(g.id, g.user_id);
    return byId;
  }, [goals]);
  const checkedInTodayUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [goalId, dates] of Object.entries(checkinsByGoal)) {
      if (!dates.includes(today)) continue;
      const ownerId = goalOwnerById.get(goalId);
      if (ownerId) ids.add(ownerId);
    }
    return ids;
  }, [checkinsByGoal, goalOwnerById, today]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Goals</Text>

      {isLoading ? (
        <View style={{ marginTop: spacing.xs }}>
          {userId && circleId && <GoalSuggestions circleId={circleId} userId={userId} />}
          {userId && circleId && <AddGoalForm circleId={circleId} userId={userId} />}
          <GoalCardSkeleton />
          <GoalCardSkeleton />
          <GoalCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={goals ?? []}
          keyExtractor={(goal) => goal.id}
          // AddGoalForm grew to ~200dp taller (up to 8 Area chips plus a
          // cadence row plus a 7-chip weekday row) and used to sit in a
          // fixed region above this list, outside any scroll container -
          // on a small device that pushed its own submit button off-screen
          // with no way to reach it. Routing it through the list's header
          // instead of a sibling View means it scrolls with everything
          // else for free.
          ListHeaderComponent={
            userId && circleId ? (
              <>
                <GoalSuggestions circleId={circleId} userId={userId} />
                <AddGoalForm circleId={circleId} userId={userId} />
              </>
            ) : null
          }
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
                  friendsCompletedToday={checkedInTodayUserIds.size - (checkedInTodayUserIds.has(item.user_id) ? 1 : 0)}
                  checkinsByGoal={checkinsByGoal}
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
    form: { gap: spacing.s6 },
    fieldLabel: { ...type.secondary, fontFamily: fontFamily.semibold, color: colors.textSecondary, marginTop: spacing.xs },
    formError: { ...type.caption, fontFamily: fontFamily.semibold, color: colors.danger },
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
      marginTop: spacing.s6,
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
      gap: spacing.s10,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.s10 },
    // The goal title is the object this whole card is about - it reads as the
    // card's heading, not as body text alongside the meta row.
    cardTitle: { ...type.subheading, color: colors.textPrimary, flex: 1 },
    // Raw size on purpose: this renders the "⋯" glyph, not text. Its size is
    // the affordance's diameter rather than a step in the type hierarchy, so
    // it has no business following the type scale.
    optionsButton: { fontSize: 18, color: colors.textSecondary, fontFamily: fontFamily.bold, paddingHorizontal: spacing.xs },
    autoBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.s6,
      marginTop: spacing.sm,
      paddingLeft: spacing.s10,
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
    syncedLabel: { ...type.secondary, fontFamily: fontFamily.semibold, color: colors.textSecondary },
    logActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.s10 },
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
      // Edit goal's cadence row can run to a type chip row plus up to 7
      // weekday chips - capped so the card can never exceed the screen;
      // the ScrollView inside it is what makes the excess reachable rather
      // than clipped.
      maxHeight: '80%',
    },
    modalScrollContent: { gap: spacing.md },
    modalTitle: { ...type.subheading, fontFamily: fontFamily.bold, color: colors.textPrimary },
    modalInput: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.input,
      paddingHorizontal: spacing.s14,
      paddingVertical: spacing.md,
      color: colors.textPrimary,
      ...type.body, fontFamily: fontFamily.regular,
    },
    modalButtons: { flexDirection: 'row', gap: spacing.s10, marginTop: spacing.xs },
  });
}
