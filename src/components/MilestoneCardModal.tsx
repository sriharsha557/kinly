import { useMemo } from 'react';
import { Image, Modal, Share, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { PillButton } from './PillButton';
import { useTheme } from '../theme/ThemeProvider';
import { motion } from '../theme/colors';

// Same brand mark used in OnboardingScreen's header - Logo.tsx's old
// "friendly face" primitive was still showing up here too.
const BRAND_MARK = require('../../assets/brand/logo-white-glyph.png');
const BRAND_MARK_RATIO = 676 / 525;

interface MilestoneCardModalProps {
  title: string;
  subtitle?: string;
  circleName?: string;
  onClose: () => void;
  // Overrides the default achievement-share text - used by the first-ever-
  // log celebration to share a real invite instead ("join my circle") -
  // and its button label ("Invite friends" instead of "Share").
  shareMessage?: string;
  shareLabel?: string;
}

export function MilestoneCardModal({
  title,
  subtitle,
  circleName,
  onClose,
  shareMessage,
  shareLabel,
}: MilestoneCardModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  async function handleShare() {
    await Share.share({
      message: shareMessage ?? `${title}${circleName ? ` — with my Kinly circle "${circleName}"` : ''} 🎉`,
    });
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(motion.duration.base)} style={styles.overlay}>
        <Animated.View entering={ZoomIn.springify().damping(motion.damping.pop).delay(80)}>
          <LinearGradient colors={theme.gradients.achievement} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Animated.View entering={ZoomIn.springify().damping(motion.damping.celebrate).delay(200)}>
              <Image source={BRAND_MARK} style={{ height: 56, width: 56 * BRAND_MARK_RATIO }} resizeMode="contain" />
            </Animated.View>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            {circleName && <Text style={styles.circle}>{circleName}</Text>}
          </LinearGradient>
        </Animated.View>
        <Animated.View entering={FadeIn.duration(motion.duration.entrance).delay(250)} style={styles.actions}>
          <PillButton label={shareLabel ?? 'Share'} onPress={handleShare} style={{ flex: 1 }} />
          <PillButton label="Close" variant="outline" onPress={onClose} style={{ flex: 1 }} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function createStyles({ colors, radii }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: 24,
      gap: 16,
    },
    card: {
      borderRadius: radii.card,
      padding: 32,
      alignItems: 'center',
      gap: 10,
    },
    title: { fontSize: 22, fontWeight: '800', color: colors.onAccent, textAlign: 'center', marginTop: 8 },
    subtitle: { fontSize: 14, color: colors.onAccentMuted, textAlign: 'center' },
    circle: { fontSize: 12, color: colors.onAccentFaint, marginTop: 8 },
    actions: { flexDirection: 'row', gap: 10 },
  });
}
