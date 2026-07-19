import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../state/useAuthStore';
import { useCancelJoinRequest, useMyCircles, type CircleWithMembership } from '../hooks/useCircles';
import { Logo } from '../components/Logo';
import { GradientHeader } from '../components/GradientHeader';
import { PillButton } from '../components/PillButton';
import { colors } from '../theme/colors';

// Shown instead of MainTabs while the active circle's membership is
// 'pending' (migration 0022) - RootNavigator polls useMyCircles (via its
// default staleTime/refetchInterval below) so this routes into the real app
// automatically once an owner/admin approves, with no realtime channel
// needed (this codebase has none elsewhere; polling matches its existing
// React Query-only pattern).
export default function PendingApprovalScreen({ pendingCircle }: { pendingCircle: CircleWithMembership }) {
  const userId = useAuthStore((state) => state.user?.id);
  const setActiveCircleId = useAuthStore((state) => state.setActiveCircleId);
  const { data: circles } = useMyCircles(userId);
  const cancelRequest = useCancelJoinRequest();

  const otherActiveCircles = (circles ?? []).filter(
    (c) => c.id !== pendingCircle.id && c.membershipStatus === 'active',
  );

  async function handleCancel() {
    await cancelRequest.mutateAsync(pendingCircle.id);
    setActiveCircleId(otherActiveCircles[0]?.id ?? null);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <GradientHeader>
          <Logo size={72} color="#FFFFFF" />
          <Text style={styles.title}>Waiting for approval</Text>
          <Text style={styles.subtitle}>
            Your request to join "{pendingCircle.name}" is with the circle owner. You'll be let in as soon as
            they approve it.
          </Text>
        </GradientHeader>

        <View style={styles.body}>
          {otherActiveCircles.length > 0 && (
            <View style={styles.switchList}>
              <Text style={styles.switchLabel}>Or switch to a circle you're already in:</Text>
              {otherActiveCircles.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.switchRow}
                  onPress={() => setActiveCircleId(c.id)}
                >
                  <Text style={styles.switchRowText}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <PillButton
            label="Cancel request"
            variant="outline"
            onPress={handleCancel}
            loading={cancelRequest.isPending}
            style={{ marginTop: 16, borderColor: colors.danger }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 12, textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 20,
  },
  body: { padding: 24 },
  switchList: { gap: 8 },
  switchLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  switchRow: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
  },
  switchRowText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
});
