import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../state/useAuthStore';
import { useCreateGoal, useGoals, useUpdateGoalProgress } from '../hooks/useGoals';
import { useLogEvent } from '../hooks/useEvents';
import { ProgressBar } from '../components/ProgressBar';
import { colors, radii, shadow } from '../theme/colors';
import type { Goal } from '../types/models';

function GoalCard({ goal, circleId, userId }: { goal: Goal; circleId: string; userId: string }) {
  const updateProgress = useUpdateGoalProgress();
  const logEvent = useLogEvent();
  const isComplete = goal.progress >= goal.target;

  async function handleLogProgress() {
    const step = Math.max(1, Math.round(goal.target / 10));
    const nextProgress = Math.min(goal.target, goal.progress + step);
    await updateProgress.mutateAsync({ goalId: goal.id, circleId, progress: nextProgress });
    if (nextProgress >= goal.target && goal.progress < goal.target) {
      await logEvent.mutateAsync({
        circleId,
        userId,
        type: 'goal_completed',
        payload: { title: goal.title },
      });
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{goal.title}</Text>
        {goal.streak_count > 0 && <Text style={styles.streak}>🔥 {goal.streak_count}</Text>}
      </View>
      <ProgressBar progress={goal.progress} target={goal.target} />
      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>
          {goal.progress} / {goal.target}
        </Text>
        {isComplete ? (
          <Text style={styles.doneBadge}>✓ Completed</Text>
        ) : (
          <TouchableOpacity
            style={styles.logButton}
            onPress={handleLogProgress}
            disabled={updateProgress.isPending}
          >
            <Text style={styles.logButtonText}>Log progress</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function AddGoalForm({ circleId, userId }: { circleId: string; userId: string }) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const createGoal = useCreateGoal();

  async function handleAdd() {
    const targetValue = Number(target);
    if (!title.trim() || !targetValue) return;
    await createGoal.mutateAsync({ circleId, userId, title: title.trim(), target: targetValue });
    setTitle('');
    setTarget('');
  }

  return (
    <View style={styles.form}>
      <TextInput
        style={styles.input}
        placeholder="Goal (e.g. Drink 4L water)"
        placeholderTextColor={colors.textSecondary}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[styles.input, styles.targetInput]}
        placeholder="Target"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numeric"
        value={target}
        onChangeText={setTarget}
      />
      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAdd}
        disabled={createGoal.isPending || !title.trim() || !target}
      >
        <Text style={styles.addButtonText}>Add</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function GoalsScreen() {
  const userId = useAuthStore((state) => state.user?.id);
  const circleId = useAuthStore((state) => state.activeCircleId);
  const { data: goals, isLoading } = useGoals(circleId ?? undefined);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Goals</Text>

      {userId && circleId && <AddGoalForm circleId={circleId} userId={userId} />}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <FlatList
          data={goals ?? []}
          keyExtractor={(goal) => goal.id}
          renderItem={({ item }) =>
            userId && circleId ? <GoalCard goal={item} circleId={circleId} userId={userId} /> : null
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No goals yet — add your first one above.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
  form: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: radii.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
  },
  targetInput: { flex: 0.4 },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.input,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: '700' },
  list: { gap: 12, paddingBottom: 110 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    gap: 10,
    ...shadow,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  streak: { fontSize: 14 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMeta: { fontSize: 12, color: colors.textSecondary },
  doneBadge: { fontSize: 13, fontWeight: '700', color: colors.success },
  logButton: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logButtonText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 24 },
});
