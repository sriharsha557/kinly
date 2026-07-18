import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const TAB_BAR_HEIGHT = 58;

// Mirrors MainTabs' own bar height so scrollable screen content reserves
// exactly enough space to clear it. The bar itself sits flush against the
// bottom edge with insets.bottom as internal padding, so its total on-screen
// footprint is TAB_BAR_HEIGHT + insets.bottom - same number used here.
export function useTabBarClearance(extra = 20): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + insets.bottom + extra;
}
