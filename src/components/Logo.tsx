import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface LogoProps {
  size?: number;
  color?: string;
  background?: string;
}

// A friendly face - two eyes and a smile. This is the retired original Kinly
// mark, kept only as the Profile/Edit Profile avatar placeholder; the current
// brand logo (two people linking arms) lives in assets/brand/logo-master.png.
// Inline vectors so it stays crisp at any size and can be recolored per
// surface (white on a gradient header, brand color on a light background).
export function Logo({ size = 48, color = '#FFFFFF', background }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {background && <Rect x={0} y={0} width={200} height={200} rx={42} fill={background} />}
      <Circle cx={72} cy={70} r={11} fill={color} />
      <Circle cx={128} cy={70} r={11} fill={color} />
      <Path d="M55,108 C55,145 82,163 100,150" fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" />
      <Path d="M145,108 C145,145 118,163 100,150" fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" />
      <Circle cx={100} cy={150} r={7} fill={color} />
    </Svg>
  );
}
