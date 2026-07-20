import { Linking } from 'react-native';
import * as ExpoLinking from 'expo-linking';

// Points at the current internal-distribution build's install page - update
// EXPO_PUBLIC_ANDROID_APK_URL in .env after every new `eas build` (rare;
// JS-only changes ship via `eas update` to people who already installed).
const ANDROID_APK_URL = process.env.EXPO_PUBLIC_ANDROID_APK_URL;

export function inviteMessage(circleName: string, inviteCode: string): string {
  const intro = `Join my Growth Circle "${circleName}" on Kinly.`;
  const download = ANDROID_APK_URL ? `\n\nDownload Kinly (Android):\n${ANDROID_APK_URL}` : '';
  // The deep link only does anything for someone who already has the app
  // installed (a custom scheme can't trigger a first install) - the plain
  // code stays in the message too so a first-time recipient still has
  // something to type in after installing.
  const joinLink = ExpoLinking.createURL('join', { queryParams: { code: inviteCode } });
  return `${intro}${download}\n\nAlready have Kinly? Tap to join:\n${joinLink}\n\nOr enter this invite code: ${inviteCode}`;
}

export async function shareToWhatsApp(message: string): Promise<void> {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  await Linking.openURL(url);
}
