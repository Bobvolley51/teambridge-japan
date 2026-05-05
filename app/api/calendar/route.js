// app/api/calendar/route.js
// Public ICS feed — subscribe this URL in Google Calendar / Apple Calendar / Outlook

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/events?select=*&order=start_time.asc`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );

  const events = res.ok ? await res.json() : [];

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
    const uid     = `${ev.id}@teambridge-japan`;
    const created = formatDT(ev.created_at);
    const start   = ev.all_day ? formatDate(ev.start_time) : formatDT(ev.start_time);
    const end     = ev.all_day ? formatDate(ev.end_time)   : formatDT(ev.end_time);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
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
      'Cache-Control':       'no-cache',
    },
  });
}

function formatDT(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function formatDate(iso) {
  return new Date(iso).toISOString().slice(0, 10).replace(/-/g, '');
}

function escapeICS(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
