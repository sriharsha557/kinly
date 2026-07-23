import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// The three photo-picker call sites (avatar, vision board, check-in photo)
// used to just `if (!permission.granted) return null`, identical to what
// happens when the user cancels the picker itself - a denied permission and
// a cancelled picker looked the same: nothing visibly happens. These are
// all user-initiated taps ("Upload a photo"), so unlike push notifications
// (which register silently on login, no explicit ask), staying silent here
// reads as a broken button, not a respected "no."
export async function ensureMediaLibraryPermission(): Promise<boolean> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.granted) return true;

  Alert.alert(
    'Photo access needed',
    permission.canAskAgain
      ? 'Kinly needs access to your photos for this.'
      : "Kinly needs access to your photos for this - you'll need to enable it in Settings.",
    permission.canAskAgain
      ? [{ text: 'OK' }]
      : [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
  );
  return false;
}
