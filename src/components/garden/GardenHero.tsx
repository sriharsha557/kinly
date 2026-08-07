import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Animated, { FadeInDown, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import { AnimatedPressable } from '../AnimatedPressable';
import { SkyGradient } from './SkyGradient';
import { PlantRow } from './PlantRow';
import { GardenFooter } from './GardenFooter';
import { useGardenState } from '../../hooks/useGarden';
import { useMemberActivity } from '../../hooks/useMemberActivity';
import { useDaylight } from '../../hooks/useDaylight';
import { useAuthStore } from '../../state/useAuthStore';
import { useTheme } from '../../theme/ThemeProvider';
import { motion } from '../../theme/colors';
import type { MainTabParamList } from '../../navigation/types';
import SunIcon from '../../../assets/illustrations/kinly-ill-sun.svg';
import SunCloudIcon from '../../../assets/illustrations/kinly-ill-sun-cloud.svg';
import RainCloudIcon from '../../../assets/illustrations/kinly-ill-rain-cloud.svg';

// Circle-level state (design/REDESIGN.md §5.2) - drives the weather art
// and the status copy. Health = existing useGardenState derivation.
type CircleGardenState = 'thriving' | 'growing' | 'needsCare' | 'dormant';

function circleState(health: number, hasMembers: boolean): CircleGardenState {
  if (!hasMembers || health === 0) return 'dormant';
  if (health >= 80) return 'thriving';
  if (health >= 40) return 'growing';
  return 'needsCare';
}

const WEATHER: Record<CircleGardenState, typeof SunIcon | null> = {
  thriving: SunIcon,
  growing: SunCloudIcon,
  needsCare: RainCloudIcon,
  dormant: null,
};

// checkedInToday guards the celebratory copy: health is streak-based, so a
// circle can be "100% thriving" before anyone has checked in today - and
// claiming "everyone is thriving" next to "0/1 checked in" reads as a bug.
function statusCopy(state: CircleGardenState, droopiestName: string | null, checkedInToday: number): string {
  if (state === 'needsCare') return droopiestName ? `${droopiestName} could use some water.` : 'A few plants need water.';
  if (state === 'dormant') return 'Log a goal to plant your first seed.';
  if (checkedInToday === 0) return 'Check in to keep your garden growing.';
  if (state === 'thriving') return 'Everyone is thriving today.';
  return 'Your garden is growing steadily.';
}

// Today's garden. The Circle tab used to render this same component in a
// "tend" variant, which made that screen a second dashboard and put the
// water/cheer actions behind tapping a 56dp plant; those actions live in
// CircleTodaySection's labelled rows now, and this has one form again.
//
// Composition only - the sky, the row and the footer each own their own
// layout and motion.
export function GardenHero({ circleId }: { circleId: string }) {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const userId = useAuthStore((state) => state.user?.id);
  const { data, isError } = useGardenState(circleId);
  const { activity } = useMemberActivity(circleId);
  const reducedMotion = useReducedMotion();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const phase = useDaylight();
  // The idle sway used to run for as long as this stayed mounted, which
  // included the whole time the user was on another tab.
  const isFocused = useIsFocused();

  const members = data?.members ?? [];
  const health = data?.health ?? 0;
  const state = circleState(health, members.length > 0);
  const Weather = WEATHER[state];

  const today = new Date().toISOString().slice(0, 10);
  const checkedInToday = members.filter((m) => activity.get(m.userId)?.lastCheckinDate === today).length;
  const bestStreak = members.reduce((max, m) => Math.max(max, m.streak), 0);
  const droopiest = members.find((m) => m.stage === 'wilted') ?? null;

  // Suppressed entirely on a failed fetch rather than rendered as zeros.
  // "0/4 checked in today" is a claim about four people's week; if the
  // check-ins query failed we do not know it, and a wrong zero here tells
  // the circle nobody is doing anything. Silence rather than an error
  // banner: this is a decorative hero, and the screens that actually need
  // the data report their own failures.
  //
  // No unit on the streak: bestStreak is a max across goals counted in
  // their own cadence periods, so a 4x/week member with six good weeks
  // reads "6" - calling that "6-day" states something that did not happen.
  const statusParts: string[] = [];
  if (!isError) {
    statusParts.push(`${checkedInToday}/${members.length} checked in today`);
    if (bestStreak > 0) statusParts.push(`${bestStreak}-streak`);
  }

  const hero = (
    <SkyGradient phase={phase}>
      {Weather && (
        // Keyed by state so a change in circle health (growing → thriving)
        // re-mounts the icon with a spring pop - the sun coming out is the
        // reward moment for a full circle of check-ins.
        <Animated.View
          key={state}
          style={styles.weather}
          entering={reducedMotion ? undefined : ZoomIn.springify().damping(motion.damping.pop)}
        >
          <Weather width={44} height={44} />
        </Animated.View>
      )}

      <PlantRow members={members} selfId={userId} animate={isFocused} />

      <GardenFooter
        status={statusCopy(state, droopiest && state === 'needsCare' ? droopiest.name : null, checkedInToday)}
        meta={members.length > 0 && statusParts.length > 0 ? statusParts.join(' · ') : null}
      />
    </SkyGradient>
  );

  return (
    <Animated.View entering={FadeInDown.duration(motion.duration.entrance)}>
      <AnimatedPressable
        onPress={() => navigation.navigate('Circle')}
        accessibilityRole="button"
        accessibilityLabel="Open your Circle Garden"
      >
        {hero}
      </AnimatedPressable>
    </Animated.View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { spacing } = theme;
  return StyleSheet.create({
    weather: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.lg,
      // Above the sky's time-of-day wash, which is an absolute fill.
      zIndex: 1,
    },
  });
}
