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

  // Use anon-key client for JWT verification (service-role client overrides auth headers)
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  // Use service-role client for privileged DB operations
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: caller } = await admin.from('profiles').select('is_super_admin, is_admin').eq('id', user.id).single();
  if (!caller?.is_super_admin && !caller?.is_admin) {
    return Response.json({ error: 'Only admins can change roles.' }, { status: 403 });
  }

  const { error } = await admin.from('profiles').update({ role: newRole }).eq('id', targetUserId);
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
}
