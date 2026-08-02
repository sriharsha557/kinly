import { AnimatedPressable } from '../components/AnimatedPressable';
import { fontFamily, spacing } from '../theme/colors';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requestPasswordReset, signIn, signInWithApple, signInWithGoogle, signUp } from '../lib/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from '../state/useAuthStore';
import { useCreateCircle, useJoinCircle, useMyCircles } from '../hooks/useCircles';
import { useSetInterests } from '../hooks/useInterests';
import { inviteMessage, shareToWhatsApp } from '../lib/share';
import { GradientHeader } from '../components/GradientHeader';
import { AppTextInput } from '../components/AppTextInput';
import { PillButton } from '../components/PillButton';
import { InterestPicker } from '../components/InterestPicker';
import { ThemePicker } from '../components/ThemePicker';
import { useThemeStore } from '../state/useThemeStore';
import { setThemePrefs } from '../lib/themePrefs';
import { useTheme } from '../theme/ThemeProvider';
import { useHealthSync } from '../hooks/useHealthSync';
import { useHealthSyncStore } from '../state/useHealthSyncStore';
import type { Circle, InterestCategory } from '../types/models';

// The real brand mark (two people, an infinity/hands-reaching shape) -
// replaces Logo.tsx's older "friendly face" primitive here, which never
// got reconciled with the rest of the brand pass. Pre-cropped to its own
// ink bounding box (source is an Android adaptive-icon foreground layer,
// padded for that use) so it displays at full visual weight instead of
// looking small inside leftover safe-zone padding.
const BRAND_MARK = require('../../assets/brand/logo-white-glyph.png');
const BRAND_MARK_RATIO = 676 / 525;

function AuthStep() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [appleSubmitting, setAppleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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

  async function handleAppleSignIn() {
    if (appleSubmitting) return;
    setError(null);
    setAppleSubmitting(true);
    try {
      await signInWithApple();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apple sign-in failed');
    } finally {
      setAppleSubmitting(false);
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
            {"If that email is registered, you'll receive a reset link shortly. Tap it to set a new password."}
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
        <Text style={styles.confirmBody}>{"Enter your email and we'll send you a reset link."}</Text>
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
        <AnimatedPressable
      accessibilityRole="button" onPress={() => setForgotPasswordMode(false)}>
          <Text style={styles.link}>Back to sign in</Text>
        </AnimatedPressable>
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
        <AnimatedPressable
      accessibilityRole="button" onPress={() => setForgotPasswordMode(true)} style={{ alignSelf: 'flex-end' }}>
          <Text style={styles.link}>Forgot password?</Text>
        </AnimatedPressable>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <PillButton
        label={mode === 'signUp' ? 'Sign up' : 'Sign in'}
        onPress={handleSubmit}
        loading={submitting}
        style={{ marginTop: spacing.sm }}
      />

      <Text style={styles.orDivider}>or</Text>

      <PillButton
        label="Continue with Google"
        variant="outline"
        onPress={handleGoogleSignIn}
        loading={googleSubmitting}
      />

      {/* Apple's own HIG requires their branded button component here, not
          a custom-styled one - see App Store Guideline 4.8: mandatory the
          moment another third-party login (Google, above) exists. iOS only;
          the native module is a no-op on Android. */}
      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={999}
          style={styles.appleButton}
          onPress={handleAppleSignIn}
        />
      )}

      <AnimatedPressable
      accessibilityRole="button" onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}>
        <Text style={styles.link}>
          {mode === 'signUp' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </Text>
      </AnimatedPressable>

      {mode === 'signUp' && (
        <Text style={styles.legalNote}>
          By creating an account you agree to our{' '}
          <Text
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://sriharsha557.github.io/kinly/privacy.html')}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      )}
    </View>
  );
}

function InterestsStep() {
  const [selected, setSelected] = useState<InterestCategory[]>([]);
  const setInterests = useSetInterests();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
      <AnimatedPressable
      accessibilityRole="button" onPress={() => setInterests.mutate([])} disabled={setInterests.isPending}>
        <Text style={styles.link}>Skip for now</Text>
      </AnimatedPressable>
    </View>
  );
}

