import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  const { username } = body;
  if (!username) return Response.json({ error: 'Missing username.' }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data } = await admin
    .from('profiles')
    .select('email')
    .ilike('username', username.trim())
    .maybeSingle();

  if (!data?.email) return Response.json({ error: 'Username not found.' }, { status: 404 });
  return Response.json({ email: data.email });
  } catch (err) {
    console.error('[lookup-username]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
