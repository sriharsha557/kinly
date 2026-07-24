import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import { supabase } from './supabase';
import { queryClient } from './queryClient';
import { asyncStoragePersister } from './persister';
import { unregisterPushNotifications } from './pushNotifications';
import { useAuthStore } from '../state/useAuthStore';
import { newPasswordSchema, resetRequestSchema, safeParse, signInSchema, signUpSchema } from './authValidation';
import { logValidationFailure, toSafeAuthMessage } from './authErrors';

const AUTH_CALLBACK_TTL_MS = 30 * 60 * 1000;

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    throw new Error('Google sign-in was cancelled');
  }

  const { params, errorCode } = getQueryParams(result.url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) throw new Error('Google sign-in did not return a session');

  const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
  if (sessionError) throw sessionError;
}

// Required the moment any other third-party login exists (App Store
// Guideline 4.8) - Google sign-in above is exactly that trigger. Uses
// Supabase's native signInWithIdToken path (the identity token Apple's own
// SDK returns), not the web-redirect OAuth flow signInWithGoogle() uses -
// Apple's native modal is the whole point, not a browser hop.
export async function signInWithApple() {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (err) {
    // Matches how a cancelled Google/photo-picker flow is treated elsewhere
    // in this file - a user backing out isn't a failure worth surfacing.
    if (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      return;
    }
    throw err;
  }

  if (!credential.identityToken) {
    throw new Error('Apple sign-in did not return an identity token');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
}

export async function signUp(email: string, password: string, name: string) {
  const parsed = safeParse(signUpSchema, { email, password, name });
  if (!parsed.data) throw new Error(logValidationFailure('signUp', parsed.reason));

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    // Without this, Supabase redirects the "Confirm your email" link to the
    // project's default Site URL (still localhost - nobody's pointed it at
    // the app) instead of back into Kinly. Same pattern as Google sign-in/
    // password reset below. Confirmation itself still succeeds server-side
    // either way - this only fixes where the link lands afterward.
    options: { data: { name: parsed.data.name }, emailRedirectTo: Linking.createURL('auth-callback') },
  });
  if (error) throw new Error(toSafeAuthMessage(error, 'signUp'));
  // No session means email confirmation is required - the confirmation link
  // will come back through completeEmailConfirmation() below, which only
  // trusts it while this flag is set. See useAuthStore's pendingAuthCallback
  // doc comment for why this exists.
  if (!data.session) {
    useAuthStore.getState().setPendingAuthCallback({ kind: 'confirm', expiresAt: Date.now() + AUTH_CALLBACK_TTL_MS });
  }
  return data;
}

export async function signIn(email: string, password: string) {
  const parsed = safeParse(signInSchema, { email, password });
  if (!parsed.data) throw new Error(logValidationFailure('signIn', parsed.reason));

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) throw new Error(toSafeAuthMessage(error, 'signIn'));
  return data;
}

// supabase-js fires the same 'SIGNED_OUT' auth event both for an explicit
// signOut() call and for an involuntary one (refresh token expired/invalid,
// so the client gives up and signs out locally) - this flag is how
// useBootstrapSession's onAuthStateChange listener tells them apart, so it
// only shows a "your session expired" message for the involuntary case.
let expectingSignOut = false;

export function markExpectedSignOut() {
  expectingSignOut = true;
}

export function consumeExpectedSignOut(): boolean {
  const was = expectingSignOut;
  expectingSignOut = false;
  return was;
}

// Shared by signOut() and deleteAccount() - clearing the query cache and
// unregistering this device's push token before the actual signOut() call
// stops a shared device from rendering/receiving the previous account's
// data (cached goals/mood check-ins, push notifications) for whoever signs
// in next. Needs the current user id, so it must run before Supabase's own
// signOut() clears the session.
async function cleanUpLocalAccountState() {
  const userId = useAuthStore.getState().user?.id;
  if (userId) await unregisterPushNotifications(userId);
  queryClient.clear();
  // clear() only empties the in-memory cache - the on-disk copy isn't
  // overwritten until the next persist cycle. removeClient() wipes it
  // immediately, so a shared device can't rehydrate the previous account's
  // data from AsyncStorage before that next cycle runs.
  await asyncStoragePersister.removeClient();
}

