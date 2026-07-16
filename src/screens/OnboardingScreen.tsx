import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Kinly</Text>
      <Text style={styles.subtitle}>Grow Together. Every Day.</Text>
      {/* TODO: auth form (sign up / sign in) + invite-code entry to create or join a Circle */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 16, marginTop: 8, opacity: 0.7 },
});
