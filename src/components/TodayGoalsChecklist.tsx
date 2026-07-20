import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutRight, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { useGoals } from '../hooks/useGoals';
import { useLogGoalWithCelebration, type Celebration } from '../hooks/useLogGoalWithCelebration';
import { MilestoneCardModal } from './MilestoneCardModal';
import { useCircleDetail } from '../hooks/useCircles';
import { colors, radii, shadow } from '../theme/colors';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// A row is checked off in two beats: justChecked flips the checkbox to a
// filled checkmark immediately, then checkedIds (which actually removes it
// from the list) is delayed so the checkmark is visible before the row exits.
const CHECKED_VISIBLE_MS = 550;

export function TodayGoalsChecklist({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: goals, isLoading } = useGoals(circleId);
  const { data: circle } = useCircleDetail(circleId);
  const { logGoal, isPending } = useLogGoalWithCelebration(circleId, userId, circle);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [justChecked, setJustChecked] = useState<Set<string>>(new Set());

  const today = todayIso();
  const myGoals = (goals ?? []).filter((g) => g.user_id === userId);
  const pending = myGoals.filter(
    (g) => g.progress < g.target && g.last_logged_date !== today && !checkedIds.has(g.id),
  );

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
      <Text style={styles.title}>{"Today's Progress"}</Text>

      {myGoals.length === 0 ? (
        <Text style={styles.empty}>Your journey starts today — add your first goal to get going.</Text>
      ) : pending.length === 0 ? (
        <Animated.Text entering={ZoomIn.springify().damping(14)} style={styles.done}>
          ✓ Everything logged for today. Nice work.
        </Animated.Text>
      ) : (
        <View style={styles.list}>
          {pending.map((goal, index) => {
            const checked = justChecked.has(goal.id);
            return (
              <Animated.View
                key={goal.id}
                entering={FadeInDown.duration(300).delay(index * 50)}
                exiting={FadeOutRight.duration(250)}
                layout={LinearTransition.springify()}
              >
                <AnimatedPressable
                  style={styles.row}
                  onPress={() => handleLog(goal.id)}
                  disabled={checked || (isPending && loggingId === goal.id)}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked ? (
                      <Animated.Text entering={ZoomIn.springify().damping(9)} style={styles.checkmark}>
                        ✓
                      </Animated.Text>
                    ) : (
                      isPending && loggingId === goal.id && <Text style={styles.checkboxLoading}>…</Text>
                    )}
                  </View>
                  <Text style={[styles.rowText, checked && styles.rowTextChecked]}>{goal.title}</Text>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 16,
    gap: 10,
    ...shadow,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  empty: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  done: { fontSize: 13, fontWeight: '600', color: colors.success },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.success, borderColor: colors.success },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  checkboxLoading: { fontSize: 12, color: colors.primary },
  rowText: { fontSize: 14, color: colors.textPrimary, flex: 1 },
  rowTextChecked: { opacity: 0.5, textDecorationLine: 'line-through' },
});
