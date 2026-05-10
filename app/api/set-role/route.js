// app/api/set-role/route.js
// Only super-admins can change a user's role.
// Caller must pass their Supabase access token so we can verify their privilege.

import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  const { targetUserId, newRole, token } = await req.json();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Server not configured.' }, { status: 500 });
  }

  if (!targetUserId || !newRole || !token) {
    return Response.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Verify the caller is authenticated
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  // Verify they are a super-admin
  const { data: caller } = await admin.from('profiles').select('is_super_admin').eq('id', user.id).single();
  if (!caller?.is_super_admin) {
    return Response.json({ error: 'Only super-admins can change roles.' }, { status: 403 });
  }

  // Apply the role change
  const { error } = await admin.from('profiles').update({ role: newRole }).eq('id', targetUserId);
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
}
