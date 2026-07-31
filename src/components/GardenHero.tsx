import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { ActionSheet, type ActionSheetOption } from './ActionSheet';
import { GardenStageArt } from './GardenStageArt';
import { useGardenState, type MemberGardenState } from '../hooks/useGarden';
import { useGoals } from '../hooks/useGoals';
import { useCheckInOnBuddy } from '../hooks/useBuddy';
import { useWaterStreak } from '../hooks/useStreakSaves';
import { useAuthStore } from '../state/useAuthStore';
import { useTheme } from '../theme/ThemeProvider';
import type { MainTabParamList } from '../navigation/types';
import type { Goal } from '../types/models';
import SunIcon from '../../assets/illustrations/kinly-ill-sun.svg';
import SunCloudIcon from '../../assets/illustrations/kinly-ill-sun-cloud.svg';
import RainCloudIcon from '../../assets/illustrations/kinly-ill-rain-cloud.svg';

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

// The same single-day grace window water_streak() enforces server-side -
// mirrored (like BuddyCard does) only to decide which action to offer.
function isInGraceWindow(lastLoggedDate: string | null): boolean {
  if (!lastLoggedDate) return false;
  const daysSince = Math.floor((Date.now() - new Date(lastLoggedDate).getTime()) / 86_400_000);
  return daysSince === 2;
}

