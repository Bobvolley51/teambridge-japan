// app/api/push-subscribe/route.js
// Save or delete a push subscription for a user

import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  const { userId, subscription } = await req.json();
  if (!userId || !subscription) return Response.json({ error: 'Missing fields' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const endpoint = subscription.endpoint;

  const { error } = await admin.from('push_subscriptions').upsert(
    { user_id: userId, endpoint, subscription: JSON.stringify(subscription), updated_at: new Date().toISOString() },
    { onConflict: 'endpoint' }
  );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req) {
  const { userId, endpoint } = await req.json();
  if (!userId || !endpoint) return Response.json({ error: 'Missing fields' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  await admin.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
  return Response.json({ ok: true });
}
