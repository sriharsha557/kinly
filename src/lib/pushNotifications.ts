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

let tokenRefreshSubscription: Notifications.EventSubscription | null = null;

export async function registerForPushNotifications(userId: string): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      // MAX (not DEFAULT) so Android shows a heads-up banner over whatever
      // app is open - DEFAULT importance only puts the notification in the
      // shade silently, which reads as "push doesn't work". Note: Android
      // snapshots a channel's importance the first time it's created, so
      // devices that already created the old DEFAULT channel keep it until
      // reinstall or the user changes it in system settings.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
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

    // FCM occasionally rotates the underlying device token; re-upsert when
    // that happens so the stored token never goes stale mid-session. One
    // live listener at a time - a second login on the same launch (sign out,
    // sign back in) replaces the previous account's listener instead of
    // stacking another one that would upsert rows for the old user_id.
    tokenRefreshSubscription?.remove();
    tokenRefreshSubscription = Notifications.addPushTokenListener(async () => {
      try {
        const { data: refreshed } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
        await supabase.from('push_tokens').upsert({ user_id: userId, token: refreshed }, { onConflict: 'user_id,token' });
      } catch {
        // Same tolerance as the surrounding function.
      }
    });
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
  tokenRefreshSubscription?.remove();
  tokenRefreshSubscription = null;
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
