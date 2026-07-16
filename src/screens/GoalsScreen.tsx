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
import { useCreateGoal, useGoals } from '../hooks/useGoals';
import { ProgressBar } from '../components/ProgressBar';
import { colors, radii, shadow } from '../theme/colors';
import type { Goal } from '../types/models';

function GoalCard({ goal }: { goal: Goal }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{goal.title}</Text>
        {goal.streak_count > 0 && <Text style={styles.streak}>🔥 {goal.streak_count}</Text>}
      </View>
      <ProgressBar progress={goal.progress} target={goal.target} />
      <Text style={styles.cardMeta}>
        {goal.progress} / {goal.target}
      </Text>
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
          renderItem={({ item }) => <GoalCard goal={item} />}
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
  list: { gap: 12, paddingBottom: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    gap: 8,
    ...shadow,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  streak: { fontSize: 14 },
  cardMeta: { fontSize: 12, color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 24 },
});
