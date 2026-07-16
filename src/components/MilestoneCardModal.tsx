import { Modal, Share, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Logo } from './Logo';
import { PillButton } from './PillButton';
import { gradients, radii } from '../theme/colors';

interface MilestoneCardModalProps {
  title: string;
  subtitle?: string;
  circleName?: string;
  onClose: () => void;
}

export function MilestoneCardModal({ title, subtitle, circleName, onClose }: MilestoneCardModalProps) {
  async function handleShare() {
    await Share.share({
      message: `${title}${circleName ? ` — with my Kinly circle "${circleName}"` : ''} 🎉`,
    });
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <LinearGradient colors={gradients.achievement} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Logo size={64} color="#FFFFFF" />
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          {circleName && <Text style={styles.circle}>{circleName}</Text>}
        </LinearGradient>
        <View style={styles.actions}>
          <PillButton label="Share" onPress={handleShare} style={{ flex: 1 }} />
          <PillButton label="Close" variant="outline" onPress={onClose} style={{ flex: 1 }} />
        </View>
      </View>
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
