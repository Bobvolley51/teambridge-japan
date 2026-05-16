// app/api/push/route.js
// Send a push notification to one or more users, respecting their notif_prefs.
// prefKey: if provided, only sends to users who have that pref enabled (default: true when unset)

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(req) {
  const { userIds, title, body, url = '/', tag, prefKey } = await req.json();
  if (!userIds?.length || !title) return Response.json({ error: 'Missing fields' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Filter by notification preference if a key is provided
  let targetIds = userIds;
  if (prefKey) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, notif_prefs')
      .in('id', userIds);
    targetIds = (profiles ?? [])
      .filter(p => (p.notif_prefs?.[prefKey] ?? true) !== false)
      .map(p => p.id);
  }
  if (!targetIds.length) return Response.json({ sent: 0, reason: 'pref_disabled' });

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, subscription, user_id')
    .in('user_id', targetIds);

  if (!subs?.length) return Response.json({ sent: 0 });

  const payload = JSON.stringify({ title, body, url, tag, icon: '/icon-192.png', badge: '/icon-192.png' });

  const results = await Promise.allSettled(
    subs.map(async (row) => {
      const sub = JSON.parse(row.subscription);
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await admin.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
        }
        throw err;
      }
    })
  );

  const sent   = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  return Response.json({ sent, failed });
}
