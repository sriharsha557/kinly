import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Plant } from './Plant';
import { GardenStageArt } from '../GardenStageArt';
import type { MemberGardenState } from '../../hooks/useGarden';
import { useTheme } from '../../theme/ThemeProvider';
import { motion } from '../../theme/colors';

// The row of plants, plus the soil line under it. Sizing lives here because
// it is a property of the row rather than of any one plant: plants shrink as
// circles grow (2-10 members), and past 6 the row scrolls.
export function PlantRow({
  members,
  selfId,
  animate,
}: {
  members: MemberGardenState[];
  selfId: string | undefined;
  animate: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const artSize = members.length > 6 ? 44 : members.length > 4 ? 52 : 64;

  return (
    <>
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
              entering={
                reducedMotion
                  ? undefined
                  : FadeInDown.duration(motion.duration.entrance).delay(index * motion.stagger.step)
              }
            >
              <Plant
                member={member}
                isSelf={member.userId === selfId}
                artSize={artSize}
                animate={animate}
              />
            </Animated.View>
          ))}
        </ScrollView>
      )}

      <View style={styles.soil} />
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const { garden, spacing } = theme;
  return StyleSheet.create({
    plantRow: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'flex-end',
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.hero,
    },
    dormant: { alignItems: 'center', paddingTop: spacing.hero },
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
  });
}
