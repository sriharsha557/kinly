import { Image, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

// The brand mark, not Logo.tsx's older "friendly face" glyph - that one
// predates the current mark and only survived here because the avatar
// placeholder was never reconciled with the rest of the brand pass
// (ARCHITECTURE.md's Brand note called this out as outstanding).
//
// logo-white-glyph.png is the adaptive-icon foreground trimmed to the
// glyph's own ink bounds, so it needs no padding compensation here. Its
// source is wider than tall, so forcing a square box would squash it -
// same reason PeopleTabIcon carries this ratio.
const BRAND_MARK = require('../../assets/brand/logo-white-glyph.png');
const BRAND_MARK_RATIO = 676 / 525;

// Shown wherever a member has no avatar of their own: an accent-filled
// circle with the mark knocked out of it in the on-accent ink, so it
// follows the user's chosen accent like every other filled surface.
export function AvatarPlaceholder({ size }: { size: number }) {
  const { colors } = useTheme();
  // The mark sits at ~52% of the circle so it reads as a badge with real
  // breathing room rather than a glyph crammed to the edges.
  const markWidth = Math.round(size * 0.52);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Image
        source={BRAND_MARK}
        style={{ width: markWidth, height: markWidth / BRAND_MARK_RATIO, tintColor: colors.onAccent }}
        resizeMode="contain"
      />
    </View>
  );
}
