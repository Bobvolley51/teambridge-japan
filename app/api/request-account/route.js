// app/api/request-account/route.js
// Creates an unconfirmed user (can't log in) and stores the request.
// The account becomes active only after an admin approves it.

import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  const { email, password, displayName, username, message } = await req.json();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Server not configured.' }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // If a previous pending request exists for this email, delete the old auth user first
  const { data: existing } = await admin
    .from('account_requests')
    .select('user_id')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (existing?.user_id) {
    await admin.auth.admin.deleteUser(existing.user_id);
  }

  // Check username uniqueness if provided
  if (username) {
    const { data: taken } = await admin
      .from('profiles')
      .select('id')
      .ilike('username', username.trim())
      .maybeSingle();
    if (taken) return Response.json({ error: 'Username already taken.' }, { status: 400 });
  }

  // Create user — email_confirm: false means they cannot log in yet
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { display_name: displayName, username: username?.trim() || null },
  });

  if (error) return Response.json({ error: error.message }, { status: 400 });

  // Store username on the profile row created by the DB trigger
  if (username) {
    await admin.from('profiles')
      .update({ username: username.trim().toLowerCase() })
      .eq('id', data.user.id);
  }

  // Store/update the request
  await admin.from('account_requests').upsert({
    display_name: displayName.trim(),
    email:        email.toLowerCase(),
    message:      message || null,
    status:       'pending',
    user_id:      data.user.id,
  }, { onConflict: 'email' });

  // Notify admins and super-admins about the new request
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
        title: '📋 New Access Request',
        body: `${displayName.trim()} is requesting access to TeamBridge.`,
        url: '/?nav=admin',
        tag: 'account-request',
      }),
    }).catch(() => {});
  }

  return Response.json({ ok: true });
}
