import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../state/useAuthStore';
import {
  useCircleDetail,
  useCircleMembers,
  useCreateCircle,
  useJoinCircle,
  useLeaveCircle,
  useMyCircles,
  useUpdateMemberRole,
} from '../hooks/useCircles';
import { PillButton } from '../components/PillButton';
import { inviteMessage, shareToWhatsApp } from '../lib/share';
import { colors, radii, shadow } from '../theme/colors';
import type { CircleRole } from '../types/models';

const ROLE_ORDER: CircleRole[] = ['member', 'admin', 'owner'];

function RoleChip({
  role,
  active,
  onPress,
}: {
  role: CircleRole;
  active: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.roleChip, active && styles.roleChipActive]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>{role}</Text>
    </TouchableOpacity>
  );
}

function JoinOrCreateModal({
  userId,
  onClose,
  onSwitched,
}: {
  userId: string;
  onClose: () => void;
  onSwitched: (circleId: string) => void;
}) {
  const [circleName, setCircleName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createCircle = useCreateCircle();
  const joinCircle = useJoinCircle();

  async function handleCreate() {
    setError(null);
    try {
      const circle = await createCircle.mutateAsync(circleName.trim());
      onSwitched(circle.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create circle');
    }
  }

  async function handleJoin() {
    setError(null);
    try {
      const circle = await joinCircle.mutateAsync(inviteCode.trim());
      onSwitched(circle.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join circle');
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>New Growth Circle</Text>
          <TextInput
            style={styles.modalInput}
            value={circleName}
            onChangeText={setCircleName}
            placeholder="Circle name"
            placeholderTextColor={colors.textSecondary}
          />
          <PillButton
            label="Create Circle"
            onPress={handleCreate}
            loading={createCircle.isPending}
            disabled={!circleName.trim()}
          />
          <Text style={styles.orDivider}>or</Text>
          <TextInput
            style={styles.modalInput}
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="Invite code"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
          <PillButton
            label="Join Circle"
            variant="outline"
            onPress={handleJoin}
            loading={joinCircle.isPending}
            disabled={!inviteCode.trim()}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity onPress={onClose} style={{ marginTop: 4 }}>
            <Text style={styles.cancelLink}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function CircleSettingsScreen() {
  const userId = useAuthStore((state) => state.user?.id);
  const circleId = useAuthStore((state) => state.activeCircleId);
  const setActiveCircleId = useAuthStore((state) => state.setActiveCircleId);
  const { data: circle, isLoading: circleLoading } = useCircleDetail(circleId ?? undefined);
  const { data: members, isLoading: membersLoading } = useCircleMembers(circleId ?? undefined);
  const { data: myCircles } = useMyCircles(userId);
  const updateRole = useUpdateMemberRole(circleId ?? undefined);
  const leaveCircle = useLeaveCircle();

  const [showJoinCreate, setShowJoinCreate] = useState(false);

  const myRole = members?.find((m) => m.user_id === userId)?.role;
  const canManageRoles = myRole === 'owner' || myRole === 'admin';

  async function handleShareWhatsApp() {
    if (!circle) return;
    await shareToWhatsApp(inviteMessage(circle.name, circle.invite_code));
  }

  async function handleShareOther() {
    if (!circle) return;
    await Share.share({ message: inviteMessage(circle.name, circle.invite_code) });
  }

  function handleLeave() {
    if (!circleId) return;
    const willTransferOwnership = myRole === 'owner' && (members?.length ?? 0) > 1;
    const message = willTransferOwnership
      ? "Ownership will transfer to another member. You'll need a new invite to rejoin."
      : "You'll need a new invite to rejoin.";

    Alert.alert('Leave this circle?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await leaveCircle.mutateAsync(circleId);
          setActiveCircleId(null);
        },
      },
    ]);
  }

  if (circleLoading || membersLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.circleName}>{circle?.name}</Text>

        <View style={styles.inviteCard}>
          <Text style={styles.inviteLabel}>Invite code</Text>
          <Text style={styles.inviteCode}>{circle?.invite_code}</Text>
          <PillButton label="Share via WhatsApp" onPress={handleShareWhatsApp} style={{ marginTop: 12 }} />
          <PillButton
            label="Other apps"
            variant="outline"
            onPress={handleShareOther}
            style={{ marginTop: 8 }}
          />
        </View>

        <Text style={styles.sectionTitle}>Members ({members?.length ?? 0}/10)</Text>
        <View style={styles.memberList}>
          {members?.map((member) => (
            <View key={member.user_id} style={styles.memberRow}>
              <Text style={styles.memberName}>{member.profiles?.name ?? 'Member'}</Text>
              {canManageRoles && member.user_id !== userId ? (
                <View style={styles.roleChips}>
                  {ROLE_ORDER.map((role) => (
                    <RoleChip
                      key={role}
                      role={role}
                      active={member.role === role}
                      onPress={() => updateRole.mutate({ userId: member.user_id, role })}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.roleChips}>
                  <RoleChip role={member.role} active onPress={undefined} />
                </View>
              )}
            </View>
          ))}
        </View>

        {myCircles && myCircles.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Your Circles</Text>
            <View style={styles.memberList}>
              {myCircles.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.circleRow, c.id === circleId && styles.circleRowActive]}
                  onPress={() => setActiveCircleId(c.id)}
                >
                  <Text
                    style={[styles.circleRowText, c.id === circleId && styles.circleRowTextActive]}
                  >
                    {c.name}
                  </Text>
                  {c.id === circleId && <Text style={styles.circleRowActiveTag}>Active</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <PillButton
          label="Join or start another circle"
          variant="outline"
          onPress={() => setShowJoinCreate(true)}
          style={{ marginTop: 20 }}
        />
        <PillButton
          label="Leave this circle"
          variant="outline"
          onPress={handleLeave}
          loading={leaveCircle.isPending}
          style={{ marginTop: 10, borderColor: colors.danger }}
        />
      </ScrollView>

      {showJoinCreate && userId && (
        <JoinOrCreateModal
          userId={userId}
          onClose={() => setShowJoinCreate(false)}
          onSwitched={(newCircleId) => {
            setActiveCircleId(newCircleId);
            setShowJoinCreate(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  circleName: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 16 },
  inviteCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 20,
    alignItems: 'center',
    ...shadow,
  },
  inviteLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  inviteCode: { fontSize: 28, fontWeight: '800', color: colors.primary, letterSpacing: 2, marginTop: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 28, marginBottom: 12 },
  memberList: { gap: 10 },
  memberRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 14,
    gap: 10,
    ...shadow,
  },
  memberName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  roleChips: { flexDirection: 'row', gap: 6 },
  roleChip: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  roleChipActive: { backgroundColor: colors.primary },
  roleChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'capitalize' },
  roleChipTextActive: { color: '#fff' },
  circleRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadow,
  },
  circleRowActive: { borderWidth: 1.5, borderColor: colors.primary },
  circleRowText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  circleRowTextActive: { color: colors.primary },
  circleRowActiveTag: { fontSize: 11, fontWeight: '700', color: colors.primary },
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
  orDivider: { textAlign: 'center', color: colors.textSecondary },
  cancelLink: { textAlign: 'center', color: colors.textSecondary, fontWeight: '600' },
  error: { color: colors.danger, textAlign: 'center' },
});
