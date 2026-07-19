import Svg, { Circle, Path, Rect } from 'react-native-svg';

// Prop-driven versions of assets/icons/feed/{robot,sprout}.svg - needed
// wherever the icon sits on a colored gradient (WeeklyRecapCard,
// GardenTeaser) instead of the white card shell, where the raw
// hardcoded-orange .svg imports would have poor contrast. Same pattern as
// PillarIcons.tsx / TabIcons.tsx. assets/icons/nudges/water.svg is
// identical path data to pillars/health.svg, so HealthIcon (already
// prop-driven) covers the water-droplet case without a duplicate.

interface MonoIconProps {
  size?: number;
  color: string;
}

export function RobotIcon({ size = 20, color }: MonoIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12,6.5 L12,3.5" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={2.7} r={1.1} fill={color} />
      <Rect x={5} y={6.5} width={14} height={12.5} rx={4} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={9.3} cy={12.5} r={1.3} fill={color} />
      <Circle cx={14.7} cy={12.5} r={1.3} fill={color} />
      <Path d="M9.3,16.3 L9.3,17.8" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12,16.3 L12,17.8" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14.7,16.3 L14.7,17.8" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5,10.5 L2.8,10.5 L2.8,14" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M19,10.5 L21.2,10.5 L21.2,14" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SproutIcon({ size = 20, color }: MonoIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12,20.5 L12,11.5" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M12,14.5 C7.8,14.5 6.5,11 6.5,7.5 C10.7,7.5 12,10.5 12,14.5 Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12,12.3 C15.5,12.3 16.7,9.5 16.7,6.6 C13.2,6.6 12,9 12,12.3 Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
