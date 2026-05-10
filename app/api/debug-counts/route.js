import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const [{ count: rpeCount }, { count: playerCount }] = await Promise.all([
    supabase.from('session_rpe').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'Player'),
  ]);

  return Response.json({ session_rpe_rows: rpeCount, player_profiles: playerCount });
}
