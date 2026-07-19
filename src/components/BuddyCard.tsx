import { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMyBuddy, useSetBuddy, useCheckInOnBuddy } from '../hooks/useBuddy';
import { useCircleMembers } from '../hooks/useCircles';
import { useGardenState } from '../hooks/useGarden';
import { PillButton } from './PillButton';
import { categoryColors, colors, radii, shadow } from '../theme/colors';
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
  const checkIn = useCheckInOnBuddy(circleId);
  const [picking, setPicking] = useState(false);

  const buddyGarden = garden?.members.find((m) => m.userId === buddy?.buddy_id);
  const isInactive = buddyGarden?.stage === 'wilted';

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
    backgroundColor: categoryColors.relationships.bg,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 20,
    ...shadow,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: categoryColors.relationships.text },
  buddyName: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: 8 },
  status: { fontSize: 12, color: categoryColors.relationships.text, marginTop: 2 },
  changeLink: { fontSize: 12, fontWeight: '600', color: categoryColors.relationships.text },
  empty: { fontSize: 12, color: categoryColors.relationships.text, opacity: 0.8, marginTop: 6 },
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
