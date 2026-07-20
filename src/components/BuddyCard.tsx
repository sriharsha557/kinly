import { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useMyBuddy, useSetBuddy, useCheckInOnBuddy } from '../hooks/useBuddy';
import { useCircleMembers } from '../hooks/useCircles';
import { useGardenState } from '../hooks/useGarden';
import { useGoals } from '../hooks/useGoals';
import { useWaterStreak } from '../hooks/useStreakSaves';
import { PillButton } from './PillButton';
import { cardShell, colors, radii } from '../theme/colors';
import BuddyIcon from '../../assets/illustrations/kinly-ill-buddy.svg';

// The exact single-day grace window water_streak() itself enforces
// server-side - mirrored here just to decide whether to show the button at
// all, not as the source of truth (the RPC re-validates everything).
function isInGraceWindow(lastLoggedDate: string | null): boolean {
  if (!lastLoggedDate) return false;
  const daysSince = Math.floor((Date.now() - new Date(lastLoggedDate).getTime()) / 86_400_000);
  return daysSince === 2;
}

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
          <PillButton label="Cancel" variant="outline" onPress={onClose} style={{ marginTop: 8 }} />
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

  const buddyGarden = garden?.members.find((m) => m.userId === buddy?.buddy_id);
  const isInactive = buddyGarden?.stage === 'wilted';
  const waterableGoal = (goals ?? []).find(
    (g) => g.user_id === buddy?.buddy_id && isInGraceWindow(g.last_logged_date),
  );

  async function handleWater() {
    if (!waterableGoal) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await waterStreak.mutateAsync(waterableGoal.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Could not water this streak', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <BuddyIcon width={22} height={22} />
        <Text style={styles.title}>Accountability Buddy</Text>
      </View>

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
                checkIn.mutate({ buddyId: buddy.buddy_id, buddyName: buddy.buddy_name, fromUserId: userId })
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
              style={{ marginTop: 8 }}
            />
          )}
          <TouchableOpacity onPress={() => setPicking(true)} style={{ marginTop: 8 }}>
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

const styles = StyleSheet.create({
  card: {
    ...cardShell,
    padding: 20,
    paddingLeft: 18,
    marginBottom: 20,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '500', color: colors.shellTitle },
  buddyName: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: 8 },
  status: { fontSize: 13, color: colors.shellSecondary, marginTop: 2 },
  changeLink: { fontSize: 12, fontWeight: '600', color: colors.primary },
  empty: { fontSize: 13, color: colors.shellSecondary, marginTop: 6 },
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
    gap: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  memberRow: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  memberName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
});
