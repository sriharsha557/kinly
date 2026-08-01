import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PillButton } from './PillButton';
import { EventRowSkeleton } from './Skeleton';
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
  isLoading,
  isError,
}: {
  circleId: string;
  userId: string;
  rows: AttentionRow[];
  isLoading?: boolean;
  isError?: boolean;
}) {
  const waterStreak = useWaterStreak(circleId);
  const nudgeMember = useNudgeMember(circleId);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // Which row's action is currently in flight - not a shared isPending flag,
  // so tapping one row doesn't spin every row's button, and so a second tap
  // on the same row (or any other) is blocked via `disabled` while it runs.
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  async function handleAction(row: AttentionRow) {
    if (pendingUserId !== null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingUserId(row.userId);
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
    } finally {
      setPendingUserId(null);
    }
  }

  // Precedence: error beats loading beats rows beats the all-clear empty
  // state - we must never claim "everyone is fine" while we don't actually
  // know that yet, or after a query has failed.
  let body: ReactNode;
  if (isError) {
    body = (
      // No sprout icon here - the reassuring art is exactly wrong when the
      // point of this state is that we do not know how the circle is doing.
      <View style={styles.empty}>
        <View style={styles.emptyCopy}>
          <Text style={styles.emptyTitle}>Couldn&apos;t load your circle</Text>
          <Text style={styles.emptyBody}>Pull down to try again.</Text>
        </View>
      </View>
    );
  } else if (isLoading) {
    body = (
      <View>
        <EventRowSkeleton />
        <EventRowSkeleton />
      </View>
    );
  } else if (rows.length > 0) {
    body = rows.map((row) => (
      <View key={`${row.userId}-${row.reason}`} style={styles.row}>
        <View style={styles.rowCopy}>
          <Text style={styles.name}>{row.name}</Text>
          <Text style={styles.detail}>{row.detail}</Text>
        </View>
        <PillButton
          label={ACTION_LABEL[row.reason]}
          onPress={() => handleAction(row)}
          loading={pendingUserId === row.userId}
          disabled={pendingUserId !== null && pendingUserId !== row.userId}
          style={styles.action}
        />
      </View>
    ));
  } else {
    // A good day is phrased as good news, not as an empty list. A
    // section that silently disappears also leaves you unsure whether
    // it checked at all - the confirmation is the point.
    body = (
      <View style={styles.empty}>
        <SproutIcon width={22} height={22} color={theme.colors.primary} />
        <View style={styles.emptyCopy}>
          <Text style={styles.emptyTitle}>Your circle is doing well today.</Text>
          <Text style={styles.emptyBody}>No one needs support right now.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Circle Today</Text>
      {body}
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
    // Compact against PillButton's full-width default, but minHeight keeps
    // it on the 48dp touch-target floor - the row is not the tappable thing,
    // so the row's own 56dp height does not cover this.
    action: { paddingVertical: 12, paddingHorizontal: 18, minHeight: 48, justifyContent: 'center' },
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
