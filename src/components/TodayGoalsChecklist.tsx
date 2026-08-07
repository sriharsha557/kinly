import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutRight, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { useGoals } from '../hooks/useGoals';
import { useCheckIn, useGoalCheckins } from '../hooks/useCheckins';
import { useLogGoalWithCelebration, type Celebration } from '../hooks/useLogGoalWithCelebration';
import { MilestoneCardModal } from './MilestoneCardModal';
import { useCircleDetail, useCircleMembers } from '../hooks/useCircles';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, motion, spacing, type } from '../theme/colors';
import { describeCadence } from '../lib/cadence';
import { errorMessage } from '../lib/errorMessage';
import { toIsoDate } from '../lib/periods';
import type { Goal } from '../types/models';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Frames each pending action socially instead of as a bare to-do: "your
// friends already showed up" is the motivator, not the unchecked box.
function collectiveContext(friendsDoneToday: number, friendCount: number): string | null {
  if (friendCount === 0) return null;
  if (friendsDoneToday === 0) return 'Be the first in your circle today';
  return `${friendsDoneToday} of ${friendCount} friends already did`;
}

// A row is checked off in two beats: justChecked flips the checkbox to a
// filled checkmark immediately, then checkedIds (which actually removes it
// from the list) is delayed so the checkmark is visible before the row exits.
const CHECKED_VISIBLE_MS = 550;

