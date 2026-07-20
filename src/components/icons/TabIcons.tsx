import { Image } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

// The real brand mark's own aspect ratio (see OnboardingScreen.tsx) - the
// source glyph is wider than tall, so PeopleTabIcon can't force a square
// box without squishing it.
const BRAND_MARK = require('../../../assets/brand/logo-white-glyph.png');
const BRAND_MARK_RATIO = 676 / 525;

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

// Renders the actual brand mark (tinted per active/inactive state via
// RN's Image tintColor, same recolor behavior the other tab icons get
// from their `color` prop) instead of the old "friendly face" family the
// rest of this file still uses - Circle is the one tab that maps directly
// onto the brand's own "two people together" mark, so it's worth being
// literal here rather than matching the sibling icons' geometry family.
export function PeopleTabIcon({ size = 22, color }: TabIconProps) {
  return (
    <Image
      source={BRAND_MARK}
      resizeMode="contain"
      style={{ width: size * BRAND_MARK_RATIO, height: size, tintColor: color }}
    />
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
