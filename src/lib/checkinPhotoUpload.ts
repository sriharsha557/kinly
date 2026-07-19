import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

// Compresses via expo-image-picker's own `quality` option, not
// expo-image-manipulator - that package isn't an installed dependency here
// and would need a native rebuild to add; image-picker's built-in
// compression (already how avatarUpload.ts/visionImageUpload.ts do it)
// covers "compress client-side before upload" with zero new native
// modules. A touch more aggressive than avatar/vision-board's 0.6, since
// these can accumulate faster (one per log, potentially).
const QUALITY = 0.5;

// Returns a storage PATH, not a URL - the bucket is private, so callers
// need useSignedCheckinPhotoUrl() to actually display it.
export async function pickAndUploadCheckinPhoto(circleId: string, userId: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: QUALITY,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();
  const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  // userId prefix (not just circle_id/timestamp) so account deletion can
  // find and remove one user's photos within a circle folder shared by
  // several members - see delete-account's Storage cleanup.
  const path = `${circleId}/${userId}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('checkin-photos')
    .upload(path, arrayBuffer, { contentType: asset.mimeType ?? 'image/jpeg' });
  if (error) throw error;

  return path;
}