export function TodayGoalsChecklist({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: goals, isLoading } = useGoals(circleId);
  const { data: circle } = useCircleDetail(circleId);
  const { data: members } = useCircleMembers(circleId);
  const { data: checkinsByGoal } = useGoalCheckins(circleId);
  const { logGoal, isPending } = useLogGoalWithCelebration(circleId, userId, circle);
  const checkIn = useCheckIn();
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [justChecked, setJustChecked] = useState<Set<string>>(new Set());
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const today = todayIso();
  const todayForCheckin = toIsoDate(new Date());
  const myGoals = (goals ?? []).filter((g) => g.user_id === userId);
  // Every goal this component can meaningfully call "pending" - all but the
  // auto-tracked health_steps goal, whose own sync (not a tap here) decides
  // whether today counts. Cadence goals (target == null, migration 0049)
  // belong here too: their commitment lives in the check-in ledger rather
  // than a numeric target, but that ledger is exactly what pending below
  // reads for them. Scoping the "Everything logged" congratulation to
  // trackable rather than myGoals as a whole keeps a member with only a
  // health_steps goal from seeing "Nice work" for nothing this component
  // can vouch for.
  const trackable = myGoals.filter((g) => g.goal_source !== 'health_steps');
  const pending = trackable.filter((g) => {
    if (checkedIds.has(g.id)) return false;
    if (g.target != null) {
      // Legacy goals still carry a numeric target and fill a progress bar.
      return g.progress < g.target && g.last_logged_date !== today;
    }
    // No target - this is a cadence commitment, so "done today" means a
    // check-in dated today, not a progress comparison.
    return !(checkinsByGoal?.[g.id] ?? []).includes(todayForCheckin);
  });

  // Collective context for the mission rows: how many of the others in this
  // circle have logged anything today. useGoals returns the whole circle's
  // goals, so this needs no extra fetch.
  const friendIds = new Set((members ?? []).filter((m) => m.user_id !== userId && m.status === 'active').map((m) => m.user_id));
  // Either kind of "done today" counts: a check-in for a cadence
  // commitment, or last_logged_date for a legacy numeric goal. Reading only
  // the column showed nobody active the moment a circle moved to cadences,
  // and this line exists to make a goal read as a shared effort - a zero
  // here quietly turns it back into a private task list.
  const friendsDoneToday = new Set(
    (goals ?? [])
      .filter(
        (g) =>
          friendIds.has(g.user_id) &&
          (g.last_logged_date === today ||
            (checkinsByGoal?.[g.id] ?? []).includes(todayForCheckin)),
      )
      .map((g) => g.user_id),
  ).size;
  const context = collectiveContext(friendsDoneToday, friendIds.size);

  // "X of Y completed" for today's mission - what's already logged today
  // plus what's still waiting.
  const doneToday = myGoals.filter(
    (g) =>
      g.last_logged_date === today ||
      (checkinsByGoal?.[g.id] ?? []).includes(todayForCheckin) ||
      checkedIds.has(g.id),
  ).length;
  const missionTotal = doneToday + pending.length;

  function markChecked(goalId: string) {
    setJustChecked((prev) => new Set(prev).add(goalId));
    setTimeout(() => {
      setCheckedIds((prev) => new Set(prev).add(goalId));
    }, CHECKED_VISIBLE_MS);
  }

  async function handleLogNumeric(goal: Goal) {
    setLoggingId(goal.id);
    try {
      const result = await logGoal(goal);
      markChecked(goal.id);
      if (result) setCelebration(result);
    } finally {
      setLoggingId(null);
    }
  }

  // Cadence commitments (no numeric target) are recorded by a check-in, not
  // by logGoal - logGoal writes progress against a target that does not
  // exist for these. A silent failure here is the worst case in the app:
  // this component's whole job is to say what is still outstanding, so a
  // tap that quietly does nothing leaves that claim wrong.
  function handleCheckIn(goal: Goal) {
    setLoggingId(goal.id);
    checkIn.mutate(
      { goalId: goal.id, circleId, userId },
      {
        onSuccess: () => markChecked(goal.id),
        onError: (err) => Alert.alert('Could not check in', errorMessage(err, 'Please try again.')),
        onSettled: () => setLoggingId(null),
      },
    );
  }

  function handleTap(goal: Goal) {
    if (goal.target != null) {
      void handleLogNumeric(goal);
    } else {
      handleCheckIn(goal);
    }
  }

  if (isLoading) return null;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{"Today's Mission"}</Text>
        {missionTotal > 0 && (
          <Text style={styles.progressCount}>
            {doneToday} of {missionTotal} completed
          </Text>
        )}
      </View>

      {myGoals.length === 0 ? (
        <Text style={styles.empty}>Your journey starts today — add your first goal to get going.</Text>
      ) : trackable.length === 0 ? (
        // Every one of this member's goals is the auto-tracked health_steps
        // goal, whose sync (not a tap here) decides whether today counts.
        // Rendering nothing is the honest choice - claiming "Everything
        // logged" would be true of an empty set, not of anything the member
        // did today.
        null
      ) : pending.length === 0 ? (
        <Animated.Text entering={ZoomIn.springify().damping(motion.damping.pop)} style={styles.done}>
          ✓ Everything logged for today. Nice work.
        </Animated.Text>
      ) : (
        <View style={styles.list}>
          {pending.map((goal, index) => {
            const checked = justChecked.has(goal.id);
            const loadingThis = loggingId === goal.id && (isPending || checkIn.isPending);
            return (
              <Animated.View
                key={goal.id}
                entering={FadeInDown.duration(motion.duration.entrance).delay(index * motion.stagger.step)}
                exiting={FadeOutRight.duration(motion.duration.quick)}
                layout={LinearTransition.springify()}
              >
                <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`Log “${goal.title}”`}
                  style={styles.row}
                  onPress={() => handleTap(goal)}
                  disabled={checked || loadingThis}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked ? (
                      <Animated.Text
                        entering={ZoomIn.springify().damping(motion.damping.celebrate)}
                        style={styles.checkmark}
                      >
                        ✓
                      </Animated.Text>
                    ) : (
                      loadingThis && <Text style={styles.checkboxLoading}>…</Text>
                    )}
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowText, checked && styles.rowTextChecked]}>Log “{goal.title}”</Text>
                    <Text style={styles.rowCadence}>{describeCadence(goal)}</Text>
                    {context && !checked && <Text style={styles.rowContext}>{context}</Text>}
                  </View>
                </AnimatedPressable>
              </Animated.View>
            );
          })}
        </View>
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

function createStyles({ colors, radii, shadow }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.card,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      gap: spacing.s10,
      ...shadow,
    },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { ...type.subheading, fontFamily: fontFamily.bold, color: colors.textPrimary },
    progressCount: { ...type.caption, fontFamily: fontFamily.bold, color: colors.primary },
    empty: { ...type.secondary, color: colors.textSecondary },
    done: { ...type.secondary, fontFamily: fontFamily.semibold, color: colors.success },
    list: { gap: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
    checkbox: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: colors.success, borderColor: colors.success },
    checkmark: { color: colors.onAccent, ...type.caption, fontFamily: fontFamily.bold },
    // Raw size on purpose: a bare glyph, sized to its control rather than
    // to the type hierarchy - the token would also impose a lineHeight it
    // has never had, shifting it off-centre in a tight container.
    checkboxLoading: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.primary },
    rowBody: { flex: 1, gap: spacing.s2 },
    rowText: { ...type.body, fontFamily: fontFamily.regular, color: colors.textPrimary },
    rowTextChecked: { opacity: 0.5, textDecorationLine: 'line-through' },
    rowCadence: { ...type.caption, fontFamily: fontFamily.regular, color: colors.textSecondary },
    rowContext: { ...type.caption, fontFamily: fontFamily.regular, color: colors.textSecondary },
  });
}
