import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { ReactNode } from 'react';
import { useAuthStore } from '../state/useAuthStore';
import { GardenCard } from '../components/GardenCard';
import { BuddyCard } from '../components/BuddyCard';
import { ChallengesCard } from '../components/ChallengesCard';
import { VisionBoardCard } from '../components/VisionBoardCard';
import { MeetUpCard } from '../components/MeetUpCard';
import { CircleAICard } from '../components/CircleAICard';
import { WeeklyRecapCard } from '../components/WeeklyRecapCard';
import { DisclosureSection } from '../components/DisclosureSection';
import { useTabBarClearance } from '../hooks/useTabBarClearance';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import SettingsIcon from '../../assets/brand/settings.svg';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function Reveal({ index, children }: { index: number; children: ReactNode }) {
  return <Animated.View entering={FadeInDown.duration(350).delay(index * 70)}>{children}</Animated.View>;
}

export default function CircleScreen() {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((state) => state.user?.id);
  const circleId = useAuthStore((state) => state.activeCircleId);
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
});
