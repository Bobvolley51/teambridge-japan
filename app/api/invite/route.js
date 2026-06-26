// app/api/invite/route.js
// Approves an account request by confirming the user's email.
// The user already exists (created during request) — this just unlocks them.

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req) {
  try {
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { requestId, userId } = body;
  if (!requestId || !userId || !UUID_RE.test(userId)) {
    return Response.json({ error: 'Missing or invalid requestId / userId.' }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Server not configured.' }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Confirm the email — this is the only thing needed to unlock the account
  const { error } = await admin.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });

  if (error) return Response.json({ error: error.message }, { status: 400 });

  // Mark request as approved and fetch display name for notification
  const { data: request } = await admin
    .from('account_requests')
    .update({ status: 'approved' })
    .eq('id', requestId)
    .select('display_name, email')
    .single();

  // Send approval email to the new user
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && request?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${process.env.VERCEL_URL}`;
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    transporter.sendMail({
      from: `TeamBridge Tridents <${process.env.GMAIL_USER}>`,
      to: request.email,
      subject: '✅ Your TeamBridge account is approved',
      html: `
        <div style="font-family:sans-serif;font-size:15px;color:#111827;max-width:480px">
          <div style="background:#7e0027;color:#fff;font-weight:700;font-size:16px;padding:12px 16px;border-radius:6px 6px 0 0">
            Welcome to TeamBridge 👋
          </div>
          <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 6px 6px;padding:20px">
            <p style="margin:0 0 12px">Hi <strong>${request.display_name ?? ''}</strong>,</p>
            <p style="margin:0 0 16px;color:#374151">Your account has been approved. You can now log in with your email address:</p>
            <p style="margin:0 0 20px;font-weight:600;color:#7e0027">${request.email}</p>
            <a href="${appUrl}" style="display:inline-block;background:#7e0027;color:#fff;font-weight:700;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px">
              Open TeamBridge →
            </a>
            <p style="margin:20px 0 0;font-size:12px;color:#9ca3af">Shinshu Matsumoto Tridents · TeamBridge</p>
          </div>
        </div>
      `,
    }).catch(() => {});
  }

  // Notify all admins and super-admins about the new user
  const { data: adminProfiles } = await admin
    .from('profiles')
    .select('id')
    .or('is_super_admin.eq.true,is_admin.eq.true');

  const adminIds = (adminProfiles ?? []).map(p => p.id);
  if (adminIds.length) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${process.env.VERCEL_URL}`;
    fetch(`${appUrl}/api/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userIds: adminIds,
        title: '👤 New User Joined',
        body: `${request?.display_name ?? 'A new user'} has been approved and can now log in.`,
        url: '/?nav=admin',
        tag: 'new-user',
      }),
    }).catch(() => {});
  }

  return Response.json({ ok: true });
  } catch (err) {
    console.error('[invite]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
