import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requestPasswordReset, signIn, signInWithGoogle, signUp } from '../lib/auth';
import { useAuthStore } from '../state/useAuthStore';
import { useCreateCircle, useJoinCircle, useMyCircles } from '../hooks/useCircles';
import { useSetInterests } from '../hooks/useInterests';
import { inviteMessage, shareToWhatsApp } from '../lib/share';
import { GradientHeader } from '../components/GradientHeader';
import { Logo } from '../components/Logo';
import { AppTextInput } from '../components/AppTextInput';
import { PillButton } from '../components/PillButton';
import { InterestPicker } from '../components/InterestPicker';
import { colors, radii, shadow } from '../theme/colors';
import type { Circle, InterestCategory } from '../types/models';

function AuthStep() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  async function handleRequestReset() {
    setError(null);
    setResetSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset link');
    } finally {
      setResetSubmitting(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signUp') {
        const { session, user } = await signUp(email.trim(), password, name.trim());
        if (!session && user) {
          setAwaitingConfirmation(true);
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setGoogleSubmitting(false);
    }
  }

  if (awaitingConfirmation) {
    return (
      <View style={styles.form}>
        <Text style={styles.confirmTitle}>Check your email</Text>
        <Text style={styles.confirmBody}>
          We sent a confirmation link to {email.trim()}. Tap it, then come back and sign in.
        </Text>
        <PillButton
          label="Back to sign in"
          variant="outline"
          onPress={() => {
            setAwaitingConfirmation(false);
            setMode('signIn');
          }}
        />
      </View>
    );
  }

  if (forgotPasswordMode) {
    if (resetSent) {
      return (
        <View style={styles.form}>
          <Text style={styles.confirmTitle}>Check your email</Text>
          <Text style={styles.confirmBody}>
            If that email is registered, you'll receive a reset link shortly. Tap it to set a new password.
          </Text>
          <PillButton
            label="Back to sign in"
            variant="outline"
            onPress={() => {
              setForgotPasswordMode(false);
              setResetSent(false);
            }}
          />
        </View>
      );
    }
    return (
      <View style={styles.form}>
        <Text style={styles.confirmTitle}>Reset your password</Text>
        <Text style={styles.confirmBody}>Enter your email and we'll send you a reset link.</Text>
        <AppTextInput
          label="E-mail"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <PillButton
          label="Send reset link"
          onPress={handleRequestReset}
          loading={resetSubmitting}
          disabled={!email.trim()}
        />
        <TouchableOpacity onPress={() => setForgotPasswordMode(false)}>
          <Text style={styles.link}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    );
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

      {mode === 'signIn' && (
        <TouchableOpacity onPress={() => setForgotPasswordMode(true)} style={{ alignSelf: 'flex-end' }}>
          <Text style={styles.link}>Forgot password?</Text>
        </TouchableOpacity>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <PillButton
        label={mode === 'signUp' ? 'Sign up' : 'Sign in'}
        onPress={handleSubmit}
        loading={submitting}
        style={{ marginTop: 8 }}
      />

      <Text style={styles.orDivider}>or</Text>

      <PillButton
        label="Continue with Google"
        variant="outline"
        onPress={handleGoogleSignIn}
        loading={googleSubmitting}
      />

      <TouchableOpacity onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}>
        <Text style={styles.link}>
          {mode === 'signUp' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function InterestsStep() {
  const [selected, setSelected] = useState<InterestCategory[]>([]);
  const setInterests = useSetInterests();

  function toggle(key: InterestCategory) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <View style={styles.form}>
      <InterestPicker selected={selected} onToggle={toggle} />

      <PillButton
        label="Continue"
        onPress={() => setInterests.mutate(selected)}
        loading={setInterests.isPending}
        disabled={selected.length === 0}
      />
      <TouchableOpacity onPress={() => setInterests.mutate([])} disabled={setInterests.isPending}>
        <Text style={styles.link}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}

function InviteStep({ circle, onContinue }: { circle: Circle; onContinue: () => void }) {
  async function handleShareWhatsApp() {
    await shareToWhatsApp(inviteMessage(circle.name, circle.invite_code));
  }

  return (
    <View style={styles.form}>
      <View style={styles.inviteCard}>
        <Text style={styles.inviteLabel}>Invite code</Text>
        <Text style={styles.inviteCode}>{circle.invite_code}</Text>
      </View>
      <PillButton label="Invite via WhatsApp" onPress={handleShareWhatsApp} />
      <PillButton label="Continue to Kinly" variant="outline" onPress={onContinue} />
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
  const [createdCircle, setCreatedCircle] = useState<Circle | null>(null);

  useEffect(() => {
    if (!createdCircle && circles && circles.length > 0) {
      setActiveCircleId(circles[0].id);
    }
  }, [circles, createdCircle, setActiveCircleId]);

  async function handleCreate() {
    setError(null);
    try {
      const circle = await createCircle.mutateAsync(circleName.trim());
      setCreatedCircle(circle);
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

  if (createdCircle) {
    return <InviteStep circle={createdCircle} onContinue={() => setActiveCircleId(createdCircle.id)} />;
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
  const needsInterests = !!user && user.interests === null;

  let subtitle = 'Together, We Thrive.';
  if (user && needsInterests) subtitle = "What do you want to grow? Pick what matters to you.";
  else if (user) subtitle = 'Create or join your Growth Circle — 2-10 trusted friends, invite-only.';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <GradientHeader>
            <Logo size={100} color="#FFFFFF" />
            <Text style={styles.title}>Kinly</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </GradientHeader>

          <View style={styles.body}>
            {!user ? <AuthStep /> : needsInterests ? <InterestsStep /> : <CircleStep />}
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
  confirmTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  confirmBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  inviteCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 20,
    alignItems: 'center',
    ...shadow,
  },
  inviteLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  inviteCode: { fontSize: 28, fontWeight: '800', color: colors.primary, letterSpacing: 2, marginTop: 6 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 12 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  link: { textAlign: 'center', marginTop: 4, color: colors.primary, fontWeight: '600' },
  orDivider: { textAlign: 'center', color: colors.textSecondary },
  error: { color: colors.danger, textAlign: 'center' },
});
