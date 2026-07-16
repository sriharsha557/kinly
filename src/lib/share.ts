import { Linking } from 'react-native';

export function inviteMessage(circleName: string, inviteCode: string): string {
  return `Join my Growth Circle "${circleName}" on Kinly. Invite code: ${inviteCode}`;
}

export async function shareToWhatsApp(message: string): Promise<void> {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  await Linking.openURL(url);
}
