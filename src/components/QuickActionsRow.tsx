import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, shadow } from '../theme/colors';
import type { MainTabParamList } from '../navigation/types';

const ACTIONS: { label: string; emoji: string; tab: keyof MainTabParamList }[] = [
  { label: 'Check In', emoji: '✅', tab: 'Goals' },
  { label: 'Ask Friends', emoji: '💬', tab: 'Connection' },
  { label: 'Start Challenge', emoji: '🚀', tab: 'Circle' },
];

export function QuickActionsRow() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  return (
    <View style={styles.row}>
      {ACTIONS.map(({ label, emoji, tab }) => (
        <TouchableOpacity key={tab} style={styles.action} onPress={() => navigation.navigate(tab)}>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={styles.label}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  action: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
    ...shadow,
  },
  emoji: { fontSize: 20 },
  label: { fontSize: 11, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
});
