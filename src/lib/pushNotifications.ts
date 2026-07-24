import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(userId: string): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    await supabase.from('push_tokens').upsert({ user_id: userId, token }, { onConflict: 'user_id,token' });
  } catch {
    // Remote push isn't available in Expo Go (SDK 53+) or without an EAS
    // project configured - fail silently so this never blocks the app.
  }
}

// Called on sign-out/account deletion so a shared device doesn't keep
// delivering one account's pushes to whoever signs in next. Deletes only
// this specific device's token row, not every token this user ever
// registered - they may be signed in on another device too, and that one
// shouldn't be unregistered just because this one signed out.
export async function unregisterPushNotifications(userId: string): Promise<void> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
  } catch {
    // Same tolerance as registerForPushNotifications above - never block
    // sign-out over this.
  }
}
