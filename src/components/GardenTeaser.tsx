import { useEffect } from 'react';
import type { FC } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { SvgProps } from 'react-native-svg';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { useGardenState } from '../hooks/useGarden';
import { gradients, radii } from '../theme/colors';
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

  const health = data?.health ?? 0;
  const hasMembers = (data?.members.length ?? 0) > 0;
  const barWidth = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withTiming(health, { duration: 600 });
  }, [health, barWidth]);

  const barStyle = useAnimatedStyle(() => ({ width: `${barWidth.value}%` }));
  const HeroArt = heroArt(health, hasMembers);

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <LinearGradient colors={gradients.growth} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.heroBadge}>
          <HeroArt width={40} height={40} />
        </View>
        <Text style={styles.title}>🌱 Your Circle</Text>
        <Text style={styles.percent}>{health}%</Text>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, barStyle]} />
        </View>
        <Text style={styles.copy}>{emotionalCopy(health, hasMembers)}</Text>
        <AnimatedPressable onPress={() => navigation.navigate('Circle')} style={styles.linkWrap}>
          <Text style={styles.link}>View Garden →</Text>
        </AnimatedPressable>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.card, padding: 20, marginBottom: 16, gap: 6 },
  heroBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: '#fff' },
  percent: { fontSize: 40, fontWeight: '800', color: '#fff', marginTop: 2 },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
    marginTop: 4,
  },
  barFill: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },
  copy: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 10, lineHeight: 18, maxWidth: '80%' },
  linkWrap: { alignSelf: 'flex-start', marginTop: 10 },
  link: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
