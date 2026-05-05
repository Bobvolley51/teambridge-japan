-- ============================================================
-- TeamBridge Japan — Recurrence + Participants for Events
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Add recurrence columns to events
alter table events
  add column if not exists recurrence      text,  -- null | 'daily' | 'weekly' | 'monthly' | 'yearly'
  add column if not exists recurrence_end  date;  -- null = never ends

-- Participants junction table
create table if not exists event_participants (
  event_id    uuid not null references events(id)   on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  primary key (event_id, profile_id)
);

alter table event_participants enable row level security;
create policy "read event_participants"   on event_participants for select using (true);
create policy "insert event_participants" on event_participants for insert with check (true);
create policy "delete event_participants" on event_participants for delete using (true);
