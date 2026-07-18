import Svg, { Circle, Path } from 'react-native-svg';

// Same "friendly face" mark family as assets/icons/*.svg, reproduced as
// prop-driven react-native-svg primitives (like Logo.tsx) instead of raw
// SVG imports - the tab bar needs to dynamically tint icons gray/white,
// which a hardcoded-color SVG import can't do. viewBox origins below are
// each shifted from the source files' plain "0 0 200 200" to actually
// center the glyph's bounding box - the source assets had inconsistent
// padding, which read as icons sitting slightly high/low off-center.

interface TabIconProps {
  size?: number;
  color: string;
}

export function HomeTabIcon({ size = 22, color }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 5.5 200 200">
      <Circle cx={100} cy={38} r={9} fill={color} />
      <Path d="M28,100 L100,44 L172,100" fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M46,90 L46,168 C46,172 49,175 53,175 L147,175 C151,175 154,172 154,168 L154,90"
        fill="none"
        stroke={color}
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M84,175 L84,130 C84,124 89,120 95,120 L105,120 C111,120 116,124 116,130 L116,175"
        fill="none"
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PeopleTabIcon({ size = 22, color }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 9.5 200 200">
      <Circle cx={72} cy={55} r={10} fill={color} />
      <Circle cx={128} cy={55} r={10} fill={color} />
      <Path d="M50,95 C50,140 80,162 100,148" fill="none" stroke={color} strokeWidth={15} strokeLinecap="round" />
      <Path d="M150,95 C150,140 120,162 100,148" fill="none" stroke={color} strokeWidth={15} strokeLinecap="round" />
      <Circle cx={100} cy={128} r={12} fill={color} />
      <Path d="M78,168 C78,150 122,150 122,168" fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" />
    </Svg>
  );
}

export function GoalsTabIcon({ size = 22, color }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Circle cx={100} cy={100} r={82} fill="none" stroke={color} strokeWidth={12} />
      <Circle cx={100} cy={100} r={54} fill="none" stroke={color} strokeWidth={12} />
      <Circle cx={84} cy={88} r={7} fill={color} />
      <Circle cx={116} cy={88} r={7} fill={color} />
      <Path d="M76,108 C76,120 88,128 100,122" fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />
      <Path d="M124,108 C124,120 112,128 100,122" fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />
    </Svg>
  );
}

export function ChatTabIcon({ size = 22, color }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 -6 200 200">
      <Path
        d="M100,20 C147,20 176,50 176,88 C176,126 147,156 100,156 C88,156 77,154 67,150 L38,168 L46,140 C24,126 24,50 67,26 C77,22 88,20 100,20 Z"
        fill="none"
        stroke={color}
        strokeWidth={11}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle cx={80} cy={80} r={8} fill={color} />
      <Circle cx={122} cy={80} r={8} fill={color} />
      <Path d="M68,108 C68,128 88,140 101,131" fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
      <Path d="M134,108 C134,128 114,140 101,131" fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
    </Svg>
  );
}

export function ProfileTabIcon({ size = 22, color }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Circle cx={100} cy={76} r={46} fill="none" stroke={color} strokeWidth={13} />
      <Circle cx={84} cy={70} r={7} fill={color} />
      <Circle cx={116} cy={70} r={7} fill={color} />
      <Path d="M76,90 C76,104 90,113 100,106" fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" />
      <Path d="M124,90 C124,104 110,113 100,106" fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" />
      <Path d="M30,178 C30,140 62,130 100,130 C138,130 170,140 170,178" fill="none" stroke={color} strokeWidth={13} strokeLinecap="round" />
    </Svg>
  );
}
