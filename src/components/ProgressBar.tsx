import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

export function ProgressBar({ progress, target }: { progress: number; target: number }) {
  const pct = target > 0 ? Math.min(1, progress / target) : 0;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.inputBg,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
});
