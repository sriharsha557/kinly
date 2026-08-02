import { fontFamily, spacing, type } from '../theme/colors';
import { useMemo, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useMyBuddy, useSetBuddy, useCheckInOnBuddy } from '../hooks/useBuddy';
import { useCircleMembers } from '../hooks/useCircles';
import { useGardenState } from '../hooks/useGarden';
import { useGoals } from '../hooks/useGoals';
import { useWaterStreak } from '../hooks/useStreakSaves';
import { isInGraceWindow } from '../lib/needsAttention';
import { ConceptHint } from './ConceptHint';
import { PillButton } from './PillButton';
import { useTheme } from '../theme/ThemeProvider';
import BuddyIcon from '../../assets/illustrations/kinly-ill-buddy.svg';

function PickBuddyModal({
  circleId,
  userId,
  onClose,
}: {
  circleId: string;
  userId: string;
  onClose: () => void;
}) {
  const { data: members } = useCircleMembers(circleId);
  const setBuddy = useSetBuddy(circleId, userId);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const others = (members ?? []).filter((m) => m.user_id !== userId && m.status === 'active');

  async function handlePick(buddyId: string) {
    await setBuddy.mutateAsync(buddyId);
    onClose();
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Choose a buddy</Text>
          {others.length === 0 ? (
            <Text style={styles.empty}>No other members in this circle yet.</Text>
          ) : (
            others.map((m) => (
              <TouchableOpacity key={m.user_id} style={styles.memberRow} onPress={() => handlePick(m.user_id)}>
                <Text style={styles.memberName}>{m.profiles?.name ?? 'Member'}</Text>
              </TouchableOpacity>
            ))
          )}
          <PillButton label="Cancel" variant="outline" onPress={onClose} style={{ marginTop: spacing.sm }} />
        </View>
      </View>
    </Modal>
  );
}

export function BuddyCard({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: buddy } = useMyBuddy(circleId, userId);
  const { data: garden } = useGardenState(circleId);
  const { data: goals } = useGoals(circleId);
  const checkIn = useCheckInOnBuddy(circleId);
  const waterStreak = useWaterStreak(circleId);
  const [picking, setPicking] = useState(false);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const buddyGarden = garden?.members.find((m) => m.userId === buddy?.buddy_id);
  const isInactive = buddyGarden?.stage === 'wilted';
  // needsAttention owns this rule now, so the Circle tab and this card can
  // never disagree about whether a streak is still savable.
  const waterableGoal = (goals ?? []).find(
    (g) => g.user_id === buddy?.buddy_id && isInGraceWindow(g.last_logged_date, Date.now()),
  );

  async function handleWater() {
    if (!waterableGoal) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await waterStreak.mutateAsync({ goalId: waterableGoal.id });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Could not water this streak', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <BuddyIcon width={22} height={22} color={theme.colors.textSecondary} />
        <Text style={styles.title}>Accountability Buddy</Text>
      </View>
      <ConceptHint id="buddy" text="One person who'll encourage you when you miss a goal." />

      {buddy ? (
        <>
          <Text style={styles.buddyName}>{buddy.buddy_name}</Text>
          <Text style={styles.status}>
            {isInactive ? "Hasn't logged anything in a few days" : 'Active recently — keep it up together'}
          </Text>
          {isInactive && (
            <PillButton
              label={`Check in on ${buddy.buddy_name}`}
              onPress={() =>
                checkIn.mutate(
                  { buddyId: buddy.buddy_id, buddyName: buddy.buddy_name, fromUserId: userId },
                  {
                    onError: (err) =>
                      Alert.alert(
                        'Could not check in',
                        err instanceof Error ? err.message : 'Please try again.',
                      ),
                  },
                )
              }
              loading={checkIn.isPending}
              style={{ marginTop: 10 }}
            />
          )}
          {waterableGoal && (
            <PillButton
              label={`💧 Water ${buddy.buddy_name}'s streak`}
              variant="outline"
              onPress={handleWater}
              loading={waterStreak.isPending}
              style={{ marginTop: spacing.sm }}
            />
          )}
          <TouchableOpacity onPress={() => setPicking(true)} style={{ marginTop: spacing.sm }}>
            <Text style={styles.changeLink}>Change buddy</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.empty}>Pick a buddy to keep each other on track.</Text>
          <PillButton label="Choose a buddy" onPress={() => setPicking(true)} style={{ marginTop: 10 }} />
        </>
      )}

      {picking && <PickBuddyModal circleId={circleId} userId={userId} onClose={() => setPicking(false)} />}
    </View>
  );
}

function createStyles({ colors, radii, cardShell }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      ...cardShell,
      padding: spacing.xl,
      paddingLeft: 18,
      marginBottom: spacing.xl,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { fontSize: 15, fontFamily: fontFamily.medium, color: colors.shellTitle },
    buddyName: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.textPrimary, marginTop: spacing.sm },
    status: { ...type.secondary, color: colors.shellSecondary, marginTop: 2 },
    changeLink: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.primary },
    empty: { ...type.secondary, color: colors.shellSecondary, marginTop: 6 },
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
      gap: spacing.sm,
    },
    modalTitle: { fontSize: 17, fontFamily: fontFamily.bold, color: colors.textPrimary, marginBottom: 6 },
    memberRow: {
      backgroundColor: colors.inputBg,
      borderRadius: radii.input,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
    },
    memberName: { fontSize: 15, fontFamily: fontFamily.semibold, color: colors.textPrimary },
  });
}
