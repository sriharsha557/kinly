import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CircleSettingsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Circle Settings</Text>
      {/* TODO: member list, role picker, invite link management */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700' },
});
