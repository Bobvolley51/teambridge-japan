import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(req) {
  const { searchParams } = new URL(req.url);

  if (!searchParams.has('seed')) {
    const [{ count: rpeCount }, { count: playerCount }] = await Promise.all([
      supabase.from('session_rpe').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'Player'),
    ]);
    return Response.json({ session_rpe_rows: rpeCount, player_profiles: playerCount });
  }

  // ?seed — insert test data
  // Get all players
  const { data: players } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('role', 'Player')
    .not('display_name', 'is', null);

  if (!players?.length) return Response.json({ error: 'No players found' }, { status: 400 });

  // Sessions spread over last 28 days
  const sessions = [
    { daysAgo: 2,  title: 'Training',  rpe: 7, dur: 90  },
    { daysAgo: 4,  title: 'Training',  rpe: 6, dur: 85  },
    { daysAgo: 7,  title: 'Game',      rpe: 8, dur: 110 },
    { daysAgo: 9,  title: 'Training',  rpe: 5, dur: 80  },
    { daysAgo: 11, title: 'Training',  rpe: 7, dur: 95  },
    { daysAgo: 14, title: 'Game',      rpe: 9, dur: 105 },
    { daysAgo: 16, title: 'Training',  rpe: 6, dur: 90  },
    { daysAgo: 18, title: 'Training',  rpe: 4, dur: 75  },
    { daysAgo: 21, title: 'Training',  rpe: 8, dur: 100 },
    { daysAgo: 23, title: 'Game',      rpe: 7, dur: 110 },
    { daysAgo: 25, title: 'Training',  rpe: 5, dur: 85  },
    { daysAgo: 28, title: 'Training',  rpe: 6, dur: 90  },
  ];

  function dateAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }

  // Add small per-player variation so ACWR values differ
  const rows = players.flatMap((p, pi) =>
    sessions.map(s => {
      const rpe = Math.min(10, Math.max(1, s.rpe + (pi % 3) - 1));
      const dur = s.dur + (pi % 4) * 5;
      return {
        user_id:      p.id,
        user_name:    p.display_name,
        event_id:     null,
        event_title:  s.title,
        event_date:   dateAgo(s.daysAgo),
        rpe,
        duration_min: dur,
        load_au:      rpe * dur,
      };
    })
  );

  const { error } = await supabase.from('session_rpe').insert(rows);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ inserted: rows.length, players: players.length });
}

