// app/api/set-admin/route.js
// Only super-admins can grant or revoke the admin flag on a profile.

import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  const { targetUserId, isAdmin, token } = body;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Server not configured.' }, { status: 500 });
  }

  if (!targetUserId || typeof isAdmin !== 'boolean' || !token) {
    return Response.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: caller } = await admin.from('profiles').select('is_super_admin').eq('id', user.id).single();
  if (!caller?.is_super_admin) {
    return Response.json({ error: 'Only super-admins can grant or revoke admin status.' }, { status: 403 });
  }

  const { error } = await admin.from('profiles').update({ is_admin: isAdmin }).eq('id', targetUserId);
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json({ ok: true });
  } catch (err) {
    console.error('[set-admin]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
