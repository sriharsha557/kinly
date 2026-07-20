import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { ReactNode } from 'react';
import { useAuthStore } from '../state/useAuthStore';
import { useMyCircles } from '../hooks/useCircles';
import { GardenCard } from '../components/GardenCard';
import { BuddyCard } from '../components/BuddyCard';
import { ChallengesCard } from '../components/ChallengesCard';
import { VisionBoardCard } from '../components/VisionBoardCard';
import { MeetUpCard } from '../components/MeetUpCard';
import { CircleAICard } from '../components/CircleAICard';
import { WeeklyRecapCard } from '../components/WeeklyRecapCard';
import { DisclosureSection } from '../components/DisclosureSection';
import { useTabBarClearance } from '../hooks/useTabBarClearance';
import { colors, radii } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import SettingsIcon from '../../assets/brand/settings.svg';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function Reveal({ index, children }: { index: number; children: ReactNode }) {
  return <Animated.View entering={FadeInDown.duration(350).delay(index * 70)}>{children}</Animated.View>;
}

// Only shown once someone's actually in more than one circle - no point
// cluttering the header with a single-item switcher, which is most users
// early on. Tapping a chip drives the same app-wide activeCircleId every
// other tab already reads from (Today/Goals/Connection/Profile too), not
// just what this screen shows - see CircleSettingsScreen's own switcher,
// which this is a faster, more visible way to reach.
function CircleSwitcher({ activeCircleId, onSwitch }: { activeCircleId: string; onSwitch: (id: string) => void }) {
  const userId = useAuthStore((state) => state.user?.id);
  const { data: circles } = useMyCircles(userId);
  const myCircles = (circles ?? []).filter((c) => c.membershipStatus === 'active');

  if (myCircles.length < 2) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.switcherRow}>
      {myCircles.map((circle) => {
        const active = circle.id === activeCircleId;
        return (
          <TouchableOpacity
            key={circle.id}
            style={[styles.switcherChip, active && styles.switcherChipActive]}
            onPress={() => onSwitch(circle.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
          >
            <Text style={[styles.switcherChipText, active && styles.switcherChipTextActive]} numberOfLines={1}>
              {circle.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function CircleScreen() {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((state) => state.user?.id);
  const circleId = useAuthStore((state) => state.activeCircleId);
  const setActiveCircleId = useAuthStore((state) => state.setActiveCircleId);
  const scrollRef = useRef<ScrollView>(null);
  const tabBarClearance = useTabBarClearance();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.page, { paddingBottom: tabBarClearance }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Circle</Text>
          <TouchableOpacity style={styles.settingsRow} onPress={() => navigation.navigate('CircleSettings')}>
            <SettingsIcon width={15} height={15} />
            <Text style={styles.settingsLink}>Settings</Text>
          </TouchableOpacity>
        </View>

        {circleId && <CircleSwitcher activeCircleId={circleId} onSwitch={setActiveCircleId} />}

        {/* Primary: the accountability loop — how your circle's goals are actually going */}
        {circleId && (
          <Reveal index={0}>
            <GardenCard circleId={circleId} />
          </Reveal>
        )}
        {userId && circleId && (
          <Reveal index={1}>
            <BuddyCard circleId={circleId} userId={userId} />
          </Reveal>
        )}
        {userId && circleId && (
          <Reveal index={2}>
            <ChallengesCard circleId={circleId} userId={userId} />
          </Reveal>
        )}

        {/* Secondary: lower-frequency extras, tucked behind a tap so they don't compete for attention */}
        <DisclosureSection label="More for your circle">
          {userId && circleId && <VisionBoardCard circleId={circleId} userId={userId} />}
          {userId && circleId && <MeetUpCard circleId={circleId} userId={userId} />}
          {userId && circleId && (
            <CircleAICard
              circleId={circleId}
              userId={userId}
              onChallengeStarted={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            />
          )}
          {circleId && <WeeklyRecapCard circleId={circleId} />}
        </DisclosureSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  page: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  settingsLink: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  switcherRow: { gap: 8, marginBottom: 16 },
  switcherChip: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
    maxWidth: 160,
  },
  switcherChipActive: { backgroundColor: colors.primary },
  switcherChipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  switcherChipTextActive: { color: '#FFFFFF' },
});
