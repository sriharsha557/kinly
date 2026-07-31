import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

// Theme-tinted walkthrough illustrations (design/PRINCIPLES.md "Open work"):
// replaces the static clip-art SVGs in assets/illustrations/ for the
// tutorial and circle-welcome carousels. Same prop-driven pattern as
// MonoIcons/PillarIcons, scaled up: one shared stroke weight, ink outlines
// from the neutral ramp, the user's accent for focal elements, and the
// fixed garden palette (theme.garden) for nature elements - so the scenes
// re-tint live with the accent and scheme like every other surface.

interface SceneProps {
  size?: number;
}

// Shared drawing constants: 200-unit canvas, 5-unit stroke (~= MonoIcons'
// 1.7 at 24 units), soft circular backdrop so scenes fill their slot.
const STROKE = 5;

function useScenePalette() {
  const theme = useTheme();
  return {
    ink: theme.colors.textPrimary,
    accent: theme.colors.primary,
    accentFill: theme.colors.inputBg,
    backdrop: theme.colors.surfaceSubtle,
    surface: theme.colors.surface,
    leaf: theme.garden.leaf,
    leafDeep: theme.garden.leafDeep,
    soil: theme.garden.soil,
    gold: theme.garden.bloomGold,
    bloom: theme.garden.bloomWarm,
  };
}

// "Invite 2-10 people you trust" - two figures side by side, a seedling
// growing between them.
export function CircleScene({ size = 200 }: SceneProps) {
  const p = useScenePalette();
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Circle cx={100} cy={100} r={88} fill={p.backdrop} />
      {/* back figure */}
      <Circle cx={124} cy={76} r={17} fill={p.accentFill} stroke={p.ink} strokeWidth={STROKE} />
      <Path
        d="M96,142 C96,116 110,100 124,100 C138,100 152,116 152,142 Z"
        fill={p.accentFill}
        stroke={p.ink}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* front figure */}
      <Circle cx={78} cy={86} r={19} fill={p.surface} stroke={p.ink} strokeWidth={STROKE} />
      <Path
        d="M46,150 C46,120 62,102 78,102 C94,102 110,120 110,150 Z"
        fill={p.surface}
        stroke={p.ink}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* ground + seedling between them */}
      <Path d="M42,150 L158,150" stroke={p.soil} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M136,150 L136,132" stroke={p.leafDeep} strokeWidth={STROKE} strokeLinecap="round" />
      <Path
        d="M136,138 C128,138 124,131 124,124 C131,124 136,130 136,138 Z"
        fill={p.leaf}
        stroke={p.leafDeep}
        strokeWidth={STROKE - 1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M136,134 C143,134 147,128 147,122 C141,122 136,127 136,134 Z"
        fill={p.leaf}
        stroke={p.leafDeep}
        strokeWidth={STROKE - 1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// "Everyone picks one goal" - a flag planted on a hill, morning sun out.
export function GoalScene({ size = 200 }: SceneProps) {
  const p = useScenePalette();
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Circle cx={100} cy={100} r={88} fill={p.backdrop} />
      {/* sun sits opposite the flag - at top-right it read as attached to
          the pennant rather than as a separate morning sun */}
      <Circle cx={52} cy={56} r={12} fill={p.gold} />
      {/* hill */}
      <Path
        d="M28,152 C52,112 84,100 100,100 C116,100 148,112 172,152 Z"
        fill={p.surface}
        stroke={p.ink}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* flag */}
      <Path d="M100,102 L100,44" stroke={p.ink} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M100,46 L136,58 L100,70 Z" fill={p.accent} stroke={p.accent} strokeWidth={3} strokeLinejoin="round" />
      {/* grass tufts */}
      <Path d="M66,136 C66,130 68,127 71,124" stroke={p.leafDeep} strokeWidth={STROKE - 1.5} strokeLinecap="round" />
      <Path d="M132,138 C132,132 130,129 127,126" stroke={p.leafDeep} strokeWidth={STROKE - 1.5} strokeLinecap="round" />
    </Svg>
  );
}

// "Check in daily" - a potted sprout being watered.
export function SproutScene({ size = 200 }: SceneProps) {
  const p = useScenePalette();
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Circle cx={100} cy={100} r={88} fill={p.backdrop} />
      {/* falling drop */}
      <Path
        d="M100,42 C106,52 111,57 111,64 A11,11 0 1 1 89,64 C89,57 94,52 100,42 Z"
        fill={p.accentFill}
        stroke={p.accent}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* sprout */}
      <Path d="M100,126 L100,96" stroke={p.leafDeep} strokeWidth={STROKE} strokeLinecap="round" />
      <Path
        d="M100,108 C86,108 79,97 79,86 C90,86 100,95 100,108 Z"
        fill={p.leaf}
        stroke={p.leafDeep}
        strokeWidth={STROKE - 1}
        strokeLinejoin="round"
      />
      <Path
        d="M100,102 C112,102 118,92 118,83 C108,83 100,91 100,102 Z"
        fill={p.leaf}
        stroke={p.leafDeep}
        strokeWidth={STROKE - 1}
        strokeLinejoin="round"
      />
      {/* pot */}
      <Rect x={70} y={124} width={60} height={12} rx={6} fill={p.surface} stroke={p.ink} strokeWidth={STROKE} />
      <Path
        d="M78,136 L122,136 L116,164 L84,164 Z"
        fill={p.surface}
        stroke={p.ink}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// "Watch your shared garden grow" - a full bloom on a ground line.
