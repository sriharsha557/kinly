import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';
import Wilted from '../../assets/illustrations/kinly-ill-wilted.svg';
import SproutSoil from '../../assets/illustrations/kinly-ill-sprout-soil.svg';
import Bud from '../../assets/illustrations/kinly-ill-bud.svg';
import SmallTree from '../../assets/illustrations/kinly-ill-small-tree.svg';
import Flower from '../../assets/illustrations/kinly-ill-flower.svg';
import type { GardenStage } from '../hooks/useGarden';

const STAGE_ART: Record<GardenStage, FC<SvgProps>> = {
  wilted: Wilted,
  seed: SproutSoil,
  sprout: Bud,
  tree: SmallTree,
  bloom: Flower,
};

export function GardenStageArt({ stage, size = 32 }: { stage: GardenStage; size?: number }) {
  const Art = STAGE_ART[stage];
  return <Art width={size} height={size} />;
}
