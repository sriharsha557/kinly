import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updatePassword } from '../lib/auth';
import { useAuthStore } from '../state/useAuthStore';
import { GradientHeader } from '../components/GradientHeader';
import { Logo } from '../components/Logo';
import { AppTextInput } from '../components/AppTextInput';
import { PillButton } from '../components/PillButton';
import { colors } from '../theme/colors';

export default function ResetPasswordScreen() {
  const setPasswordRecoveryMode = useAuthStore((state) => state.setPasswordRecoveryMode);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && password !== confirm;

  async function handleSave() {
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await updatePassword(password);
      setPasswordRecoveryMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <GradientHeader>
            <Logo size={100} color="#FFFFFF" />
            <Text style={styles.title}>Set a new password</Text>
            <Text style={styles.subtitle}>Choose a new password for your account.</Text>
          </GradientHeader>

          <View style={styles.body}>
            <View style={styles.form}>
              <AppTextInput
                label="New password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
              />
              <AppTextInput
                label="Confirm password"
                secureTextEntry
                value={confirm}
                onChangeText={setConfirm}
                placeholder="••••••••"
              />
              {mismatch && <Text style={styles.error}>Passwords do not match</Text>}
              {error && !mismatch && <Text style={styles.error}>{error}</Text>}

              <PillButton
                label="Save password"
                onPress={handleSave}
                loading={submitting}
                disabled={!password || !confirm}
                style={{ marginTop: 8 }}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: 24, paddingTop: 28 },
  form: { gap: 14 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 12, textAlign: 'center' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4, textAlign: 'center' },
  error: { color: colors.danger, textAlign: 'center' },
});
