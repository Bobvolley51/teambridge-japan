// app/api/invite/route.js
// Approves an account request by confirming the user's email.
// The user already exists (created during request) — this just unlocks them.

import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  const { requestId, userId } = await req.json();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Server not configured.' }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Confirm the email — this is the only thing needed to unlock the account
  const { error } = await admin.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });

  if (error) return Response.json({ error: error.message }, { status: 400 });

  // Mark request as approved and fetch display name for notification
  const { data: request } = await admin
    .from('account_requests')
    .update({ status: 'approved' })
    .eq('id', requestId)
    .select('display_name')
    .single();

  // Notify all admins and super-admins about the new user
  const { data: adminProfiles } = await admin
    .from('profiles')
    .select('id')
    .or('is_super_admin.eq.true,is_admin.eq.true');

  const adminIds = (adminProfiles ?? []).map(p => p.id);
  if (adminIds.length) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${process.env.VERCEL_URL}`;
    fetch(`${appUrl}/api/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userIds: adminIds,
        title: '👤 New User Joined',
        body: `${request?.display_name ?? 'A new user'} has been approved and can now log in.`,
        url: '/?nav=admin',
        tag: 'new-user',
      }),
    }).catch(() => {});
  }

  return Response.json({ ok: true });
}
