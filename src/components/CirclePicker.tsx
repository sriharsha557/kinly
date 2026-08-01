import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { ActionSheet } from './ActionSheet';
import { useMyCircles } from '../hooks/useCircles';
import { useAuthStore } from '../state/useAuthStore';
import { useTheme } from '../theme/ThemeProvider';

// Which circle you are looking at, and how to change it - without leaving
// the screen you are on. Switching used to mean Home -> Circle -> pick ->
// back to Home, i.e. leaving the screen in order to change what it shows.
//
// One control, two sizes: a quiet chip above Home's greeting (context, not
// a headline - the greeting keeps that job) and the Circle tab's own title,
// where the circle's real name is more useful than the word "Circle" the
// tab bar already says.
export function CirclePicker({ variant }: { variant: 'chip' | 'title' }) {
  const userId = useAuthStore((state) => state.user?.id);
  const activeCircleId = useAuthStore((state) => state.activeCircleId);
  const setActiveCircleId = useAuthStore((state) => state.setActiveCircleId);
  const { data: circles } = useMyCircles(userId);
  const [picking, setPicking] = useState(false);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Pending members can't see anything circle-scoped yet, so switching to
  // one would land on an empty screen.
  const myCircles = (circles ?? []).filter((c) => c.membershipStatus === 'active');
  const active = myCircles.find((c) => c.id === activeCircleId);
  const isTitle = variant === 'title';

  if (!active) return null;

  return (
    <>
      <AnimatedPressable
        style={isTitle ? styles.titleRow : styles.chipRow}
        onPress={() => setPicking(true)}
        // A single circle has nothing to switch to, so the control stays
        // visible for identity but stops advertising an action.
        disabled={myCircles.length < 2}
        accessibilityRole="button"
        accessibilityLabel={`Active circle: ${active.name}. Switch circle.`}
      >
        <Text style={isTitle ? styles.titleText : styles.chipText} numberOfLines={1}>
          {active.name}
        </Text>
        {myCircles.length > 1 && (
          <Text style={isTitle ? styles.titleChevron : styles.chipChevron}>▾</Text>
        )}
      </AnimatedPressable>

      {picking && (
        <ActionSheet
          title="Switch circle"
          options={myCircles.map((circle) => ({
            label: circle.id === activeCircleId ? `${circle.name} · current` : circle.name,
            onPress: () => {
              setPicking(false);
              if (circle.id !== activeCircleId) setActiveCircleId(circle.id);
            },
          }))}
          onCancel={() => setPicking(false)}
        />
      )}
    </>
  );
}

function createStyles({ colors, radii, spacing }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    chipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      minHeight: 48,
      paddingRight: spacing.sm,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    // 13 is the type floor in design/PRINCIPLES.md; the glyph matches
    // DisclosureSection's, which is the established chevron in this app.
    chipChevron: { fontSize: 13, color: colors.textSecondary },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, flexShrink: 1 },
    titleText: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, flexShrink: 1 },
    titleChevron: { fontSize: 14, color: colors.textSecondary },
  });
}
