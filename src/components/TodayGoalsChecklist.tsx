import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutRight, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { useGoals } from '../hooks/useGoals';
import { useLogGoalWithCelebration, type Celebration } from '../hooks/useLogGoalWithCelebration';
import { MilestoneCardModal } from './MilestoneCardModal';
import { useCircleDetail, useCircleMembers } from '../hooks/useCircles';
import { useTheme } from '../theme/ThemeProvider';
import { motion } from '../theme/colors';

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
  const { logGoal, isPending } = useLogGoalWithCelebration(circleId, userId, circle);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [justChecked, setJustChecked] = useState<Set<string>>(new Set());
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const today = todayIso();
  const myGoals = (goals ?? []).filter((g) => g.user_id === userId);
  const pending = myGoals.filter(
    (g) =>
      g.goal_source !== 'health_steps' &&
      g.progress < g.target &&
      g.last_logged_date !== today &&
      !checkedIds.has(g.id),
  );

  // Collective context for the mission rows: how many of the others in this
  // circle have logged anything today. useGoals returns the whole circle's
  // goals, so this needs no extra fetch.
  const friendIds = new Set((members ?? []).filter((m) => m.user_id !== userId && m.status === 'active').map((m) => m.user_id));
  const friendsDoneToday = new Set(
    (goals ?? []).filter((g) => friendIds.has(g.user_id) && g.last_logged_date === today).map((g) => g.user_id),
  ).size;
  const context = collectiveContext(friendsDoneToday, friendIds.size);

  // "X of Y completed" for today's mission - what's already logged today
  // plus what's still waiting.
  const doneToday = myGoals.filter((g) => g.last_logged_date === today || checkedIds.has(g.id)).length;
  const missionTotal = doneToday + pending.length;

  async function handleLog(goalId: string) {
    const goal = myGoals.find((g) => g.id === goalId);
    if (!goal) return;
    setLoggingId(goalId);
    try {
      const result = await logGoal(goal);
      setJustChecked((prev) => new Set(prev).add(goalId));
      setTimeout(() => {
        setCheckedIds((prev) => new Set(prev).add(goalId));
      }, CHECKED_VISIBLE_MS);
      if (result) setCelebration(result);
    } finally {
      setLoggingId(null);
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
      ) : pending.length === 0 ? (
        <Animated.Text entering={ZoomIn.springify().damping(motion.damping.pop)} style={styles.done}>
          ✓ Everything logged for today. Nice work.
        </Animated.Text>
      ) : (
        <View style={styles.list}>
          {pending.map((goal, index) => {
            const checked = justChecked.has(goal.id);
            return (
              <Animated.View
                key={goal.id}
                entering={FadeInDown.duration(motion.duration.entrance).delay(index * motion.stagger.step)}
                exiting={FadeOutRight.duration(motion.duration.quick)}
                layout={LinearTransition.springify()}
              >
                <AnimatedPressable
                  style={styles.row}
                  onPress={() => handleLog(goal.id)}
                  disabled={checked || (isPending && loggingId === goal.id)}
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
                      isPending && loggingId === goal.id && <Text style={styles.checkboxLoading}>…</Text>
                    )}
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowText, checked && styles.rowTextChecked]}>Log “{goal.title}”</Text>
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
      padding: 16,
      marginBottom: 16,
      gap: 10,
      ...shadow,
    },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
    progressCount: { fontSize: 13, fontWeight: '700', color: colors.primary },
    empty: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    done: { fontSize: 14, fontWeight: '600', color: colors.success },
    list: { gap: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
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
    checkmark: { color: colors.onAccent, fontSize: 13, fontWeight: '800' },
    checkboxLoading: { fontSize: 12, color: colors.primary },
    rowBody: { flex: 1, gap: 1 },
    rowText: { fontSize: 16, color: colors.textPrimary },
    rowTextChecked: { opacity: 0.5, textDecorationLine: 'line-through' },
    rowContext: { fontSize: 13, color: colors.textSecondary },
  });
}
