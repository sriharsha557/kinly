import { AnimatedPressable } from './AnimatedPressable';
import { fontFamily, spacing } from '../theme/colors';
import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuthStore } from '../state/useAuthStore';
import { useCreateGoal, useGoals } from '../hooks/useGoals';
import { pickSuggestions, type GoalSuggestion } from '../lib/suggestions';
import { PillButton } from './PillButton';
import { INTEREST_OPTIONS } from './InterestPicker';
import { useTheme } from '../theme/ThemeProvider';
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
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const Icon = INTEREST_OPTIONS.find((o) => o.key === suggestion.category)?.Icon;

  return (
    <AnimatedPressable
      accessibilityRole="button" style={styles.suggestionCard} onPress={onPress}>
      {Icon && <Icon size={16} color={theme.colors.textSecondary} />}
      <Text style={styles.suggestionText}>{suggestion.title}</Text>
      <Text style={[styles.suggestionAdd, { color: theme.colors.primary }]}>+ Add</Text>
    </AnimatedPressable>
  );
}

export function GoalSuggestions({ circleId, userId }: { circleId: string; userId: string }) {
  const interests = useAuthStore((state) => state.user?.interests) ?? [];
  const { data: goals } = useGoals(circleId);
  const suggestions = pickSuggestions(interests, (goals ?? []).map((g) => g.title));
  const [editing, setEditing] = useState<GoalSuggestion | null>(null);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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

function createStyles({ colors, radii, cardShell }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    sectionTitle: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.textPrimary },
    suggestionsSection: { marginBottom: spacing.xl },
    suggestionsRow: { gap: 10, paddingRight: spacing.lg },
    suggestionCard: {
      ...cardShell,
      padding: 14,
      width: 160,
      justifyContent: 'space-between',
      gap: 10,
    },
    suggestionText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.shellTitle },
    suggestionAdd: { fontSize: 13, fontFamily: fontFamily.bold },
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
    },
    modalTitle: { fontSize: 17, fontFamily: fontFamily.bold, color: colors.textPrimary },
    modalInput: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.input,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      color: colors.textPrimary,
      fontSize: 15, fontFamily: fontFamily.regular,
    },
    modalButtons: { flexDirection: 'row', gap: 10, marginTop: spacing.xs },
  });
}