function ThemeStep() {
  // Changes apply to the live theme store immediately, so the whole
  // onboarding screen previews the pick in real time. Continue persists
  // the current picks; Skip persists the defaults - either way the
  // profile columns go non-null, which is what advances this step.
  const accent = useThemeStore((state) => state.accent);
  const mode = useThemeStore((state) => state.mode);
  const setAccent = useThemeStore((state) => state.setAccent);
  const setMode = useThemeStore((state) => state.setMode);
  const [saving, setSaving] = useState(false);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  async function finish(skip: boolean) {
    setSaving(true);
    try {
      if (skip) {
        setAccent('dusk');
        setMode('light');
        await setThemePrefs({ accent: 'dusk', mode: 'light' });
      } else {
        await setThemePrefs({ accent, mode });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <ThemePicker accent={accent} mode={mode} onChangeAccent={setAccent} onChangeMode={setMode} />
      <PillButton label="Continue" onPress={() => finish(false)} loading={saving} />
      <AnimatedPressable
      accessibilityRole="button" onPress={() => finish(true)} disabled={saving}>
        <Text style={styles.link}>Skip for now</Text>
      </AnimatedPressable>
    </View>
  );
}

function InviteStep({ circle, onContinue }: { circle: Circle; onContinue: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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

// Offered only where it can actually work - Android with Health Connect
// present - and only once. "Not now" is remembered, so a user who declines
// is never asked again on this device; Profile is where they change their
// mind.
function HealthStep() {
  const { connect, decline, isBusy, permissionDenied, openSettings } = useHealthSync();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.form}>
      <Text style={styles.confirmTitle}>Count your steps for you?</Text>
      <Text style={styles.confirmBody}>
        {permissionDenied
          ? // Without this the step said nothing at all when a user denied:
            // connect() returned false, the decision stayed null, and the
            // screen simply did not change. Android auto-denies silently
            // after two refusals, so further taps looked broken too - the
            // exact "a denial must not look like nothing happening" failure
            // this feature exists to avoid.
            "Kinly doesn't have permission to read your steps. You can grant it in Health Connect, or skip this — it changes nothing else."
          : 'Kinly can read your daily step count from Health Connect, so walking goals log themselves.'}
      </Text>
      {permissionDenied ? (
        <PillButton label="Open Health Connect" onPress={() => void openSettings()} />
      ) : (
        <PillButton label="Connect" onPress={() => void connect()} loading={isBusy} />
      )}
      <PillButton label={permissionDenied ? 'Skip' : 'Not now'} variant="outline" onPress={decline} />
    </View>
  );
}

function CircleStep() {
  const userId = useAuthStore((state) => state.user?.id);
  const setActiveCircleId = useAuthStore((state) => state.setActiveCircleId);
  const pendingInviteCode = useAuthStore((state) => state.pendingInviteCode);
  const setPendingInviteCode = useAuthStore((state) => state.setPendingInviteCode);
  const { data: circles } = useMyCircles(userId);
  const createCircle = useCreateCircle();
  const joinCircle = useJoinCircle();

  const [circleName, setCircleName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createdCircle, setCreatedCircle] = useState<Circle | null>(null);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!createdCircle && circles && circles.length > 0) {
      setActiveCircleId(circles[0].id);
    }
  }, [circles, createdCircle, setActiveCircleId]);

  // A kinly://join?code=... deep link (see useAuthDeepLink.ts) hands off
  // the code here instead of making someone retype it - consumed once,
  // then cleared so it doesn't reappear on a later, unrelated visit to
  // this screen.
  useEffect(() => {
    if (pendingInviteCode) {
      setInviteCode(pendingInviteCode);
      setPendingInviteCode(null);
    }
  }, [pendingInviteCode, setPendingInviteCode]);

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
      <Text style={styles.soloNote}>{"Start solo, invite friends when you're ready."}</Text>

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

