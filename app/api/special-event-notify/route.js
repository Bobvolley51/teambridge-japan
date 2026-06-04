// app/api/special-event-notify/route.js
// Vercel cron: runs every 15 minutes.
//
// Finds Special-Event calendar events starting in 80–110 minutes from now,
// then sends a push notification to all participants who haven't been notified yet.
// Deduplication is done via the notifications table (type = 'special_event_reminder').

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

  // Window: events starting 80–110 minutes from now
  const from = new Date(now.getTime() + 80 * 60 * 1000).toISOString();
  const to   = new Date(now.getTime() + 110 * 60 * 1000).toISOString();

  const { data: events } = await db
    .from('events')
    .select('id, title, start_time')
    .eq('category', 'Special-Event')
    .gte('start_time', from)
    .lte('start_time', to);

  if (!events?.length) return Response.json({ ok: true, sent: 0, events: 0 });

  // Which events have already been notified? (deduplication)
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

    const startTime = new Date(event.start_time);
    const timeStr = startTime.toLocaleString('en-GB', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo',
    });

    // Insert a sentinel notification row so we never double-send for this event.
    // Use the first participant as user_id — the row is only for dedup tracking.
    await db.from('notifications').insert({
      user_id:    participantIds[0],
      type:       'special_event_reminder',
      title:      `⭐ ${event.title}`,
      body:       `Starting at ${timeStr} (JST)`,
      nav_target: 'calendar',
      ref_id:     event.id,
    });

    const sent = await push(participantIds, {
      title:  `⭐ ${event.title}`,
      body:   `Starting in 90 minutes — ${timeStr} (JST)`,
      url:    '/?nav=calendar',
      tag:    `special-event-${event.id}`,
      prefKey: 'calendar',
    });

    totalSent += sent;
  }

  return Response.json({ ok: true, sent: totalSent, events: pending.length });
}
