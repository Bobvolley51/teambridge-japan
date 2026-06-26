// app/api/notify-email/route.js
// Sends email via Gmail SMTP for calendar events starting within 36 hours.
// type='invite'  → newly added to event
// type='update'  → existing event was changed within 36 h
// Requires GMAIL_USER and GMAIL_APP_PASSWORD env vars.

import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return Response.json({ ok: false, reason: 'no_credentials' });
  }

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  const { participantIds, eventTitle, eventStart, eventLocation, addedBy, changedBy, type = 'invite' } = body;
  if (!participantIds?.length) return Response.json({ ok: true });

  const hoursUntil = (new Date(eventStart) - Date.now()) / 3600000;
  if (hoursUntil < 0 || hoursUntil > 36) return Response.json({ ok: true, reason: 'not_urgent' });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const users  = await Promise.all(participantIds.map(uid => admin.auth.admin.getUserById(uid)));
  const emails = users.map(r => r.data?.user?.email).filter(Boolean);
  if (!emails.length) return Response.json({ ok: true });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const fmtDate = new Date(eventStart).toLocaleString('en-GB', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const isUpdate = type === 'update';
  const subject  = isUpdate
    ? `⚠ Urgent: Team schedule changed — ${eventTitle}`
    : `[TeamBridge] Added to event: ${eventTitle}`;

  const html = isUpdate ? `
    <div style="font-family:sans-serif;font-size:15px;color:#111827;max-width:480px">
      <div style="background:#dc2626;color:#fff;font-weight:700;font-size:16px;padding:12px 16px;border-radius:6px 6px 0 0">
        ⚠ Urgent — Team schedule has been changed
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 6px 6px;padding:16px">
        <p style="margin:0 0 14px;color:#374151">Please check the updated details for your upcoming event:</p>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:5px 14px 5px 0;font-weight:600;color:#6b7280;white-space:nowrap">Event</td><td style="font-weight:700;color:#111827">${eventTitle}</td></tr>
          <tr><td style="padding:5px 14px 5px 0;font-weight:600;color:#6b7280;white-space:nowrap">When</td><td>${fmtDate}</td></tr>
          ${eventLocation ? `<tr><td style="padding:5px 14px 5px 0;font-weight:600;color:#6b7280;white-space:nowrap">Where</td><td>${eventLocation}</td></tr>` : ''}
          ${changedBy ? `<tr><td style="padding:5px 14px 5px 0;font-weight:600;color:#6b7280;white-space:nowrap">Changed by</td><td>${changedBy}</td></tr>` : ''}
        </table>
        <p style="margin:14px 0 0;font-size:12px;color:#9ca3af">Open the Teambridge app for full details.</p>
      </div>
    </div>
  ` : `
    <div style="font-family:sans-serif;font-size:14px;color:#111827;max-width:480px">
      <p>You have been added to an upcoming event:</p>
      <table style="border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:4px 16px 4px 0;font-weight:600;color:#6b7280">Event</td><td style="font-weight:600">${eventTitle}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;font-weight:600;color:#6b7280">When</td><td>${fmtDate}</td></tr>
        ${eventLocation ? `<tr><td style="padding:4px 16px 4px 0;font-weight:600;color:#6b7280">Where</td><td>${eventLocation}</td></tr>` : ''}
        ${addedBy ? `<tr><td style="padding:4px 16px 4px 0;font-weight:600;color:#6b7280">Added by</td><td>${addedBy}</td></tr>` : ''}
      </table>
      <p style="color:#9ca3af;font-size:12px">Open the Teambridge app for details.</p>
    </div>
  `;

  const results = await Promise.allSettled(
    emails.map(to =>
      transporter.sendMail({
        from: `Teambridge Tridents <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
      })
    )
  );

  const failed = results.filter(r => r.status === 'rejected');
  const errors = failed.map(r => r.reason?.message ?? String(r.reason));

  // Fire-and-forget push notification to participants
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  if (appUrl) {
    const pushTitle = isUpdate ? `⚠ Schedule changed: ${eventTitle}` : `📅 Added to event: ${eventTitle}`;
    const pushBody  = `${fmtDate}${eventLocation ? ` · ${eventLocation}` : ''}`;
    fetch(`${appUrl}/api/push`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userIds: participantIds, title: pushTitle, body: pushBody, url: '/?nav=calendar', tag: 'calendar-notif', prefKey: 'calendar' }),
    }).catch(() => {});
  }

  return Response.json({ ok: true, sent: emails.length - failed.length, failed: failed.length, errors });
  } catch (err) {
    console.error('[notify-email]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
