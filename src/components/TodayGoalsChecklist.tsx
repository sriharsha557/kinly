import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGoals } from '../hooks/useGoals';
import { useLogGoalWithCelebration, type Celebration } from '../hooks/useLogGoalWithCelebration';
import { MilestoneCardModal } from './MilestoneCardModal';
import { useCircleDetail } from '../hooks/useCircles';
import { colors, radii, shadow } from '../theme/colors';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TodayGoalsChecklist({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: goals, isLoading } = useGoals(circleId);
  const { logGoal, isPending } = useLogGoalWithCelebration(circleId, userId);
  const { data: circle } = useCircleDetail(circleId);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [loggingId, setLoggingId] = useState<string | null>(null);

  const today = todayIso();
  const myGoals = (goals ?? []).filter((g) => g.user_id === userId);
  const pending = myGoals.filter((g) => g.progress < g.target && g.last_logged_date !== today);

  async function handleLog(goalId: string) {
    const goal = myGoals.find((g) => g.id === goalId);
    if (!goal) return;
    setLoggingId(goalId);
    try {
      const result = await logGoal(goal);
      if (result) setCelebration(result);
    } finally {
      setLoggingId(null);
    }
  }

  if (isLoading) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Today's Progress</Text>

      {myGoals.length === 0 ? (
        <Text style={styles.empty}>Your journey starts today — add your first goal to get going.</Text>
      ) : pending.length === 0 ? (
        <Text style={styles.done}>✓ Everything logged for today. Nice work.</Text>
      ) : (
        <View style={styles.list}>
          {pending.map((goal) => (
            <TouchableOpacity
              key={goal.id}
              style={styles.row}
              onPress={() => handleLog(goal.id)}
              disabled={isPending && loggingId === goal.id}
            >
              <View style={styles.checkbox}>
                {isPending && loggingId === goal.id && <Text style={styles.checkboxLoading}>…</Text>}
              </View>
              <Text style={styles.rowText}>{goal.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {celebration && (
        <MilestoneCardModal
          title={celebration.title}
          subtitle={celebration.subtitle}
          circleName={circle?.name}
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
  checkboxLoading: { fontSize: 12, color: colors.primary },
  rowText: { fontSize: 14, color: colors.textPrimary, flex: 1 },
});
