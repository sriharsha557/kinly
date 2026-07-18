import { Linking } from 'react-native';

// Points at the current internal-distribution build's install page - update
// EXPO_PUBLIC_ANDROID_APK_URL in .env after every new `eas build` (rare;
// JS-only changes ship via `eas update` to people who already installed).
const ANDROID_APK_URL = process.env.EXPO_PUBLIC_ANDROID_APK_URL;

export function inviteMessage(circleName: string, inviteCode: string): string {
  const intro = `Join my Growth Circle "${circleName}" on Kinly.`;
  const download = ANDROID_APK_URL ? `\n\nDownload Kinly (Android):\n${ANDROID_APK_URL}` : '';
  return `${intro}${download}\n\nInvite code: ${inviteCode}`;
}

export async function shareToWhatsApp(message: string): Promise<void> {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  await Linking.openURL(url);
}
