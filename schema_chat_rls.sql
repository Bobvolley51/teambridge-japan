-- RLS policies for channel_reads and message_reactions
-- Run in: Supabase Dashboard → SQL Editor → New Query

-- channel_reads: tracks each user's last-read position per channel
alter table channel_reads enable row level security;

create policy "channel_reads_select" on channel_reads
  for select using (auth.uid() = user_id);

create policy "channel_reads_insert" on channel_reads
  for insert with check (auth.uid() = user_id);

create policy "channel_reads_update" on channel_reads
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- message_reactions: emoji reactions on chat messages
alter table message_reactions enable row level security;

create policy "message_reactions_select" on message_reactions
  for select using (auth.role() = 'authenticated');

create policy "message_reactions_insert" on message_reactions
  for insert with check (auth.uid() = user_id);

create policy "message_reactions_delete" on message_reactions
  for delete using (auth.uid() = user_id);
