import { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '../state/useAuthStore';
import { useCreateGoal, useDeleteGoal, useGoals, useUpdateGoal } from '../hooks/useGoals';
import { useLogGoalWithCelebration, type Celebration } from '../hooks/useLogGoalWithCelebration';
import { useHasWaterMark } from '../hooks/useStreakSaves';
import { useCircleDetail } from '../hooks/useCircles';
import { pickAndUploadCheckinPhoto } from '../lib/checkinPhotoUpload';
import { ProgressBar } from '../components/ProgressBar';
import { PillButton } from '../components/PillButton';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { MilestoneCardModal } from '../components/MilestoneCardModal';
import { INTEREST_OPTIONS } from '../components/InterestPicker';
import { GoalSuggestions } from '../components/GoalSuggestions';
import { GoalCardSkeleton } from '../components/Skeleton';
import { useTabBarClearance } from '../hooks/useTabBarClearance';
import { categoryColors, colors, radii, shadow } from '../theme/colors';
import type { Goal, InterestCategory } from '../types/models';

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
  const { data: circle } = useCircleDetail(circleId);
  const { logGoal, isPending } = useLogGoalWithCelebration(circleId, userId, circle);
  const deleteGoal = useDeleteGoal();
  const { data: hasWaterMark } = useHasWaterMark(goal.id);
  const [editing, setEditing] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
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
            <Text style={styles.streak}>
              🔥 {goal.streak_count}
              {hasWaterMark && ' 💧'}
            </Text>
          )}
          <TouchableOpacity
            onPress={handleOptions}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`Options for ${goal.title}`}
          >
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
          <View style={styles.logActions}>
            <TouchableOpacity
              onPress={handleLogWithPhoto}
              disabled={isPending}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Log progress with a photo"
            >
              <Text style={styles.photoButton}>📷</Text>
            </TouchableOpacity>
            <AnimatedPressable style={styles.logButton} onPress={handleLogProgress} disabled={isPending}>
              <Text style={styles.logButtonText}>Log progress</Text>
            </AnimatedPressable>
          </View>
        )}
      </View>
      {editing && <EditGoalModal goal={goal} circleId={circleId} onClose={() => setEditing(false)} />}
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
  const [category, setCategory] = useState<InterestCategory | null>(null);
  const createGoal = useCreateGoal();

  async function handleAdd() {
    const targetValue = Number(target);
    if (!title.trim() || !targetValue) return;
    await createGoal.mutateAsync({ circleId, userId, title: title.trim(), target: targetValue, category });
    setTitle('');
    setTarget('');
    setCategory(null);
  }

  return (
    <View style={styles.addGoalWrap}>
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
      <View style={styles.categoryRow}>
        {INTEREST_OPTIONS.map(({ key, emoji }) => {
          const active = category === key;
          const cat = categoryColors[key];
          return (
            <TouchableOpacity
              key={key}
              style={[styles.categoryChip, { backgroundColor: active ? cat.solid : colors.inputBg }]}
              onPress={() => setCategory(active ? null : key)}
            >
              <Text style={styles.categoryChipText}>{emoji}</Text>
            </TouchableOpacity>
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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Goals</Text>

      {userId && circleId && <GoalSuggestions circleId={circleId} userId={userId} />}

      {userId && circleId && <AddGoalForm circleId={circleId} userId={userId} />}

      {isLoading ? (
        <View style={{ marginTop: 4 }}>
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
              <Animated.View entering={FadeInDown.duration(350).delay(Math.min(index, 6) * 60)}>
                <GoalCard goal={item} circleId={circleId} userId={userId} />
              </Animated.View>
            ) : null
          }
          contentContainerStyle={[styles.list, { paddingBottom: tabBarClearance }]}
          ListEmptyComponent={<Text style={styles.empty}>No goals yet — add your first one above.</Text>}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={colors.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
  addGoalWrap: { marginBottom: 16, gap: 8 },
  form: { flexDirection: 'row', gap: 8 },
  categoryRow: { flexDirection: 'row', gap: 8 },
  categoryChip: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipText: { fontSize: 15 },
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
  list: { gap: 12 },
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
  logActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  photoButton: { fontSize: 18 },
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
