// app/api/delete-user/route.js
// Permanently deletes a user from auth.users (profile is cascade-deleted)
// and removes any leftover account_requests entry so the email can be reused.

import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  const { userId } = await req.json();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Fetch the user's email before deleting so we can clean up account_requests
  const { data: { user } } = await admin.auth.admin.getUserById(userId);

  // Delete from auth.users (cascades to profiles)
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return Response.json({ error: error.message }, { status: 400 });

  // Remove the account_requests entry so the email is immediately reusable
  if (user?.email) {
    await admin.from('account_requests').delete().eq('email', user.email);
  }

  return Response.json({ ok: true });
}
