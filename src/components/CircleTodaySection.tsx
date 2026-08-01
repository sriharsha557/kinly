import { useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PillButton } from './PillButton';
import { useWaterStreak } from '../hooks/useStreakSaves';
import { useNudgeMember } from '../hooks/useNudgeMember';
import { useTheme } from '../theme/ThemeProvider';
import type { AttentionRow } from '../lib/needsAttention';
import SproutIcon from '../../assets/icons/feed/sprout.svg';

// Every row carries exactly one action, chosen by why the person is here.
const ACTION_LABEL: Record<AttentionRow['reason'], string> = {
  streak_at_risk: '💧 Water',
  tough_day: 'Check in',
  quiet: 'Cheer',
};

export function CircleTodaySection({
  circleId,
  userId,
  rows,
}: {
  circleId: string;
  userId: string;
  rows: AttentionRow[];
}) {
  const waterStreak = useWaterStreak(circleId);
  const nudgeMember = useNudgeMember(circleId);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  async function handleAction(row: AttentionRow) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (row.reason === 'streak_at_risk' && row.goalId) {
        await waterStreak.mutateAsync({ goalId: row.goalId });
        return;
      }
      await nudgeMember.mutateAsync({
        targetId: row.userId,
        targetName: row.name,
        fromUserId: userId,
        // A tough day wants encouragement to keep going; a quiet stretch
        // wants a cheer. Both map onto existing nudge kinds.
        kind: row.reason === 'tough_day' ? 'keep_going' : 'cheer',
      });
    } catch (err) {
      Alert.alert('Could not send that', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Circle Today</Text>

      {rows.length === 0 ? (
        // A good day is phrased as good news, not as an empty list. A
        // section that silently disappears also leaves you unsure whether
        // it checked at all - the confirmation is the point.
        <View style={styles.empty}>
          <SproutIcon width={22} height={22} color={theme.colors.primary} />
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>Your circle is doing well today.</Text>
            <Text style={styles.emptyBody}>Everyone checked in and no one needs support.</Text>
          </View>
        </View>
      ) : (
        rows.map((row) => (
          <View key={`${row.userId}-${row.reason}`} style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.name}>{row.name}</Text>
              <Text style={styles.detail}>{row.detail}</Text>
            </View>
            <PillButton
              label={ACTION_LABEL[row.reason]}
              onPress={() => handleAction(row)}
              loading={waterStreak.isPending || nudgeMember.isPending}
              style={styles.action}
            />
          </View>
        ))
      )}
    </View>
  );
}

function createStyles({ colors, radii }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    section: { marginBottom: 24 },
    heading: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textSecondary,
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 56,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowCopy: { flex: 1, gap: 2 },
    name: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
    detail: { fontSize: 14, color: colors.textSecondary },
    // Overrides PillButton's full-width default padding so the action sits
    // as a compact trailing control rather than dominating the row.
    action: { paddingVertical: 12, paddingHorizontal: 18 },
    empty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: radii.card,
      padding: 16,
    },
    emptyCopy: { flex: 1, gap: 2 },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    emptyBody: { fontSize: 14, color: colors.textSecondary },
  });
}
