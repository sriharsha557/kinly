import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import { supabase } from './supabase';
import { newPasswordSchema, resetRequestSchema, safeParse, signInSchema, signUpSchema } from './authValidation';
import { logValidationFailure, toSafeAuthMessage } from './authErrors';

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

export async function signUp(email: string, password: string, name: string) {
  const parsed = safeParse(signUpSchema, { email, password, name });
  if (!parsed.data) throw new Error(logValidationFailure('signUp', parsed.reason));

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  });
  if (error) throw new Error(toSafeAuthMessage(error, 'signUp'));
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

export async function signOut() {
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
export async function completePasswordRecovery(url: string) {
  const { params, errorCode } = getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) throw new Error('Reset link did not include a session');

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
  await supabase.auth.signOut();
}
