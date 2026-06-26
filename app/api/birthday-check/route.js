// app/api/birthday-check/route.js
// Called daily by Vercel cron (GET) — creates birthday calendar events for all
// profiles, and on their actual birthday: posts an announcement + notifies Headcoaches.
// Can also be triggered manually by admins via GET with header Authorization: Bearer <CRON_SECRET>.

import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function fullName(p) {
  if (p.first_name && p.last_name) return `${p.first_name} ${p.last_name}`;
  return p.display_name || p.email || 'Someone';
}

function birthdayEventTitle(name) {
  return `🎂 ${name}`;
}

// Returns ISO date string for this person's birthday in the given year
function birthdayDateStr(dob, year) {
  const [, m, d] = dob.split('-');
  return `${year}-${m}-${d}`;
}

export async function GET(request) {
  try {
  // Auth: Vercel cron sends Bearer CRON_SECRET automatically.
  // If CRON_SECRET is not configured, allow requests from same origin (admin UI).
  const auth   = request.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;
  const origin = request.headers.get('origin') ?? '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? '';
  const isSameOrigin = appUrl && origin.includes(appUrl.replace(/^https?:\/\//, ''));
  if (secret && auth !== `Bearer ${secret}` && !isSameOrigin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = adminClient();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const todayMonth = now.getMonth() + 1; // 1-12
  const todayDay = now.getDate();
  const currentYear = now.getFullYear();

  // ── 1. Load all profiles with a date_of_birth ──────────────────────────────
  const { data: profiles, error: profErr } = await db
    .from('profiles')
    .select('id, display_name, first_name, last_name, date_of_birth, role');

  if (profErr) return Response.json({ error: profErr.message }, { status: 500 });

  const withBirthday = (profiles ?? []).filter(p => p.date_of_birth);
  if (withBirthday.length === 0) {
    return Response.json({ ok: true, message: 'No profiles with birthdays.' });
  }

  // All profile IDs (for event_participants)
  const allProfileIds = (profiles ?? []).map(p => p.id);
  const headcoachIds  = (profiles ?? []).filter(p => p.role === 'Headcoach').map(p => p.id);

  const log = [];

  for (const person of withBirthday) {
    const name  = fullName(person);
    const title = birthdayEventTitle(name);
    const dob   = person.date_of_birth; // YYYY-MM-DD
    const [birthYearStr, birthMonthStr, birthDayStr] = dob.split('-');
    const birthMonth = parseInt(birthMonthStr, 10);
    const birthDay   = parseInt(birthDayStr,   10);

    // ── 2. Ensure a yearly birthday event exists ──────────────────────────────
    // Use current year as the base; expandRecurring handles past/future years.
    const baseDateStr  = birthdayDateStr(dob, currentYear);
    const startTimeISO = `${baseDateStr}T00:00:00.000Z`;
    const endTimeISO   = `${baseDateStr}T23:59:59.000Z`;

    const { data: existing } = await db
      .from('events')
      .select('id')
      .eq('title', title)
      .eq('category', 'Birthday')
      .limit(1);

    if (!existing || existing.length === 0) {
      const birthYearNum = parseInt(birthYearStr, 10);
      const ageThisYear  = currentYear - birthYearNum;

      const { data: newEvent, error: evErr } = await db
        .from('events')
        .insert({
          title,
          description: `Happy Birthday, ${name}! 🎉 (turning ${ageThisYear})`,
          category:    'Birthday',
          start_time:  startTimeISO,
          end_time:    endTimeISO,
          all_day:     true,
          recurrence:  'yearly',
          created_by:  'TeamBridge',
        })
        .select('id')
        .single();

      if (evErr) {
        log.push({ person: name, action: 'event_error', error: evErr.message });
      } else if (newEvent) {
        // Invite everyone
        if (allProfileIds.length > 0) {
          await db.from('event_participants').insert(
            allProfileIds.map(pid => ({ event_id: newEvent.id, profile_id: pid }))
          );
        }
        log.push({ person: name, action: 'event_created', eventId: newEvent.id });
      }
    } else {
      log.push({ person: name, action: 'event_exists' });
    }

    // ── 3. Today's birthday — announcement + headcoach notification ───────────
    const isToday = birthMonth === todayMonth && birthDay === todayDay;
    if (!isToday) continue;

    const birthYear    = parseInt(birthYearStr, 10);
    const age          = currentYear - birthYear;
    const annTitle     = `🎂 Happy Birthday, ${name}!`;
    const annContent   = `Today ${name} turns ${age}! 🎉 Please join us in wishing them a wonderful birthday! 🥳`;

    // Announcement — one per person per day
    const { data: existingAnn } = await db
      .from('announcements')
      .select('id')
      .eq('title', annTitle)
      .gte('created_at', `${todayStr}T00:00:00`)
      .limit(1);

    if (!existingAnn || existingAnn.length === 0) {
      await db.from('announcements').insert({
        title:       annTitle,
        content:     annContent,
        priority:    'medium',
        author_name: 'TeamBridge',
      });
      log.push({ person: name, action: 'announcement_created' });

      // Push birthday notification to everyone
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
      if (appUrl && allProfileIds.length) {
        fetch(`${appUrl}/api/push`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ userIds: allProfileIds, title: annTitle, body: annContent.slice(0, 80), url: '/feed', tag: `birthday-${person.id}`, prefKey: 'birthday' }),
        }).catch(() => {});
      }
    }

    // Headcoach notifications — one per person per day
    if (headcoachIds.length > 0) {
      const { data: existingNotif } = await db
        .from('notifications')
        .select('id')
        .eq('type', 'birthday')
        .gte('created_at', `${todayStr}T00:00:00`)
        .in('user_id', headcoachIds)
        .limit(1);

      if (!existingNotif || existingNotif.length === 0) {
        await db.from('notifications').insert(
          headcoachIds.map(uid => ({
            user_id:    uid,
            type:       'birthday',
            title:      `🎂 ${name} hat heute Geburtstag! (${age})`,
            body:       annContent,
            nav_target: 'calendar',
          }))
        );
        log.push({ person: name, action: 'headcoaches_notified', count: headcoachIds.length });
      }
    }
  }

  return Response.json({ ok: true, processed: withBirthday.length, log });
  } catch (err) {
    console.error('[birthday-check]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