export function FlowerScene({ size = 200 }: SceneProps) {
  const p = useScenePalette();
  const petals = [
    { cx: 100, cy: 62 },
    { cx: 122, cy: 75 },
    { cx: 122, cy: 101 },
    { cx: 100, cy: 114 },
    { cx: 78, cy: 101 },
    { cx: 78, cy: 75 },
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Circle cx={100} cy={100} r={88} fill={p.backdrop} />
      {/* stem + leaves */}
      <Path d="M100,162 C100,144 100,130 100,112" stroke={p.leafDeep} strokeWidth={STROKE} strokeLinecap="round" />
      <Path
        d="M100,146 C86,146 78,136 78,126 C90,126 100,134 100,146 Z"
        fill={p.leaf}
        stroke={p.leafDeep}
        strokeWidth={STROKE - 1}
        strokeLinejoin="round"
      />
      <Path
        d="M100,138 C113,138 120,129 120,120 C109,120 100,127 100,138 Z"
        fill={p.leaf}
        stroke={p.leafDeep}
        strokeWidth={STROKE - 1}
        strokeLinejoin="round"
      />
      {/* petals + center */}
      {petals.map(({ cx, cy }) => (
        <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={14} fill={p.bloom} stroke={p.ink} strokeWidth={3} />
      ))}
      <Circle cx={100} cy={88} r={12} fill={p.gold} stroke={p.ink} strokeWidth={3} />
      <Path d="M58,164 L142,164" stroke={p.soil} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

// "Encourage each other" - two speech bubbles: a heart sent, a sprout
// growing back.
export function ChatScene({ size = 200 }: SceneProps) {
  const p = useScenePalette();
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Circle cx={100} cy={100} r={88} fill={p.backdrop} />
      {/* left bubble with heart */}
      <Path
        d="M40,60 L116,60 A14,14 0 0 1 130,74 L130,96 A14,14 0 0 1 116,110 L74,110 L56,126 L58,110 L40,110 A14,14 0 0 1 26,96 L26,74 A14,14 0 0 1 40,60 Z"
        fill={p.surface}
        stroke={p.ink}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Path
        d="M78,98 C70,91 62,85 62,77 C62,71 66,68 71,68 C74,68 77,70 78,73 C79,70 82,68 85,68 C90,68 94,71 94,77 C94,85 86,91 78,98 Z"
        fill={p.accent}
      />
      {/* right bubble with sprout */}
      <Path
        d="M96,118 L160,118 A13,13 0 0 1 173,131 L173,149 A13,13 0 0 1 160,162 L146,162 L148,177 L131,162 L96,162 A13,13 0 0 1 83,149 L83,131 A13,13 0 0 1 96,118 Z"
        fill={p.accentFill}
        stroke={p.ink}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Path d="M128,152 L128,138" stroke={p.leafDeep} strokeWidth={STROKE - 1} strokeLinecap="round" />
      <Path
        d="M128,142 C121,142 117,136 117,130 C123,130 128,135 128,142 Z"
        fill={p.leaf}
        stroke={p.leafDeep}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <Path
        d="M128,139 C134,139 138,133 138,128 C133,128 128,132 128,139 Z"
        fill={p.leaf}
        stroke={p.leafDeep}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// "Ready when you are" - a rocket lifting off (tutorial finale).
export function RocketScene({ size = 200 }: SceneProps) {
  const p = useScenePalette();
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Circle cx={100} cy={100} r={88} fill={p.backdrop} />
      {/* fins */}
      <Path d="M79,104 L54,136 L80,130 Z" fill={p.accent} stroke={p.accent} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M121,104 L146,136 L120,130 Z" fill={p.accent} stroke={p.accent} strokeWidth={3} strokeLinejoin="round" />
      {/* body */}
      <Path
        d="M100,34 C120,56 128,88 122,126 L78,126 C72,88 80,56 100,34 Z"
        fill={p.surface}
        stroke={p.ink}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Circle cx={100} cy={82} r={12} fill={p.accentFill} stroke={p.ink} strokeWidth={STROKE} />
      {/* flame - starts at the hull line so it reads as thrust, not a
          detached teardrop */}
      <Path
        d="M100,126 C109,138 111,148 100,166 C89,148 91,138 100,126 Z"
        fill={p.gold}
        stroke={p.gold}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* drifting sparks */}
      <Circle cx={58} cy={68} r={3.5} fill={p.accent} />
      <Circle cx={144} cy={60} r={3.5} fill={p.gold} />
    </Svg>
  );
}
