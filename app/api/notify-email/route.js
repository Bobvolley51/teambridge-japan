// app/api/notify-email/route.js
// Sends email via Gmail SMTP for calendar events starting within 36 hours.
// type='invite'  → newly added to event
// type='update'  → existing event was changed within 36 h
// Requires GMAIL_USER and GMAIL_APP_PASSWORD env vars.

import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return Response.json({ ok: false, reason: 'no_credentials' });
  }

  const { participantIds, eventTitle, eventStart, eventLocation, addedBy, changedBy, type = 'invite' } = await req.json();
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

  const isUpdate  = type === 'update';
  const byPerson  = isUpdate ? changedBy : addedBy;
  const byLabel   = isUpdate ? 'Changed by' : 'Added by';
  const intro     = isUpdate
    ? `An event you are participating in has been <strong>updated</strong> — less than 36 hours before it starts:`
    : `You have been added to an upcoming event:`;
  const subject   = isUpdate
    ? `[TeamBridge] ⚠ UPDATED: ${eventTitle} — ${fmtDate}`
    : `[TeamBridge] ${eventTitle} — ${fmtDate}`;

  const accentColor = isUpdate ? '#d97706' : '#7e0027';

  const html = `
    <div style="font-family:sans-serif;font-size:14px;color:#111827;max-width:480px">
      ${isUpdate ? `<div style="background:#fef3c7;border-left:4px solid ${accentColor};padding:10px 14px;border-radius:4px;margin-bottom:14px;font-weight:600;color:#92400e">⚠ Last-minute change</div>` : ''}
      <p style="margin:0 0 12px">${intro}</p>
      <table style="border-collapse:collapse;margin:0 0 14px">
        <tr><td style="padding:4px 16px 4px 0;font-weight:600;color:#6b7280;white-space:nowrap">Event</td><td style="font-weight:600">${eventTitle}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;font-weight:600;color:#6b7280;white-space:nowrap">When</td><td>${fmtDate}</td></tr>
        ${eventLocation ? `<tr><td style="padding:4px 16px 4px 0;font-weight:600;color:#6b7280;white-space:nowrap">Where</td><td>${eventLocation}</td></tr>` : ''}
        ${byPerson ? `<tr><td style="padding:4px 16px 4px 0;font-weight:600;color:#6b7280;white-space:nowrap">${byLabel}</td><td>${byPerson}</td></tr>` : ''}
      </table>
      <p style="color:#6b7280;font-size:12px;margin:0">Open the Teambridge Tridents app for full details.</p>
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
  return Response.json({ ok: true, sent: emails.length - failed.length, failed: failed.length, errors });
}
