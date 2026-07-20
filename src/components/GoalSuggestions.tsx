import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuthStore } from '../state/useAuthStore';
import { useCreateGoal, useGoals } from '../hooks/useGoals';
import { pickSuggestions, type GoalSuggestion } from '../lib/suggestions';
import { PillButton } from './PillButton';
import { INTEREST_OPTIONS } from './InterestPicker';
import { cardShell, colors, categoryColors, radii } from '../theme/colors';
import IdeaIllustration from '../../assets/illustrations/kinly-idea.svg';

function CustomizeGoalModal({
  suggestion,
  circleId,
  userId,
  onClose,
}: {
  suggestion: GoalSuggestion;
  circleId: string;
  userId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(suggestion.title);
  const [target, setTarget] = useState(String(suggestion.target));
  const createGoal = useCreateGoal();

  async function handleSave() {
    const targetValue = Number(target);
    if (!title.trim() || !targetValue) return;
    await createGoal.mutateAsync({
      circleId,
      userId,
      title: title.trim(),
      target: targetValue,
      category: suggestion.category,
    });
    onClose();
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Customize goal</Text>
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
              loading={createGoal.isPending}
              disabled={!title.trim() || !target}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SuggestionCard({ suggestion, onPress }: { suggestion: GoalSuggestion; onPress: () => void }) {
  const category = categoryColors[suggestion.category];
  const Icon = INTEREST_OPTIONS.find((o) => o.key === suggestion.category)?.Icon;

  return (
    <TouchableOpacity
      style={[styles.suggestionCard, { borderLeftColor: category.solid }]}
      onPress={onPress}
    >
      {Icon && <Icon size={16} color={category.solid} />}
      <Text style={styles.suggestionText}>{suggestion.title}</Text>
      <Text style={[styles.suggestionAdd, { color: category.solid }]}>+ Add</Text>
    </TouchableOpacity>
  );
}

export function GoalSuggestions({ circleId, userId }: { circleId: string; userId: string }) {
  const interests = useAuthStore((state) => state.user?.interests) ?? [];
  const { data: goals } = useGoals(circleId);
  const suggestions = pickSuggestions(interests, (goals ?? []).map((g) => g.title));
  const [editing, setEditing] = useState<GoalSuggestion | null>(null);

  if (suggestions.length === 0) return null;

  return (
    <View style={styles.suggestionsSection}>
      <View style={styles.sectionTitleRow}>
        <IdeaIllustration width={30} height={30} />
        <Text style={styles.sectionTitle}>Suggested for you</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsRow}>
        {suggestions.map((s) => (
          <SuggestionCard key={s.title} suggestion={s} onPress={() => setEditing(s)} />
        ))}
      </ScrollView>
      {editing && (
        <CustomizeGoalModal
          suggestion={editing}
          circleId={circleId}
          userId={userId}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  suggestionsSection: { marginBottom: 20 },
  suggestionsRow: { gap: 10, paddingRight: 16 },
  suggestionCard: {
    ...cardShell,
    padding: 14,
    paddingLeft: 12,
    width: 160,
    justifyContent: 'space-between',
    gap: 10,
  },
  suggestionText: { fontSize: 13, fontWeight: '600', color: colors.shellTitle },
  suggestionAdd: { fontSize: 12, fontWeight: '800' },
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
