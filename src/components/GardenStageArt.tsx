import type { FC } from 'react';
import { Text } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import SproutSoil from '../../assets/illustrations/kinly-ill-sprout-soil.svg';
import Bud from '../../assets/illustrations/kinly-ill-bud.svg';
import SmallTree from '../../assets/illustrations/kinly-ill-small-tree.svg';
import Flower from '../../assets/illustrations/kinly-ill-flower.svg';
import type { GardenStage } from '../hooks/useGarden';

// seed -> sprout -> tree -> bloom each have custom art. "wilted" doesn't yet -
// see ARCHITECTURE.md illustration notes. Falls back to the emoji until one exists.
const STAGE_ART: Partial<Record<GardenStage, FC<SvgProps>>> = {
  seed: SproutSoil,
  sprout: Bud,
  tree: SmallTree,
  bloom: Flower,
};

const WILTED_EMOJI = '🥀';

export function GardenStageArt({ stage, size = 32 }: { stage: GardenStage; size?: number }) {
  const Art = STAGE_ART[stage];
  if (!Art) return <Text style={{ fontSize: size * 0.8 }}>{WILTED_EMOJI}</Text>;
  return <Art width={size} height={size} />;
}
