import { fontFamily, spacing } from '../theme/colors';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PillButton } from './PillButton';
import { GardenStageArt } from './GardenStageArt';
import { useGardenState } from '../hooks/useGarden';
import { useTodayMoodCheckins } from '../hooks/useMoodCheckins';
import { useNudgeMember } from '../hooks/useNudgeMember';
import { useTheme } from '../theme/ThemeProvider';
import type { MoodValue } from '../types/models';

const MOOD_WORD: Record<MoodValue, string> = {
  great: 'Great',
  okay: 'Okay',
  tough: 'Tough',
};

// Everyone not already shown in Circle Today, including you. Replaces the
// garden's plant row: the same per-member state, but as labelled rows with
// visible actions rather than 56dp plants you have to discover are tappable.
export function CircleMembersSection({
  circleId,
  userId,
  excludeUserIds,
}: {
  circleId: string;
  userId: string;
  excludeUserIds: string[];
}) {
  const { data: garden } = useGardenState(circleId);
  const { data: moods } = useTodayMoodCheckins(circleId);
  const nudgeMember = useNudgeMember(circleId);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // Which member's Cheer is currently in flight - per-row so a double-tap on
  // one row (or a tap on another row while one is sending) cannot fire a
  // second real push.
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const excluded = new Set(excludeUserIds);
  const members = (garden?.members ?? []).filter((m) => !excluded.has(m.userId));
  const moodByUser = new Map((moods ?? []).map((m) => [m.user_id, m.mood as MoodValue]));

  async function handleCheer(targetId: string, targetName: string, streak: number) {
    if (pendingUserId !== null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingUserId(targetId);
    try {
      await nudgeMember.mutateAsync({
        targetId,
        targetName,
        fromUserId: userId,
        kind: 'cheer',
        // Their streak is the one thing we actually know, so it is the one
        // thing a message may mention. With no streak, streak-placeholder
        // messages are simply ineligible and a generic line is picked.
        context: streak > 0 ? { streak } : undefined,
      });
    } catch (err) {
      Alert.alert('Could not send that', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setPendingUserId(null);
    }
  }

  if (members.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Members</Text>
      {members.map((member) => {
        const mood = moodByUser.get(member.userId);
        const isMe = member.userId === userId;
        const detail = [
          member.streak > 0 ? `${member.streak}-day streak` : 'no streak yet',
          mood ? MOOD_WORD[mood] : null,
        ]
          .filter(Boolean)
          .join(' · ');

        return (
          <View key={member.userId} style={styles.row}>
            <GardenStageArt stage={member.stage} size={28} />
            <View style={styles.rowCopy}>
              <Text style={styles.name}>{isMe ? 'You' : member.name}</Text>
              <Text style={styles.detail}>{detail}</Text>
            </View>
            {/* Outline, not solid: Circle Today's actions are the urgent
                ones, and if every row shouts equally none of them does. */}
            {!isMe && (
              <PillButton
                label="Cheer"
                variant="outline"
                onPress={() => handleCheer(member.userId, member.name, member.streak)}
                loading={pendingUserId === member.userId}
                disabled={pendingUserId !== null && pendingUserId !== member.userId}
                style={styles.action}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

function createStyles({ colors, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    section: { marginBottom: spacing.xxl },
    heading: {
      ...type.caption,
      fontFamily: fontFamily.bold,
      color: colors.textSecondary,
      marginBottom: spacing.s10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 56,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowCopy: { flex: 1, gap: spacing.s2 },
    name: { ...type.body, fontFamily: fontFamily.semibold, color: colors.textPrimary },
    detail: { ...type.secondary, fontFamily: fontFamily.regular, color: colors.textSecondary },
    // minHeight keeps this on the 48dp touch-target floor; the row's 56dp
    // height does not cover it, because the row itself is not tappable.
    action: { paddingVertical: spacing.md, paddingHorizontal: spacing.s18, minHeight: 48, justifyContent: 'center' },
  });
}
