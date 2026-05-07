// app/api/notify-email/route.js
// Sends email via Gmail SMTP for calendar events starting within 36 hours.
// Requires GMAIL_USER and GMAIL_APP_PASSWORD env vars.

import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return Response.json({ ok: false, reason: 'no_credentials' });
  }

  const { participantIds, eventTitle, eventStart, eventLocation, addedBy } = await req.json();
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

  const html = `
    <div style="font-family:sans-serif;font-size:14px;color:#111827">
      <p>You have been added to an upcoming event:</p>
      <table style="border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:4px 16px 4px 0;font-weight:600">Event</td><td>${eventTitle}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;font-weight:600">When</td><td>${fmtDate}</td></tr>
        ${eventLocation ? `<tr><td style="padding:4px 16px 4px 0;font-weight:600">Where</td><td>${eventLocation}</td></tr>` : ''}
        ${addedBy ? `<tr><td style="padding:4px 16px 4px 0;font-weight:600">Added by</td><td>${addedBy}</td></tr>` : ''}
      </table>
      <p style="color:#6b7280;font-size:12px">Open the Teambridge Tridents app for details.</p>
    </div>
  `;

  const results = await Promise.allSettled(
    emails.map(to =>
      transporter.sendMail({
        from: `Teambridge Tridents <${process.env.GMAIL_USER}>`,
        to,
        subject: `[TeamBridge] ${eventTitle} — ${fmtDate}`,
        html,
      })
    )
  );

  const failed  = results.filter(r => r.status === 'rejected');
  const errors  = failed.map(r => r.reason?.message ?? String(r.reason));
  return Response.json({ ok: true, sent: emails.length - failed.length, failed: failed.length, errors });
}
