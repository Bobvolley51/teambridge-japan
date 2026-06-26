// app/api/delete-user/route.js
// Permanently deletes a user from auth.users (profile is cascade-deleted)
// and removes any leftover account_requests entry so the email can be reused.

import { createClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return Response.json({ error: 'Invalid JSON body' }, { status: 400 });

    const { userId } = body;
    if (!userId || typeof userId !== 'string' || !UUID_RE.test(userId)) {
      return Response.json({ error: 'Invalid userId.' }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch the user's email before deleting so we can clean up account_requests
    const { data: userData } = await admin.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email;

    // Delete from auth.users (cascades to profiles)
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return Response.json({ error: error.message }, { status: 400 });

    // Remove the account_requests entry so the email is immediately reusable
    if (userEmail) {
      await admin.from('account_requests').delete().eq('email', userEmail);
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[delete-user]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
