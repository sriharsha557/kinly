import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../state/useAuthStore';
import { useCircleDetail, useCircleMembers, useUpdateMemberRole } from '../hooks/useCircles';
import { PillButton } from '../components/PillButton';
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

export default function CircleSettingsScreen() {
  const userId = useAuthStore((state) => state.user?.id);
  const circleId = useAuthStore((state) => state.activeCircleId);
  const { data: circle, isLoading: circleLoading } = useCircleDetail(circleId ?? undefined);
  const { data: members, isLoading: membersLoading } = useCircleMembers(circleId ?? undefined);
  const updateRole = useUpdateMemberRole(circleId ?? undefined);

  const myRole = members?.find((m) => m.user_id === userId)?.role;
  const canManageRoles = myRole === 'owner' || myRole === 'admin';

  async function handleShareInvite() {
    if (!circle) return;
    await Share.share({
      message: `Join my Growth Circle "${circle.name}" on Kinly. Invite code: ${circle.invite_code}`,
    });
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
          <PillButton label="Share invite" onPress={handleShareInvite} style={{ marginTop: 12 }} />
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
      </ScrollView>
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
});
