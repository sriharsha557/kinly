import { Modal, Share, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Logo } from './Logo';
import { PillButton } from './PillButton';
import { gradients, radii } from '../theme/colors';

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
  async function handleShare() {
    await Share.share({
      message: shareMessage ?? `${title}${circleName ? ` — with my Kinly circle "${circleName}"` : ''} 🎉`,
    });
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
        <Animated.View entering={ZoomIn.springify().damping(13).delay(80)}>
          <LinearGradient colors={gradients.achievement} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Animated.View entering={ZoomIn.springify().damping(10).delay(200)}>
              <Logo size={64} color="#FFFFFF" />
            </Animated.View>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            {circleName && <Text style={styles.circle}>{circleName}</Text>}
          </LinearGradient>
        </Animated.View>
        <Animated.View entering={FadeIn.duration(300).delay(250)} style={styles.actions}>
          <PillButton label={shareLabel ?? 'Share'} onPress={handleShare} style={{ flex: 1 }} />
          <PillButton label="Close" variant="outline" onPress={onClose} style={{ flex: 1 }} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  title: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', marginTop: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', textAlign: 'center' },
  circle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10 },
});
