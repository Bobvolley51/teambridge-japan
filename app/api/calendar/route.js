// app/api/calendar/route.js
// Personal ICS feed — /api/calendar?uid=<profile_id>
// Returns only events the user is invited to, excluding ones they marked "Out".

import { createClient } from '@supabase/supabase-js';

export async function GET(req) {
  try {
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get('uid');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let events = [];

  if (uid && serviceKey) {
    // Personal feed: only events this user is participating in (status != 'out')
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: parts } = await admin
      .from('event_participants')
      .select('event_id, status')
      .eq('profile_id', uid)
      .neq('status', 'out');

    const eventIds = (parts ?? []).map(p => p.event_id);

    if (eventIds.length > 0) {
      const { data } = await admin
        .from('events')
        .select('*')
        .in('id', eventIds)
        .order('start_time');
      events = data ?? [];
    }
  } else {
    // Fallback: public feed with all events (for backwards compat)
    const res = await fetch(
      `${supabaseUrl}/rest/v1/events?select=*&order=start_time.asc`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
    );
    events = res.ok ? await res.json() : [];
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TeamBridge Japan//Calendar//EN',
    'CALNAME:TeamBridge Japan',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:TeamBridge Japan',
    'X-WR-TIMEZONE:Asia/Tokyo',
  ];

  for (const ev of events) {
    const uid_val  = `${ev.id}@teambridge-japan`;
    const created  = formatDT(ev.created_at);
    const start    = ev.all_day ? formatDate(ev.start_time) : formatDT(ev.start_time);
    const end      = ev.all_day ? formatDate(ev.end_time)   : formatDT(ev.end_time);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid_val}`);
    lines.push(`DTSTAMP:${created}`);
    if (ev.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${start}`);
      lines.push(`DTEND;VALUE=DATE:${end}`);
    } else {
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${end}`);
    }
    lines.push(`SUMMARY:${escapeICS(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeICS(ev.description)}`);
    if (ev.location)    lines.push(`LOCATION:${escapeICS(ev.location)}`);
    if (ev.created_by)  lines.push(`X-CREATED-BY:${escapeICS(ev.created_by)}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type':        'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="teambridge.ics"',
      'Cache-Control':       'no-cache, no-store',
    },
  });
  } catch (err) {
    console.error('[calendar]', err);
    return new Response('Internal server error', { status: 500 });
  }
}

function formatDT(iso) {
  if (!iso) return '19700101T000000Z';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '19700101T000000Z';
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function formatDate(iso) {
  if (!iso) return '19700101';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '19700101';
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function escapeICS(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
