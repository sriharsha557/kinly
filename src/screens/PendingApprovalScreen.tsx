import { AnimatedPressable } from '../components/AnimatedPressable';
import { fontFamily, spacing } from '../theme/colors';
import { useMemo } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../state/useAuthStore';
import { useCancelJoinRequest, useMyCircles, type CircleWithMembership } from '../hooks/useCircles';
import { GradientHeader } from '../components/GradientHeader';
import { PillButton } from '../components/PillButton';
import { useTheme } from '../theme/ThemeProvider';

// Same brand mark used in OnboardingScreen's header - Logo.tsx's old
// "friendly face" primitive was still showing up here too.
const BRAND_MARK = require('../../assets/brand/logo-white-glyph.png');
const BRAND_MARK_RATIO = 676 / 525;

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
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const otherActiveCircles = (circles ?? []).filter(
    (c) => c.id !== pendingCircle.id && c.membershipStatus === 'active',
  );

  async function handleCancel() {
    try {
      await cancelRequest.mutateAsync(pendingCircle.id);
    } catch (err) {
      Alert.alert('Could not cancel your request', err instanceof Error ? err.message : 'Please try again.');
      return;
    }
    setActiveCircleId(otherActiveCircles[0]?.id ?? null);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <GradientHeader>
          <Image source={BRAND_MARK} style={{ height: 66, width: 66 * BRAND_MARK_RATIO }} resizeMode="contain" />
          <Text style={styles.title}>Waiting for approval</Text>
          <Text style={styles.subtitle}>
            {`Your request to join "${pendingCircle.name}" is with the circle owner. You'll be let in as soon as they approve it.`}
          </Text>
        </GradientHeader>

        <View style={styles.body}>
          {otherActiveCircles.length > 0 && (
            <View style={styles.switchList}>
              <Text style={styles.switchLabel}>{"Or switch to a circle you're already in:"}</Text>
              {otherActiveCircles.map((c) => (
                <AnimatedPressable
      accessibilityRole="button"
                  key={c.id}
                  style={styles.switchRow}
                  onPress={() => setActiveCircleId(c.id)}
                >
                  <Text style={styles.switchRowText}>{c.name}</Text>
                </AnimatedPressable>
              ))}
            </View>
          )}

          <PillButton
            label="Cancel request"
            variant="outline"
            onPress={handleCancel}
            loading={cancelRequest.isPending}
            style={{ marginTop: spacing.lg, borderColor: theme.colors.danger }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles({ colors, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    title: { ...type.heading, fontFamily: fontFamily.bold, color: colors.onAccent, marginTop: spacing.md, textAlign: 'center' },
    subtitle: {
      ...type.secondary, fontFamily: fontFamily.regular,
      color: colors.onAccentMuted,
      marginTop: spacing.sm,
      textAlign: 'center',
      paddingHorizontal: spacing.md,
      lineHeight: 20,
    },
    body: { padding: spacing.xxl },
    switchList: { gap: spacing.sm },
    switchLabel: { ...type.caption, fontFamily: fontFamily.regular, color: colors.textSecondary, marginBottom: spacing.xs },
    switchRow: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
    },
    switchRowText: { ...type.body, fontFamily: fontFamily.semibold, color: colors.textPrimary },
  });
}
