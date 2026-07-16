import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signIn, signUp } from '../lib/auth';
import { useAuthStore } from '../state/useAuthStore';
import { useCreateCircle, useJoinCircle, useMyCircles } from '../hooks/useCircles';

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
    <View style={styles.step}>
      <Text style={styles.title}>Kinly</Text>
      <Text style={styles.subtitle}>Grow Together. Every Day.</Text>

      {mode === 'signUp' && (
        <TextInput
          style={styles.input}
          placeholder="Your name"
          autoCapitalize="words"
          value={name}
          onChangeText={setName}
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{mode === 'signUp' ? 'Sign up' : 'Sign in'}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}>
        <Text style={styles.link}>
          {mode === 'signUp' ? 'Already have an account? Sign in' : "New here? Create an account"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function CircleStep() {
  const userId = useAuthStore((state) => state.user?.id);
  const setActiveCircleId = useAuthStore((state) => state.setActiveCircleId);
  const { data: circles, isLoading } = useMyCircles(userId);
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

  if (isLoading) {
    return (
      <View style={styles.step}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.step}>
      <Text style={styles.title}>Start a Growth Circle</Text>
      <Text style={styles.subtitle}>2-10 trusted friends. Invite-only.</Text>

      <TextInput
        style={styles.input}
        placeholder="Circle name"
        value={circleName}
        onChangeText={setCircleName}
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleCreate}
        disabled={createCircle.isPending || !circleName.trim()}
      >
        <Text style={styles.buttonText}>Create Circle</Text>
      </TouchableOpacity>

      <Text style={styles.orDivider}>or</Text>

      <TextInput
        style={styles.input}
        placeholder="Invite code"
        autoCapitalize="none"
        value={inviteCode}
        onChangeText={setInviteCode}
      />
      <TouchableOpacity
        style={styles.buttonSecondary}
        onPress={handleJoin}
        disabled={joinCircle.isPending || !inviteCode.trim()}
      >
        <Text style={styles.buttonSecondaryText}>Join Circle</Text>
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export default function OnboardingScreen() {
  const user = useAuthStore((state) => state.user);
  return <SafeAreaView style={styles.container}>{user ? <CircleStep /> : <AuthStep />}</SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  step: { paddingHorizontal: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 16, opacity: 0.7, textAlign: 'center', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#FF6B5A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#FF6B5A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonSecondaryText: { color: '#FF6B5A', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', marginTop: 8, color: '#FF6B5A' },
  orDivider: { textAlign: 'center', opacity: 0.5 },
  error: { color: '#c0392b', textAlign: 'center' },
});