export async function signOut() {
  await cleanUpLocalAccountState();
  markExpectedSignOut();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  const parsed = safeParse(resetRequestSchema, { email });
  if (!parsed.data) throw new Error(logValidationFailure('passwordReset', parsed.reason));

  const redirectTo = Linking.createURL('reset-password');
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
  // Supabase itself doesn't reveal whether the email is registered on
  // success; a thrown error here is a real failure (rate limit, network),
  // not evidence either way, so it still gets the same neutral copy.
  if (error) throw new Error(toSafeAuthMessage(error, 'passwordReset'));
  // See useAuthStore's pendingAuthCallback doc comment - completePasswordRecovery
  // below only trusts a reset-password deep link while this is set.
  useAuthStore.getState().setPendingAuthCallback({ kind: 'reset', expiresAt: Date.now() + AUTH_CALLBACK_TTL_MS });
}

export async function updatePassword(newPassword: string) {
  const parsed = safeParse(newPasswordSchema, { password: newPassword });
  if (!parsed.data) throw new Error('Password must be between 8 and 72 characters.');

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) throw error;
}

// The emailed reset link opens the app via kinly://reset-password#access_token=...
// (same implicit-flow token shape as Google sign-in, just delivered by email
// instead of a browser redirect). Handing the tokens to setSession() makes
// supabase-js emit a PASSWORD_RECOVERY auth event, which useBootstrapSession
// listens for to switch the app into "set a new password" mode.
//
// SECURITY: kinly:// is a public URL scheme - any app or link on the device
// can invoke it, with tokens of the attacker's choosing (e.g. their own,
// valid, freely-obtained-by-signing-up tokens). Without the pendingAuthCallback
// check below, tapping such a link would silently sign this device into the
// attacker's account with no visible login step ("login CSRF"). Only trust
// the link's tokens if this device itself just called requestPasswordReset().
export async function completePasswordRecovery(url: string) {
  const pending = useAuthStore.getState().pendingAuthCallback;
  if (!pending || pending.kind !== 'reset' || pending.expiresAt < Date.now()) {
    throw new Error('This reset link has expired or was not requested on this device - request a new one.');
  }
  useAuthStore.getState().setPendingAuthCallback(null);

  const { params, errorCode } = getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) throw new Error('Reset link did not include a session');

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

// The "Confirm your email" link opens kinly://auth-callback#access_token=...
// (Supabase already verified the email server-side by this point - this
// just signs the device in immediately instead of sending a freshly
// confirmed user back to the login form). Google sign-in resolves its own
// auth-callback URL directly via openAuthSessionAsync's return value, so
// this only ever does real work for the email-confirmation case; if it
// fires for something else with no tokens present, there's simply nothing
// to do.
//
// SECURITY: same login-CSRF risk as completePasswordRecovery above, and the
// same fix - only trust this link's tokens if this device itself just
// called signUp() and is awaiting confirmation. A missing/expired flag is
// treated the same as "nothing to do" (not an error) to match how this
// function already tolerates firing for the Google-sign-in-shared-URL case.
export async function completeEmailConfirmation(url: string) {
  const pending = useAuthStore.getState().pendingAuthCallback;
  if (!pending || pending.kind !== 'confirm' || pending.expiresAt < Date.now()) return;
  useAuthStore.getState().setPendingAuthCallback(null);

  const { params, errorCode } = getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return;

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

// Permanently deletes the account: leaves every circle, erases the profile
// and everything rooted at it (goals, posts, vision items, achievements,
// events, nudges, future letters), then removes the auth.users row itself -
// see supabase/functions/delete-account and migration 0020. Irreversible.
export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account');
  if (error) {
    let message = 'Could not delete your account. Please try again or contact support.';
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      try {
        const body = await context.json();
        if (body?.error) message = body.error;
      } catch {
        // Response body wasn't JSON - keep the generic message.
      }
    }
    throw new Error(message);
  }
  await cleanUpLocalAccountState();
  markExpectedSignOut();
  await supabase.auth.signOut();
}
