import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../state/useAuthStore';
import { useCreateGoal, useDeleteGoal, useGoals, useLogGoalProgress, useUpdateGoal } from '../hooks/useGoals';
import { useLogEvent } from '../hooks/useEvents';
import { ProgressBar } from '../components/ProgressBar';
import { PillButton } from '../components/PillButton';
import { colors, radii, shadow } from '../theme/colors';
import type { Goal } from '../types/models';

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

function EditGoalModal({ goal, circleId, onClose }: { goal: Goal; circleId: string; onClose: () => void }) {
  const [title, setTitle] = useState(goal.title);
  const [target, setTarget] = useState(String(goal.target));
  const updateGoal = useUpdateGoal();

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

function GoalCard({ goal, circleId, userId }: { goal: Goal; circleId: string; userId: string }) {
  const logProgress = useLogGoalProgress();
  const logEvent = useLogEvent();
  const deleteGoal = useDeleteGoal();
  const [editing, setEditing] = useState(false);
  const isComplete = goal.progress >= goal.target;

  function handleOptions() {
    Alert.alert(goal.title, undefined, [
      { text: 'Edit', onPress: () => setEditing(true) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete this goal?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => deleteGoal.mutate({ goalId: goal.id, circleId }),
            },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleLogProgress() {
    const step = Math.max(1, Math.round(goal.target / 10));
    const wasComplete = goal.progress >= goal.target;
    const previousStreak = goal.streak_count;

    const updated = await logProgress.mutateAsync({ goalId: goal.id, circleId, increment: step });

    const justCompleted = !wasComplete && updated.progress >= updated.target;
    const hitMilestone = updated.streak_count > previousStreak && STREAK_MILESTONES.includes(updated.streak_count);

    if (justCompleted || hitMilestone) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (justCompleted) {
      await logEvent.mutateAsync({
        circleId,
        userId,
        type: 'goal_completed',
        payload: { title: goal.title },
      });
    }
    if (hitMilestone) {
      await logEvent.mutateAsync({
        circleId,
        userId,
        type: 'streak',
        payload: { title: goal.title, streak_count: updated.streak_count },
      });
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{goal.title}</Text>
        <View style={styles.cardHeaderRight}>
          {goal.streak_count > 0 && <Text style={styles.streak}>🔥 {goal.streak_count}</Text>}
          <TouchableOpacity onPress={handleOptions} hitSlop={8}>
            <Text style={styles.optionsButton}>⋯</Text>
          </TouchableOpacity>
        </View>
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
            disabled={logProgress.isPending}
          >
            <Text style={styles.logButtonText}>Log progress</Text>
          </TouchableOpacity>
        )}
      </View>
      {editing && <EditGoalModal goal={goal} circleId={circleId} onClose={() => setEditing(false)} />}
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
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  streak: { fontSize: 14 },
  optionsButton: { fontSize: 18, color: colors.textSecondary, fontWeight: '700', paddingHorizontal: 4 },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalInput: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
