import { useEffect, useMemo } from 'react';
import type { FC } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { SvgProps } from 'react-native-svg';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { ConceptHint } from './ConceptHint';
import { useGardenState } from '../hooks/useGarden';
import { useGoals } from '../hooks/useGoals';
import { useTheme } from '../theme/ThemeProvider';
import { SproutIcon } from './icons/MonoIcons';
import type { MainTabParamList } from '../navigation/types';
import SproutSoil from '../../assets/illustrations/kinly-ill-sprout-soil.svg';
import Bud from '../../assets/illustrations/kinly-ill-bud.svg';
import SmallTree from '../../assets/illustrations/kinly-ill-small-tree.svg';
import Flower from '../../assets/illustrations/kinly-ill-flower.svg';

function emotionalCopy(health: number, hasMembers: boolean): string {
  if (!hasMembers) return 'Your garden is waiting for its first bloom.';
  if (health >= 80) return 'Everyone is thriving today. Beautiful work.';
  if (health >= 50) return 'Your garden is growing steadily.';
  if (health > 0) return 'A few plants need water — check in on your circle.';
  return 'Your journey starts today. Log a goal to plant your first seed.';
}

// The collective signal, front and center: who showed up today, the
// circle's best streak, and who could use a hand - before any percentage
// or garden metaphor, so a first-time user reads people, not mechanics.
function statusLine(checkedInToday: number, memberCount: number, bestStreak: number, needsEncouragement: number): string {
  const parts = [`${checkedInToday}/${memberCount} checked in today`];
  if (bestStreak > 0) parts.push(`${bestStreak}-day streak`);
  if (needsEncouragement > 0) {
    parts.push(`${needsEncouragement} ${needsEncouragement === 1 ? 'friend needs' : 'friends need'} encouragement`);
  }
  return parts.join(' · ');
}

// Mirrors GardenCard's per-member stage art, but picked for the circle's
// overall health so Today gets the same visual language as the Circle tab.
function heroArt(health: number, hasMembers: boolean): FC<SvgProps> {
  if (!hasMembers || health === 0) return SproutSoil;
  if (health >= 80) return Flower;
  if (health >= 50) return SmallTree;
  return Bud;
}

// The bigger, more emotional Home-screen version of Garden - the full
// per-member breakdown lives on the Circle tab; this is just the feeling.
export function GardenTeaser({ circleId }: { circleId: string }) {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { data } = useGardenState(circleId);
  const { data: goals } = useGoals(circleId);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const health = data?.health ?? 0;
  const members = data?.members ?? [];
  const hasMembers = members.length > 0;

  // "Checked in today" is derived the same way the garden itself is - from
  // goals.last_logged_date - so the headline number and the visual always
  // agree.
  const today = new Date().toISOString().slice(0, 10);
  const loggedToday = new Set((goals ?? []).filter((g) => g.last_logged_date === today).map((g) => g.user_id));
  const checkedInToday = members.filter((m) => loggedToday.has(m.userId)).length;
  const bestStreak = members.reduce((max, m) => Math.max(max, m.streak), 0);
  const needsEncouragement = members.filter((m) => m.stage === 'wilted').length;
  const barWidth = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withTiming(health, { duration: 600 });
  }, [health, barWidth]);

  const barStyle = useAnimatedStyle(() => ({ width: `${barWidth.value}%` }));
  const HeroArt = heroArt(health, hasMembers);

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <LinearGradient colors={theme.gradients.growth} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.heroArt}>
          <HeroArt width={68} height={68} />
        </View>
        <View style={styles.titleRow}>
          <SproutIcon size={16} color={theme.colors.onAccent} />
          <Text style={styles.title}>Your Circle</Text>
        </View>
        {hasMembers && (
          <Text style={styles.statusLine}>
            {statusLine(checkedInToday, members.length, bestStreak, needsEncouragement)}
          </Text>
        )}
        <Text style={styles.percent}>{health}%</Text>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, barStyle]} />
        </View>
        <Text style={styles.copy}>{emotionalCopy(health, hasMembers)}</Text>
        <ConceptHint id="circle-garden" text="Every check-in grows your shared garden." onGradient />
        <AnimatedPressable onPress={() => navigation.navigate('Circle')} style={styles.linkWrap}>
          <Text style={styles.link}>View Garden →</Text>
        </AnimatedPressable>
      </LinearGradient>
    </Animated.View>
  );
}

function createStyles({ colors, radii }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: { borderRadius: radii.card, padding: 20, marginBottom: 16, gap: 6 },
    heroArt: {
      position: 'absolute',
      top: 10,
      right: 10,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { fontSize: 14, fontWeight: '700', color: colors.onAccent },
    statusLine: { fontSize: 13, fontWeight: '700', color: colors.onAccent, marginTop: 4, maxWidth: '78%', lineHeight: 18 },
    percent: { fontSize: 40, fontWeight: '800', color: colors.onAccent, marginTop: 2 },
    barTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.onAccentTint,
      overflow: 'hidden',
      marginTop: 4,
    },
    barFill: { height: '100%', backgroundColor: colors.onAccent, borderRadius: 4 },
    copy: { fontSize: 13, color: colors.onAccentMuted, marginTop: 10, lineHeight: 18, maxWidth: '80%' },
    linkWrap: { alignSelf: 'flex-start', marginTop: 10 },
    link: { fontSize: 13, fontWeight: '700', color: colors.onAccent },
  });
}
