import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface LogoProps {
  size?: number;
  color?: string;
  background?: string;
}

// The Kinly mark: two figures climbing a shared path toward a star.
// Sourced from assets/brand/kinly-icon-source.svg (same glyph used for
// the app icon), reproduced here as vectors so it stays crisp at any
// size and can be recolored per surface (white on a gradient header,
// brand color on a light background, etc).
export function Logo({ size = 48, color = '#FFFFFF', background }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {background && <Rect x={0} y={0} width={100} height={100} rx={24} fill={background} />}
      <Path d="M72,12 L75,21 L84,24 L75,27 L72,36 L69,27 L60,24 L69,21 Z" fill={color} />
      <Path d="M20,86 C36,78 58,58 68,34" fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" />
      <Circle cx={32} cy={64} r={7.5} fill={color} />
      <Circle cx={52} cy={42} r={7.5} fill={color} />
    </Svg>
  );
}
