// app/api/push/route.js
// Send a push notification to one or more users

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(req) {
  const { userIds, title, body, url = '/', tag } = await req.json();
  if (!userIds?.length || !title) return Response.json({ error: 'Missing fields' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, subscription, user_id')
    .in('user_id', userIds);

  if (!subs?.length) return Response.json({ sent: 0 });

  const payload = JSON.stringify({ title, body, url, tag, icon: '/icon-192.png', badge: '/icon-192.png' });

  const results = await Promise.allSettled(
    subs.map(async (row) => {
      const sub = JSON.parse(row.subscription);
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        // 410 Gone = subscription expired — clean it up
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
