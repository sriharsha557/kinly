// Actually deletes the caller's account: leaves every circle they're in and
// hard-deletes their profile (cascading through their goals/posts/etc.) via
// the delete_my_account() RPC (migration 0020), removes their uploaded
// files from Storage across avatars/vision-images/checkin-photos (a DB
// cascade never touches Storage objects), then removes the auth.users row
// via the Admin API - the one part that can only happen with the service
// role key, never from the client or a security-definer RPC.
//
// Deploy: Supabase Dashboard -> Edge Functions -> New function
// "delete-account" -> paste this file -> Deploy. Keep "Enforce JWT
// verification" ON (unlike check-streaks-at-risk/notify-circle, which run
// with no user context) - this must only ever act on the caller's own
// account, never be callable on someone else's behalf.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Both buckets key every object under `${userId}/...` (see avatarUpload.ts
// and visionImageUpload.ts), so a prefix listing finds everything this user
// ever uploaded without needing to track individual paths.
const USER_FOLDER_BUCKETS = ['avatars', 'vision-images'];

async function emptyUserFolder(adminClient: ReturnType<typeof createClient>, bucket: string, userId: string) {
  const { data: files } = await adminClient.storage.from(bucket).list(userId);
  if (!files || files.length === 0) return;
  await adminClient.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
}

// checkin-photos is keyed by `${circleId}/${userId}-${timestamp}.ext`
// (migration 0026), not `${userId}/...` - a circle folder holds every
// member's photos mixed together, so cleanup has to list each circle the
// user was in and filter to filenames starting with their own id, rather
// than a single prefix listing like the two buckets above.
async function emptyCheckinPhotos(adminClient: ReturnType<typeof createClient>, userId: string, circleIds: string[]) {
  for (const circleId of circleIds) {
    const { data: files } = await adminClient.storage.from('checkin-photos').list(circleId);
    const mine = (files ?? []).filter((f) => f.name.startsWith(`${userId}-`));
    if (mine.length === 0) continue;
    await adminClient.storage.from('checkin-photos').remove(mine.map((f) => `${circleId}/${f.name}`));
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Scoped to the caller's own JWT, so auth.uid() inside delete_my_account()
    // resolves to them - this function can only ever delete the account
    // making the request, never take a target user id as input.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) throw new Error('Not authenticated');
    const userId = userData.user.id;

    // Captured BEFORE delete_my_account() runs - it leaves every circle
    // (soft-deleting circle_members rows) as part of the same call, so this
    // is the last moment the caller's own client can still see which
    // circles they were in, needed below to find their checkin-photos.
    const { data: memberships } = await callerClient
      .from('circle_members')
      .select('circle_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .is('deleted_at', null);
    const circleIds = (memberships ?? []).map((m) => m.circle_id as string);

    const { error: rpcError } = await callerClient.rpc('delete_my_account');
    if (rpcError) throw rpcError;

    // Only the service role can remove the actual auth.users row or list/
    // delete another "user's" Storage objects (RLS on storage.objects only
    // lets the caller manage their own - but by this point delete_my_account
    // already hard-deleted their profile, so their own client can no longer
    // prove who they were) - this is the one place in the whole app that key
    // is used from an Edge Function triggered by a live user request rather
    // than a cron job.
    const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    for (const bucket of USER_FOLDER_BUCKETS) {
      await emptyUserFolder(adminClient, bucket, userId);
    }
    await emptyCheckinPhotos(adminClient, userId, circleIds);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  }
});
