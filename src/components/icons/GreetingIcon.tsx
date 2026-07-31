import Svg, { Circle, Path } from 'react-native-svg';
import { timeOfDay, type TimeOfDay } from '../../lib/greeting';

// The icon beside Today's greeting. Replaced assets/icons/feed/wave.svg -
// a waving hand whose two motion arcs read as wifi bars, and whose four
// separate finger outlines merged into a blob at its 22px render size.
// Hands need more room than that; a sun/moon stays legible and, unlike a
// wave, actually carries information (which the greeting text then names).
//
// Same 24-unit canvas / 1.7 stroke as MonoIcons and PillarIcons so weights
// match across the icon family at real render sizes.

interface GreetingIconProps {
  size?: number;
  color: string;
  // Injectable purely so screenshot tests / previews can pin a slot;
  // production callers let it read the clock.
  slot?: TimeOfDay;
}

const STROKE = 1.7;

function Sunrise({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* half-risen sun: the arc sits on the horizon rather than being
          clipped by it, so it reads as rising even at small sizes */}
      <Path
        d="M7.5,17.2 A4.5,4.5 0 0 1 16.5,17.2"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M3.2,17.2 L20.8,17.2" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M8,20.8 L16,20.8" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M12,10.4 L12,7.6" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M6.6,12.4 L5,10.8" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M17.4,12.4 L19,10.8" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

function Sun({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={4.2} stroke={color} strokeWidth={STROKE} />
      <Path d="M12,3.4 L12,5.1" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M12,18.9 L12,20.6" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M3.4,12 L5.1,12" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M18.9,12 L20.6,12" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M5.9,5.9 L7.1,7.1" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M16.9,16.9 L18.1,18.1" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M5.9,18.1 L7.1,16.9" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M16.9,7.1 L18.1,5.9" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

function Moon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* crescent formed by subtracting one disc from another - a thick,
          rounded crescent survives small sizes better than a thin sliver */}
      <Path
        d="M20.4,13.4 A8.7,8.7 0 1 1 10.6,3.6 A6.8,6.8 0 0 0 20.4,13.4 Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function GreetingIcon({ size = 22, color, slot }: GreetingIconProps) {
  const when = slot ?? timeOfDay();
  if (when === 'morning') return <Sunrise size={size} color={color} />;
  if (when === 'evening') return <Moon size={size} color={color} />;
  return <Sun size={size} color={color} />;
}