// Only the two counted, post-auth steps get dots - signing in/up is a gate
// before the flow, not a step within it.
function StepDots({ step, total }: { step: number; total: number }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.stepDots}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.stepDot, i + 1 === step && styles.stepDotActive]} />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const user = useAuthStore((state) => state.user);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const needsInterests = !!user && user.interests === null;
  // Null = never chose (migration 0037's marker) - after interests so the
  // flow stays "what matters -> make it yours -> find your circle".
  const needsTheme = !!user && !needsInterests && user.theme_accent === null && user.theme_mode === null;

  // Only where it can work, and only once. hasHydrated matters: without it
  // a returning user who already declined would be asked again during the
  // moment before AsyncStorage resolves.
  const healthDecision = useHealthSyncStore((state) => state.decision);
  const healthHydrated = useHealthSyncStore((state) => state.hasHydrated);
  const { status: healthStatus } = useHealthSync();
  const needsHealth =
    !!user &&
    !needsInterests &&
    !needsTheme &&
    healthHydrated &&
    healthDecision === null &&
    healthStatus === 'available';

  let subtitle = 'Together, We Thrive.';
  if (user && needsInterests) subtitle = 'Pick what matters most today. You can change this anytime.';
  else if (user && needsTheme) subtitle = 'Make Kinly yours. You can change this anytime in Profile.';
  else if (user && needsHealth) subtitle = 'One less thing to remember. Optional, and changeable in Profile.';
  else if (user) subtitle = "Start solo, invite friends when you're ready, or join one with a code.";

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <GradientHeader>
            <Image source={BRAND_MARK} style={{ height: 92, width: 92 * BRAND_MARK_RATIO }} resizeMode="contain" />
            <Text style={styles.title}>Kinly</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </GradientHeader>

          <View style={styles.body}>
            {user && (
              <StepDots
                step={needsInterests ? 1 : needsTheme ? 2 : 3}
                total={needsHealth ? 4 : 3}
              />
            )}
            {!user ? (
              <AuthStep />
            ) : needsInterests ? (
              <InterestsStep />
            ) : needsTheme ? (
              <ThemeStep />
            ) : needsHealth ? (
              <HealthStep />
            ) : (
              <CircleStep />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles({ colors, radii, shadow, type }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    body: { padding: spacing.xxl, paddingTop: spacing.s28 },
    form: { gap: spacing.s14 },
    confirmTitle: { ...type.heading, fontFamily: fontFamily.bold, color: colors.textPrimary, textAlign: 'center' },
    confirmBody: { ...type.secondary, fontFamily: fontFamily.regular, color: colors.textSecondary, textAlign: 'center' },
    inviteCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.card,
      padding: spacing.xl,
      alignItems: 'center',
      ...shadow,
    },
    inviteLabel: { ...type.caption, color: colors.textSecondary, fontFamily: fontFamily.semibold },
    inviteCode: { ...type.title, fontFamily: fontFamily.bold, color: colors.primary, letterSpacing: 2, marginTop: spacing.s6 },
    title: { ...type.title, fontFamily: fontFamily.bold, color: colors.onAccent, marginTop: spacing.md },
    subtitle: { ...type.secondary, fontFamily: fontFamily.regular, color: colors.onAccentMuted, marginTop: spacing.xs },
    link: { textAlign: 'center', marginTop: spacing.xs, color: colors.primary, fontFamily: fontFamily.semibold },
    legalNote: { textAlign: 'center', marginTop: spacing.lg, ...type.caption, fontFamily: fontFamily.regular, color: colors.textSecondary, lineHeight: 17 },
    legalLink: { color: colors.primary, fontFamily: fontFamily.semibold, textDecorationLine: 'underline' },
    orDivider: { textAlign: 'center', color: colors.textSecondary },
    appleButton: { height: 50, marginTop: -2 },
    soloNote: { textAlign: 'center', ...type.caption, fontFamily: fontFamily.regular, color: colors.textSecondary, marginTop: -6 },
    error: { color: colors.danger, textAlign: 'center' },
    stepDots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.xxl },
    stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    stepDotActive: { backgroundColor: colors.primary, width: 20 },
  });
}
