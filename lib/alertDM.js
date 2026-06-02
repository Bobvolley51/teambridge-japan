import { supabase } from './supabase';

function dmChannel(uid1, uid2) {
  return 'dm:' + [uid1, uid2].sort().join('_');
}

// Send an alert DM from a player to Headcoach / Athletic Trainer / Therapist
export async function sendAlertDM(playerId, playerName, lines) {
  if (!lines.length) return;

  const { data: staff } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['Headcoach', 'Athletic Trainer', 'Therapist']);

  if (!staff?.length) return;

  const content = lines.join('\n');

  await supabase.from('messages').insert(
    staff.map(s => ({
      channel:       dmChannel(playerId, s.id),
      user_name:     playerName,
      user_initials: playerName.slice(0, 2).toUpperCase(),
      content,
      sender_id:     playerId,
    }))
  );
}
