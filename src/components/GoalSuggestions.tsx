import { AnimatedPressable } from './AnimatedPressable';
import { fontFamily, spacing } from '../theme/colors';
import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuthStore } from '../state/useAuthStore';
import { useCreateGoal, useGoals } from '../hooks/useGoals';
import { pickSuggestions, type GoalSuggestion } from '../lib/suggestions';
import { PillButton } from './PillButton';
import { INTEREST_OPTIONS } from './InterestPicker';
import { AreaPicker } from './AreaPicker';
import { CadencePicker } from './CadencePicker';
import { useCircleAreas } from '../hooks/useAreas';
import { validateCadence, type CadenceDraft } from '../lib/cadence';
import { errorMessage } from '../lib/errorMessage';
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
  const [areaId, setAreaId] = useState<string | null>(null);
  const [cadence, setCadence] = useState<CadenceDraft>({
    target_type: 'daily',
    target_count: null,
    target_weekdays: null,
  });
  const [error, setError] = useState<string | null>(null);
  const { data: areas } = useCircleAreas(circleId);
  const createGoal = useCreateGoal();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const canSave = !createGoal.isPending && !!title.trim() && !!areaId;

  async function handleSave() {
    setError(null);
    if (!title.trim() || !areaId) return;

    const cadenceError = validateCadence(cadence);
    if (cadenceError) {
      setError(cadenceError);
      return;
    }

    try {
      await createGoal.mutateAsync({ circleId, userId, areaId, title: title.trim(), cadence });
      onClose();
    } catch (err) {
      // errorMessage covers supabase-js's plain-object error shape, not just
      // Error instances - see src/lib/errorMessage.ts.
      setError(errorMessage(err, 'Could not add that goal.'));
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* AreaPicker (up to 8 chips) plus CadencePicker's type row plus
              up to 7 weekday chips can run taller than a small device's
              screen; without a scroll container the Save button would be
              pushed off past the bottom edge with nothing to reach it. */}
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <Text style={styles.modalTitle}>Customize goal</Text>
            <TextInput style={styles.modalInput} value={title} onChangeText={setTitle} placeholder="Goal title" />

            <AreaPicker areas={areas ?? []} selectedId={areaId} onSelect={setAreaId} />

            <CadencePicker value={cadence} onChange={setCadence} />

            {error && <Text style={styles.formError}>{error}</Text>}
          </ScrollView>

          <View style={styles.modalButtons}>
            <PillButton label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <PillButton
              label="Save"
              onPress={handleSave}
              loading={createGoal.isPending}
              disabled={!canSave}
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

function createStyles({ colors, radii, cardShell, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    sectionTitle: { ...type.body, fontFamily: fontFamily.bold, color: colors.textPrimary },
    suggestionsSection: { marginBottom: spacing.xl },
    suggestionsRow: { gap: spacing.s10, paddingRight: spacing.lg },
    suggestionCard: {
      ...cardShell,
      padding: spacing.s14,
      width: 160,
      justifyContent: 'space-between',
      gap: spacing.s10,
    },
    suggestionText: { ...type.caption, fontFamily: fontFamily.semibold, color: colors.shellTitle },
    suggestionAdd: { ...type.caption, fontFamily: fontFamily.bold },
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
      // Capped so the card can never exceed the screen; the ScrollView
      // inside it is what makes the excess reachable rather than clipped.
      maxHeight: '80%',
    },
    modalScrollContent: { gap: spacing.md },
    modalTitle: { ...type.subheading, fontFamily: fontFamily.bold, color: colors.textPrimary },
    formError: { ...type.caption, fontFamily: fontFamily.semibold, color: colors.danger },
    modalInput: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.input,
      paddingHorizontal: spacing.s14,
      paddingVertical: spacing.md,
      color: colors.textPrimary,
      ...type.body, fontFamily: fontFamily.regular,
    },
    modalButtons: { flexDirection: 'row', gap: spacing.s10, marginTop: spacing.xs },
  });
}