// One plant in the row: stage art inside a 64dp target, idle sway when
// healthy, a slow lean when wilted. Stage changes re-mount the art with a
// spring ZoomIn - that one mechanism covers both the sprout-pop (seed →
// sprout) and the bloom moment (tree → bloom) without bespoke choreography.
function Plant({
  member,
  isSelf,
  artSize,
  swayIndex,
  onPress,
}: {
  member: MemberGardenState;
  isSelf: boolean;
  artSize: number;
  swayIndex: number;
  onPress?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const wilted = member.stage === 'wilted';
  const lean = useSharedValue(0);
  const mountedStage = useRef(member.stage);

  useEffect(() => {
    if (wilted) {
      // Droop: slow lean, no sway.
      lean.value = withTiming(-8, { duration: reducedMotion ? 0 : 600, easing: Easing.inOut(Easing.ease) });
    } else if (reducedMotion) {
      lean.value = withTiming(0, { duration: 0 });
    } else {
      // Recover upright with a spring, then idle sway (phase-offset per
      // plant so the row doesn't wave in lockstep).
      lean.value = withSequence(
        withSpring(0, { damping: 14 }),
        withDelay(
          swayIndex * 400,
          withRepeat(
            withSequence(
              withTiming(1.5, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
              withTiming(-1.5, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
            true,
          ),
        ),
      );
    }
  }, [wilted, reducedMotion, swayIndex, lean]);

  const swayStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${lean.value}deg` }] }));

  // Only animate stage *changes* (a check-in landing, a bloom) - never the
  // initial mount, which is data display, not an event.
  const stageChanged = mountedStage.current !== member.stage;
  useEffect(() => {
    mountedStage.current = member.stage;
  }, [member.stage]);

  const body = (
    <View style={styles.plantSlot}>
      <Animated.View style={[swayStyle, wilted && styles.plantWilted]}>
        <Animated.View
          key={member.stage}
          entering={stageChanged && !reducedMotion ? ZoomIn.springify().damping(12) : undefined}
        >
          <GardenStageArt stage={member.stage} size={artSize} />
        </Animated.View>
      </Animated.View>
      <Text style={[styles.plantName, isSelf && styles.plantNameSelf]} numberOfLines={1}>
        {isSelf ? 'You' : member.name}
      </Text>
      {member.streak > 0 && <Text style={styles.plantStreak}>{member.streak}d</Text>}
    </View>
  );

  if (!onPress) return body;
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${isSelf ? 'Your' : `${member.name}'s`} plant, ${member.stage}, ${member.streak} day streak`}
    >
      {body}
    </AnimatedPressable>
  );
}

// The Living Garden hero (design/REDESIGN.md §5) - replaces GardenTeaser
// (variant="overview", Today) and GardenCard (variant="tend", Circle).
// Purely presentational over existing data + mutations: useGardenState,
// useGoals, water_streak, check-in-on-member. Never reaches outside the
// circle.
export function GardenHero({ circleId, variant }: { circleId: string; variant: 'overview' | 'tend' }) {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const userId = useAuthStore((state) => state.user?.id);
  const { data } = useGardenState(circleId);
  const { data: goals } = useGoals(circleId);
  const waterStreak = useWaterStreak(circleId);
  const checkInOnMember = useCheckInOnBuddy(circleId);
  const reducedMotion = useReducedMotion();
  const [tending, setTending] = useState<MemberGardenState | null>(null);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const members = data?.members ?? [];
  const health = data?.health ?? 0;
  const state = circleState(health, members.length > 0);
  const Weather = WEATHER[state];

  const today = new Date().toISOString().slice(0, 10);
  const loggedToday = new Set((goals ?? []).filter((g) => g.last_logged_date === today).map((g) => g.user_id));
  const checkedInToday = members.filter((m) => loggedToday.has(m.userId)).length;
  const bestStreak = members.reduce((max, m) => Math.max(max, m.streak), 0);
  const droopiest = members.find((m) => m.stage === 'wilted') ?? null;

  // Plants shrink as circles grow (2-10 members); past 6 the row scrolls.
  const artSize = members.length > 6 ? 44 : members.length > 4 ? 52 : 64;

  const statusParts = [`${checkedInToday}/${members.length} checked in today`];
  if (bestStreak > 0) statusParts.push(`${bestStreak}-day streak`);

  function tendOptions(member: MemberGardenState): ActionSheetOption[] {
    if (!userId || member.userId === userId) return [];
    const waterableGoal: Goal | undefined = (goals ?? []).find(
      (g) => g.user_id === member.userId && isInGraceWindow(g.last_logged_date),
    );
    if (waterableGoal) {
      return [
        {
          label: `💧 Water ${member.name}'s streak`,
          onPress: async () => {
            setTending(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            try {
              await waterStreak.mutateAsync({ goalId: waterableGoal.id });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              // Server re-validates the grace window; a race just no-ops here.
            }
          },
        },
      ];
    }
    return [
      {
        label: `Check in on ${member.name}`,
        onPress: () => {
          setTending(null);
          if (userId) checkInOnMember.mutate({ buddyId: member.userId, buddyName: member.name, fromUserId: userId });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ];
  }

  const hero = (
    <LinearGradient
      colors={[theme.colors.inputBg, theme.colors.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.hero, variant === 'tend' && styles.heroTend]}
    >
      {Weather && (
        // Keyed by state so a change in circle health (growing → thriving)
        // re-mounts the icon with a spring pop - the sun coming out is the
        // reward moment for a full circle of check-ins.
        <Animated.View
          key={state}
          style={styles.weather}
          entering={reducedMotion ? undefined : ZoomIn.springify().damping(12)}
        >
          <Weather width={44} height={44} />
        </Animated.View>
      )}

      {members.length === 0 ? (
        <View style={styles.dormant}>
          <GardenStageArt stage="seed" size={64} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.plantRow}
          scrollEnabled={members.length > 6}
        >
          {members.map((member, index) => (
            // Staggered entrance so the garden "grows in" row by row on
            // first render instead of appearing all at once.
            <Animated.View
              key={member.userId}
              entering={reducedMotion ? undefined : FadeInDown.duration(350).delay(index * 70)}
            >
              <Plant
                member={member}
                isSelf={member.userId === userId}
                artSize={artSize}
                swayIndex={reducedMotion ? 0 : index}
                onPress={variant === 'tend' ? () => setTending(member) : undefined}
              />
            </Animated.View>
          ))}
        </ScrollView>
      )}

      <View style={styles.soil} />

      <View style={styles.footer}>
        <Text style={styles.title}>Circle Garden</Text>
        <Text style={styles.status}>
          {statusCopy(state, droopiest && state === 'needsCare' ? droopiest.name : null, checkedInToday)}
        </Text>
        {members.length > 0 && <Text style={styles.statusMeta}>{statusParts.join(' · ')}</Text>}
      </View>
    </LinearGradient>
  );

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      {variant === 'overview' ? (
        <AnimatedPressable
          onPress={() => navigation.navigate('Circle')}
          accessibilityRole="button"
          accessibilityLabel="Open your Circle Garden"
        >
          {hero}
        </AnimatedPressable>
      ) : (
        hero
      )}

      {tending && (
        <ActionSheet
          title={tending.userId === userId ? 'Your plant' : tending.name}
          message={`${tending.stage === 'wilted' ? 'Needs water' : 'Growing'} · ${
            tending.streak > 0 ? `${tending.streak}-day streak` : 'no streak yet'
          }${loggedToday.has(tending.userId) ? ' · checked in today' : ''}`}
          options={tendOptions(tending)}
          onCancel={() => setTending(null)}
          cancelLabel="Close"
        />
      )}
    </Animated.View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { colors, garden, radii, spacing, type, touch, shadow } = theme;
  return StyleSheet.create({
    hero: {
      borderRadius: radii.hero,
      overflow: 'hidden',
      marginBottom: spacing.lg,
      ...shadow,
    },
    heroTend: { marginBottom: spacing.xl },
    weather: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.lg,
    },
    plantRow: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'flex-end',
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.hero,
    },
    dormant: { alignItems: 'center', paddingTop: spacing.hero },
    plantSlot: {
      alignItems: 'center',
      minWidth: touch.min + 16,
      minHeight: touch.min,
      justifyContent: 'flex-end',
    },
    plantWilted: { opacity: 0.7 },
    plantName: {
      ...type.caption,
      fontWeight: '600',
      color: colors.textPrimary,
      marginTop: spacing.xs,
      maxWidth: 72,
    },
    plantNameSelf: { fontWeight: '800', color: colors.primary },
    plantStreak: { ...type.caption, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
    // A soft ground shadow instead of the old edge-to-edge 14px brown bar,
    // which split the card into disconnected slabs.
    soil: {
      height: 6,
      backgroundColor: garden.soil,
      opacity: 0.25,
      marginTop: spacing.sm,
      marginHorizontal: spacing.xl,
      borderRadius: 3,
    },
    footer: {
      backgroundColor: colors.surface,
      padding: spacing.xl,
      paddingTop: spacing.lg,
      gap: spacing.xs,
    },
    title: { ...type.subheading, fontWeight: '700', color: colors.textPrimary },
    status: { ...type.body, color: colors.textPrimary },
    statusMeta: { ...type.secondary, fontWeight: '600', color: colors.textSecondary },
  });
}
