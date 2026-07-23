import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { ensureMediaLibraryPermission } from './mediaPermission';

export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const granted = await ensureMediaLibraryPermission();
  if (!granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();
  const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, { contentType: asset.mimeType ?? 'image/jpeg', upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // Cache-bust: upsert reuses the same path, so the URL alone won't change.
  return `${data.publicUrl}?t=${Date.now()}`;
}
