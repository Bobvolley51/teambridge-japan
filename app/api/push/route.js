// app/api/push/route.js
// Send a push notification to one or more users, respecting their notif_prefs.
// prefKey: if provided, only sends to users who have that pref enabled (default: true when unset)

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  const { userIds, title, body, url = '/', tag, prefKey } = await req.json();
  if (!userIds?.length || !title) return Response.json({ error: 'Missing fields' }, { status: 400 });

  const vapidPublic  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail   = process.env.VAPID_EMAIL ?? '';
  if (!vapidPublic || !vapidPrivate) {
    console.error('push/route: VAPID keys not configured');
    return Response.json({ error: 'Push not configured' }, { status: 503 });
  }
  const vapidSubject = vapidEmail.startsWith('mailto:') || vapidEmail.startsWith('https:')
    ? vapidEmail : `mailto:${vapidEmail}`;
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  } catch (e) {
    console.error('push/route: invalid VAPID config', e.message);
    return Response.json({ error: 'Invalid VAPID config' }, { status: 503 });
  }

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

  const [{ data: subs }, { data: unreadRows }] = await Promise.all([
    admin.from('push_subscriptions').select('endpoint, subscription, user_id').in('user_id', targetIds),
    // Unread notification count per user — used to set home-screen badge
    admin.from('notifications').select('user_id').in('user_id', targetIds).eq('is_read', false),
  ]);

  if (!subs?.length) return Response.json({ sent: 0 });

  // Build per-user unread count map
  // Notifications are already inserted in DB before sendPush is called, so no +1 needed.
  const unreadMap = {};
  for (const r of (unreadRows ?? [])) unreadMap[r.user_id] = (unreadMap[r.user_id] ?? 0) + 1;

  const results = await Promise.allSettled(
    subs.map(async (row) => {
      const badgeCount = unreadMap[row.user_id] ?? 0;
      const p = JSON.stringify({ title, body, url, tag, icon: '/icon-192.png', badge: '/icon-192.png', badgeCount });
      const sub = JSON.parse(row.subscription);
      try {
        await webpush.sendNotification(sub, p);
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
