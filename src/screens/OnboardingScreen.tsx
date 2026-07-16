import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signIn, signUp } from '../lib/auth';
import { useAuthStore } from '../state/useAuthStore';
import { useCreateCircle, useJoinCircle, useMyCircles } from '../hooks/useCircles';
import { GradientHeader } from '../components/GradientHeader';
import { Mascot } from '../components/Mascot';
import { AppTextInput } from '../components/AppTextInput';
import { PillButton } from '../components/PillButton';
import { colors } from '../theme/colors';

function AuthStep() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signUp') {
        await signUp(email.trim(), password, name.trim());
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      {mode === 'signUp' && (
        <AppTextInput label="Name" autoCapitalize="words" value={name} onChangeText={setName} placeholder="Your name" />
      )}
      <AppTextInput
        label="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
      />
      <AppTextInput
        label="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <PillButton
        label={mode === 'signUp' ? 'Sign up' : 'Sign in'}
        onPress={handleSubmit}
        loading={submitting}
        style={{ marginTop: 8 }}
      />

      <TouchableOpacity onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}>
        <Text style={styles.link}>
          {mode === 'signUp' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function CircleStep() {
  const userId = useAuthStore((state) => state.user?.id);
  const setActiveCircleId = useAuthStore((state) => state.setActiveCircleId);
  const { data: circles } = useMyCircles(userId);
  const createCircle = useCreateCircle();
  const joinCircle = useJoinCircle();

  const [circleName, setCircleName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (circles && circles.length > 0) {
      setActiveCircleId(circles[0].id);
    }
  }, [circles, setActiveCircleId]);

  async function handleCreate() {
    setError(null);
    try {
      const circle = await createCircle.mutateAsync(circleName.trim());
      setActiveCircleId(circle.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create circle');
    }
  }

  async function handleJoin() {
    setError(null);
    try {
      const circle = await joinCircle.mutateAsync(inviteCode.trim());
      setActiveCircleId(circle.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join circle');
    }
  }

  return (
    <View style={styles.form}>
      <AppTextInput label="Circle name" value={circleName} onChangeText={setCircleName} placeholder="The Grind Squad" />
      <PillButton
        label="Create Circle"
        onPress={handleCreate}
        loading={createCircle.isPending}
        disabled={!circleName.trim()}
      />

      <Text style={styles.orDivider}>or</Text>

      <AppTextInput
        label="Invite code"
        autoCapitalize="none"
        value={inviteCode}
        onChangeText={setInviteCode}
        placeholder="8-character code"
      />
      <PillButton
        label="Join Circle"
        variant="outline"
        onPress={handleJoin}
        loading={joinCircle.isPending}
        disabled={!inviteCode.trim()}
      />

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export default function OnboardingScreen() {
  const user = useAuthStore((state) => state.user);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <GradientHeader>
            <Mascot size={110} />
            <Text style={styles.title}>{user ? 'Growth Circle' : 'Kinly'}</Text>
            <Text style={styles.subtitle}>
              {user ? '2-10 trusted friends. Invite-only.' : 'Grow Together. Every Day.'}
            </Text>
          </GradientHeader>

          <View style={styles.body}>{user ? <CircleStep /> : <AuthStep />}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: 24, paddingTop: 28 },
  form: { gap: 14 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 12 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  link: { textAlign: 'center', marginTop: 4, color: colors.primary, fontWeight: '600' },
  orDivider: { textAlign: 'center', color: colors.textSecondary },
  error: { color: colors.danger, textAlign: 'center' },
});
