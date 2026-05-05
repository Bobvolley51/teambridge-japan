// app/api/invite/route.js
// Approves an account request by confirming the user's email.
// The user already exists (created during request) — this just unlocks them.

import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  const { requestId, userId } = await req.json();

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

  await admin.from('account_requests').update({ status: 'approved' }).eq('id', requestId);

  return Response.json({ ok: true });
}
