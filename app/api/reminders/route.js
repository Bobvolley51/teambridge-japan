// app/api/reminders/route.js
// Vercel cron: runs every 2 hours.
//
// At 07:00 JST (22:00 UTC): sends wellness check reminder to players who
//   haven't submitted today's entry yet.
//
// Every run: checks for Ball-Practice / Game events that started 30min–3h ago
//   and sends RPE reminder to participants who haven't logged yet.

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
  // All players
  const { data: players } = await db
    .from('profiles')
    .select('id')
    .eq('role', 'Player');
  if (!players?.length) return 0;

  const playerIds = players.map(p => p.id);

  // Who already submitted today?
  const { data: done } = await db
    .from('wellness_responses')
    .select('user_id')
    .eq('response_date', todayJST)
    .in('user_id', playerIds);

  const doneIds = new Set((done ?? []).map(r => r.user_id));
  const pending = playerIds.filter(id => !doneIds.has(id));

  return push(pending, {
    title: '🌅 Wellness Check',
    body: 'Don\'t forget to fill in your daily wellness check.',
    url: '/?nav=dashboard',
    tag: 'wellness-reminder',
    prefKey: 'wellness_reminder',
  });
}

// ── RPE reminder ──────────────────────────────────────────────────────────────
async function rpeReminder(db, now) {
  // Events that started 30 min – 3 hours ago
  const from = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const to   = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

  const { data: events } = await db
    .from('events')
    .select('id, title')
    .in('category', ['Ball-Practice', 'Game'])
    .gte('start_time', from)
    .lte('start_time', to);

  if (!events?.length) return 0;

  const eventIds = events.map(e => e.id);

  // All participants of those events
  const { data: participants } = await db
    .from('event_participants')
    .select('profile_id, event_id')
    .in('event_id', eventIds);

  if (!participants?.length) return 0;

  const participantIds = [...new Set(participants.map(p => p.profile_id))];

  // Who already logged RPE for any of these events?
  const { data: logged } = await db
    .from('session_rpe')
    .select('user_id, event_id')
    .in('event_id', eventIds)
    .in('user_id', participantIds);

  const loggedPairs = new Set((logged ?? []).map(r => `${r.user_id}:${r.event_id}`));

  // Keep only players missing at least one RPE entry
  const pending = participantIds.filter(uid =>
    participants
      .filter(p => p.profile_id === uid)
      .some(p => !loggedPairs.has(`${uid}:${p.event_id}`))
  );

  if (!pending.length) return 0;

  // Use the first event title for the notification body
  const eventTitle = events[0].title;

  return push(pending, {
    title: '📊 Session Feedback',
    body: `How was ${eventTitle}? Log your session RPE now.`,
    url: '/?nav=dashboard',
    tag: 'rpe-reminder',
    prefKey: 'rpe_reminder',
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────
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

  // JST = UTC+9
  const jstHour = (now.getUTCHours() + 9) % 24;
  const todayJST = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);

  const results = {};

  // Wellness reminder at 09:00 JST
  if (jstHour === 9) {
    results.wellness = await wellnessReminder(db, todayJST);
  }

  // RPE reminder every run
  results.rpe = await rpeReminder(db, now);

  return Response.json({ ok: true, ...results });
}
