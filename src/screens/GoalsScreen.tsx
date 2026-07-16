import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GoalsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Goals</Text>
      {/* TODO: progress bars + streaks for personal goals, add-goal form */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700' },
});
