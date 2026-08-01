import { useMemo } from 'react';
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

  const excluded = new Set(excludeUserIds);
  const members = (garden?.members ?? []).filter((m) => !excluded.has(m.userId));
  const moodByUser = new Map((moods ?? []).map((m) => [m.user_id, m.mood as MoodValue]));

  async function handleCheer(targetId: string, targetName: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await nudgeMember.mutateAsync({ targetId, targetName, fromUserId: userId, kind: 'cheer' });
    } catch (err) {
      Alert.alert('Could not send that', err instanceof Error ? err.message : 'Please try again.');
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
                onPress={() => handleCheer(member.userId, member.name)}
                style={styles.action}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

function createStyles({ colors }: ReturnType<typeof useTheme>) {
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
      gap: 12,
      minHeight: 56,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowCopy: { flex: 1, gap: 2 },
    name: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
    detail: { fontSize: 14, color: colors.textSecondary },
    action: { paddingVertical: 12, paddingHorizontal: 18 },
  });
}
