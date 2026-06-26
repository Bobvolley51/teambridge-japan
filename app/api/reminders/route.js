// app/api/reminders/route.js
// Runs every hour (Supabase pg_cron: 0 * * * *)
//
// Wellness (10:00 JST = 01:00 UTC): one reminder to players who haven't
// submitted today's wellness entry yet.
//
// RPE: finds Ball-Practice/Game events that ended 30–90 min ago and sends
// one reminder per event to participants who haven't logged RPE yet.
// Deduplication via notifications table (type = 'rpe_reminder', ref_id = event id).

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

// ── Wellness reminder ─────────────────────────────────────────────────────────
async function wellnessReminder(db, todayJST) {
  const { data: players } = await db
    .from('profiles')
    .select('id')
    .eq('role', 'Player');
  if (!players?.length) return 0;

  const playerIds = players.map(p => p.id);

  const { data: done } = await db
    .from('wellness_responses')
    .select('user_id')
    .eq('response_date', todayJST)
    .in('user_id', playerIds);

  const doneIds = new Set((done ?? []).map(r => r.user_id));
  const pending = playerIds.filter(id => !doneIds.has(id));

  return push(pending, {
    title: '🌅 Wellness Check',
    body: "Don't forget to fill in your daily wellness check.",
    url: '/?nav=dashboard',
    tag: 'wellness-reminder',
    prefKey: 'wellness_reminder',
  });
}

// ── RPE reminder ──────────────────────────────────────────────────────────────
async function rpeReminder(db, now) {
  // Events that ended 30–90 min ago — guarantees reminder at least 30 min after end
  const from = new Date(now.getTime() - 90 * 60 * 1000).toISOString();
  const to   = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

  const { data: events } = await db
    .from('events')
    .select('id, title')
    .in('category', ['Ball-Practice', 'Game'])
    .gte('end_time', from)
    .lte('end_time', to);

  if (!events?.length) return 0;

  const eventIds = events.map(e => e.id);

  // Skip events we already sent an RPE reminder for
  const { data: alreadySent } = await db
    .from('notifications')
    .select('ref_id')
    .eq('type', 'rpe_reminder')
    .in('ref_id', eventIds);

  const notifiedIds = new Set((alreadySent ?? []).map(r => r.ref_id));
  const pendingEvents = events.filter(e => !notifiedIds.has(e.id));
  if (!pendingEvents.length) return 0;

  const pendingEventIds = pendingEvents.map(e => e.id);

  const { data: participants } = await db
    .from('event_participants')
    .select('profile_id, event_id')
    .in('event_id', pendingEventIds);

  if (!participants?.length) return 0;

  const allParticipantIds = [...new Set(participants.map(p => p.profile_id))];

  const { data: logged } = await db
    .from('session_rpe')
    .select('user_id, event_id')
    .in('event_id', pendingEventIds)
    .in('user_id', allParticipantIds);

  const loggedPairs = new Set((logged ?? []).map(r => `${r.user_id}:${r.event_id}`));

  let totalSent = 0;

  for (const event of pendingEvents) {
    const eventParticipants = participants
      .filter(p => p.event_id === event.id)
      .map(p => p.profile_id);

    const pending = eventParticipants.filter(uid => !loggedPairs.has(`${uid}:${event.id}`));
    if (!pending.length) continue;

    // Insert dedup sentinel before pushing so a concurrent run can't double-send
    await db.from('notifications').insert({
      user_id:    pending[0],
      type:       'rpe_reminder',
      title:      '📊 Session Feedback',
      body:       `How was ${event.title}? Log your RPE now.`,
      nav_target: 'dashboard',
      ref_id:     event.id,
    });

    totalSent += await push(pending, {
      title:   '📊 Session Feedback',
      body:    `How was ${event.title}? Log your RPE now.`,
      url:     '/?nav=dashboard',
      tag:     `rpe-reminder-${event.id}`,
      prefKey: 'rpe_reminder',
    });
  }

  return totalSent;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function GET(request) {
  try {
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

    const jstHour  = (now.getUTCHours() + 9) % 24;
    const todayJST = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);

    const results = {};

    // Wellness reminder at 10:00 JST (01:00 UTC) — only once per day
    if (jstHour === 10) {
      results.wellness = await wellnessReminder(db, todayJST);
    }

    results.rpe = await rpeReminder(db, now);

    return Response.json({ ok: true, ...results });
  } catch (err) {
    console.error('[reminders]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
