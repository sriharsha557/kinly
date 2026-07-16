import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AskFriendsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Ask Friends</Text>
      {/* TODO: post composer + reply thread for open asks */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700' },
});
