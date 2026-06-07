// app/api/special-event-notify/route.js
// Runs daily at 19:00 JST. Finds Special-Event calendar events happening
// tomorrow (JST) and sends a push notification to all participants.
// Deduplication via notifications table (type = 'special_event_reminder').

import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? `https://${process.env.VERCEL_URL}`;
}

async function push(userIds, payload) {
  if (!userIds?.length) return 0;
  const res = await fetch(`${appUrl()}/api/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  return json.sent ?? 0;
}

export async function GET(request) {
  const auth   = request.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Server not configured.' }, { status: 500 });
  }

  const db  = adminClient();
  const now = new Date();

  // Compute tomorrow's date range in JST (UTC+9)
  const jstOffset = 9 * 60 * 60 * 1000;
  const nowJST = new Date(now.getTime() + jstOffset);
  // Advance to tomorrow in JST, then reset to midnight
  const tomorrowJST = new Date(nowJST);
  tomorrowJST.setUTCDate(tomorrowJST.getUTCDate() + 1);
  tomorrowJST.setUTCHours(0, 0, 0, 0);

  // Convert back to UTC for DB query
  const from = new Date(tomorrowJST.getTime() - jstOffset).toISOString();
  const to   = new Date(tomorrowJST.getTime() - jstOffset + 24 * 60 * 60 * 1000 - 1).toISOString();

  const { data: events } = await db
    .from('events')
    .select('id, title, start_time')
    .eq('category', 'Special-Event')
    .gte('start_time', from)
    .lte('start_time', to);

  if (!events?.length) return Response.json({ ok: true, sent: 0, events: 0 });

  // Skip events already notified
  const eventIds = events.map(e => e.id);
  const { data: alreadySent } = await db
    .from('notifications')
    .select('ref_id')
    .eq('type', 'special_event_reminder')
    .in('ref_id', eventIds);

  const notifiedEventIds = new Set((alreadySent ?? []).map(r => r.ref_id));
  const pending = events.filter(e => !notifiedEventIds.has(e.id));

  if (!pending.length) return Response.json({ ok: true, sent: 0, events: 0, reason: 'already_notified' });

  let totalSent = 0;

  for (const event of pending) {
    const { data: participants } = await db
      .from('event_participants')
      .select('profile_id')
      .eq('event_id', event.id);

    const participantIds = (participants ?? []).map(p => p.profile_id);
    if (!participantIds.length) continue;

    const timeStr = new Date(event.start_time).toLocaleString('en-GB', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo',
    });

    await db.from('notifications').insert({
      user_id:    participantIds[0],
      type:       'special_event_reminder',
      title:      `⭐ ${event.title}`,
      body:       `Tomorrow at ${timeStr} (JST)`,
      nav_target: 'calendar',
      ref_id:     event.id,
    });

    const sent = await push(participantIds, {
      title:   `⭐ ${event.title}`,
      body:    `Tomorrow at ${timeStr} (JST)`,
      url:     '/?nav=calendar',
      tag:     `special-event-${event.id}`,
      prefKey: 'calendar',
    });

    totalSent += sent;
  }

  return Response.json({ ok: true, sent: totalSent, events: pending.length });
}
