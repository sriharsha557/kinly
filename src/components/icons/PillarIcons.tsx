import Svg, { Circle, Path } from 'react-native-svg';

// Prop-driven versions of assets/icons/pillars/*.svg (hand-drawn line icons,
// hardcoded to brand orange) - InterestPicker needs these to flip to white
// when a chip is selected (solid category-color background), the same
// reason TabIcons.tsx exists instead of using raw SVG imports there.

interface PillarIconProps {
  size?: number;
  color: string;
}

export function HealthIcon({ size = 22, color }: PillarIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12,3.5 C15,8 18,12 18,15.5 C18,19.1 15.3,21 12,21 C8.7,21 6,19.1 6,15.5 C6,12 9,8 12,3.5 Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function WealthIcon({ size = 22, color }: PillarIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={4.3} r={1.2} fill={color} />
      <Path d="M9.5,7.5 C8,7.5 6.8,6 8,4.6" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14.5,7.5 C16,7.5 17.2,6 16,4.6" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M8.5,8.5 C6.8,10.5 6,12.7 6,15.3 C6,18.6 8.7,21 12,21 C15.3,21 18,18.6 18,15.3 C18,12.7 17.2,10.5 15.5,8.5 Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12,10.3 L12,17.3" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M10.2,11.8 C10.2,10.9 11,10.3 12,10.3 C13,10.3 13.8,10.9 13.8,11.8 C13.8,12.7 13,13.3 12,13.3 C11,13.3 10.2,13.9 10.2,14.8 C10.2,15.7 11,16.3 12,16.3 C13,16.3 13.8,15.7 13.8,14.8"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IdeasIcon({ size = 22, color }: PillarIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.2,14.8 C6.6,13.4 5.6,11.4 5.6,9.2 C5.6,5.5 8.5,2.5 12,2.5 C15.5,2.5 18.4,5.5 18.4,9.2 C18.4,11.4 17.4,13.4 15.8,14.8 L15.8,17.3 L8.2,17.3 Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9.3,20 L14.7,20" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9.7,22 L14.3,22" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M10.3,10 C10.3,8.6 11,7.6 12,7.6 C13,7.6 13.5,8.4 13.2,9.2 C13,9.8 12,10 12,11.5"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LearningIcon({ size = 22, color }: PillarIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12,7.3 C10.2,5.7 7.7,4.8 5.3,4.8 C4.6,4.8 4,5.4 4,6.1 L4,16.6 C4,17.3 4.6,17.8 5.3,17.8 C7.7,17.8 10.2,18.7 12,20.3"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12,7.3 C13.8,5.7 16.3,4.8 18.7,4.8 C19.4,4.8 20,5.4 20,6.1 L20,16.6 C20,17.3 19.4,17.8 18.7,17.8 C16.3,17.8 13.8,18.7 12,20.3"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12,7.3 L12,20.3" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function RelationshipsIcon({ size = 22, color }: PillarIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12,20.3 C12,20.3 4.3,14.8 4.3,9.4 C4.3,6.5 6.6,4.3 9.3,4.3 C10.7,4.3 12,5 12,6.5 C12,5 13.3,4.3 14.7,4.3 C17.4,4.3 19.7,6.5 19.7,9.4 C19.7,14.8 12,20.3 12,20.3 Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
