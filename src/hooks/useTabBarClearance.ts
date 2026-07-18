import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_MARGIN = 12;
export const TAB_BAR_MIN_BOTTOM = 20;

// Mirrors MainTabs' own floating-pill positioning so scrollable screen
// content reserves exactly enough space to clear it, on both gesture
// navigation and Android's much taller 3-button nav bar.
export function useTabBarClearance(extra = 26): number {
  const insets = useSafeAreaInsets();
  const tabBarBottom = Math.max(TAB_BAR_MIN_BOTTOM, insets.bottom + TAB_BAR_MARGIN);
  return tabBarBottom + TAB_BAR_HEIGHT + extra;
}
