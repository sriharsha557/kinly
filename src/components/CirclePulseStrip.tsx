import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGardenState } from '../hooks/useGarden';
import { colors, radii, shadow } from '../theme/colors';
import type { MainTabParamList } from '../navigation/types';

// A one-line summary of Shared Garden's data, tappable through to the full
// Circle tab - keeps Feed a timeline while still surfacing "how's my circle
// doing" at a glance, per the original Circle Pulse idea.
export function CirclePulseStrip({ circleId }: { circleId: string }) {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { data } = useGardenState(circleId);

  if (!data || data.members.length === 0) return null;

  const bestStreak = Math.max(0, ...data.members.map((m) => m.streak));

  return (
    <TouchableOpacity style={styles.strip} onPress={() => navigation.navigate('Circle')}>
      <Text style={styles.text}>
        🌱 {data.health}% thriving {bestStreak > 0 ? `· 🔥 ${bestStreak}d best streak` : ''}
      </Text>
      <Text style={styles.arrow}>→</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    ...shadow,
  },
  text: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  arrow: { fontSize: 14, color: colors.primary, fontWeight: '700' },
});
