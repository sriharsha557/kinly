import { fontFamily, spacing } from '../theme/colors';
import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { ActionSheet } from './ActionSheet';
import { useMyCircles } from '../hooks/useCircles';
import { useAuthStore } from '../state/useAuthStore';
import { useTheme } from '../theme/ThemeProvider';

// Which circle you are looking at is one job; changing it is another. This
// file does the second only.
//
// The first version merged them - the control WAS the circle's name, with a
// chevron beside it - and the affordance disappeared: a name that happens to
// be tappable reads as a label, so nobody found the switcher. So the button
// now says what it does, and CircleName renders the identity next to the
// thing it actually labels (the garden on Home, the health card on Circle).

// Returns the active circle, or null when there isn't one to show. Shared by
// both components below so the "which circle" question is answered once.
function useActiveCircle() {
  const userId = useAuthStore((state) => state.user?.id);
  const activeCircleId = useAuthStore((state) => state.activeCircleId);
  const { data: circles } = useMyCircles(userId);
  // Pending members can't see anything circle-scoped yet, so switching to
  // one would land on an empty screen.
  const myCircles = (circles ?? []).filter((c) => c.membershipStatus === 'active');
  return { myCircles, active: myCircles.find((c) => c.id === activeCircleId) ?? null };
}

// The circle's name, as a heading for whatever it describes. Not tappable -
// that is CirclePicker's job, and a heading that silently does something is
// the problem this split exists to fix.
export function CircleName({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { active } = useActiveCircle();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!active) return null;

  return (
    <Text style={size === 'sm' ? styles.nameSm : styles.nameMd} numberOfLines={1}>
      {active.name}
    </Text>
  );
}

// The switch control. Labelled by its action rather than its current value,
// and shaped as a pill so it reads as a button at a glance.
export function CirclePicker() {
  const setActiveCircleId = useAuthStore((state) => state.setActiveCircleId);
  const activeCircleId = useAuthStore((state) => state.activeCircleId);
  const { myCircles, active } = useActiveCircle();
  const [picking, setPicking] = useState(false);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // One circle has nothing to switch to, and CircleName already says which
  // one you are in - so the button would be a dead end. Hide it entirely.
  if (!active || myCircles.length < 2) return null;

  return (
    <>
      <AnimatedPressable
        style={styles.pill}
        onPress={() => setPicking(true)}
        accessibilityRole="button"
        accessibilityLabel={`Switch circle. Currently ${active.name}.`}
      >
        <Text style={styles.pillText}>Switch circle</Text>
        <Text style={styles.pillChevron}>▾</Text>
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

function createStyles({ colors, radii, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    // surfaceSubtle, not the accent: this is navigation between contexts, not
    // the screen's primary action (design/PRINCIPLES.md's one-accent rule).
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceSubtle,
    },
    pillText: { ...type.caption, fontFamily: fontFamily.bold, color: colors.textSecondary },
    // Raw size on purpose: a bare glyph, sized to its control rather than
    // to the type hierarchy - the token would also impose a lineHeight it
    // has never had, shifting it off-centre in a tight container.
    pillChevron: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.textSecondary },
    // md heads the garden on Home; sm heads the health card on Circle, where
    // it sits under the header rather than acting as the screen title.
    nameMd: { ...type.heading, fontFamily: fontFamily.bold, color: colors.textPrimary, marginBottom: spacing.sm },
    nameSm: { ...type.subheading, fontFamily: fontFamily.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  });
}
