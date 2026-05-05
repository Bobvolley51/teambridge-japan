-- ============================================================
-- TeamBridge Japan — Channels + Channel Members
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

create table if not exists channels (
  id          text primary key,          -- slug, e.g. 'general'
  name        text not null,
  description text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz default now()
);

-- Seed the three channels that were previously hard-coded
insert into channels (id, name) values
  ('general',       'general'),
  ('project-alpha', 'project-alpha'),
  ('dev',           'dev')
on conflict (id) do nothing;

alter table channels enable row level security;

create policy "read channels"
  on channels for select using (true);

create policy "non-players manage channels"
  on channels for all
  using      (exists (select 1 from profiles where id = auth.uid() and role <> 'Player'))
  with check (exists (select 1 from profiles where id = auth.uid() and role <> 'Player'));

-- ── Channel members ───────────────────────────────────────────

create table if not exists channel_members (
  channel_id  text not null references channels(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  added_at    timestamptz default now(),
  primary key (channel_id, profile_id)
);

alter table channel_members enable row level security;

create policy "read channel_members"
  on channel_members for select using (true);

create policy "non-players manage channel_members"
  on channel_members for all
  using      (exists (select 1 from profiles where id = auth.uid() and role <> 'Player'))
  with check (exists (select 1 from profiles where id = auth.uid() and role <> 'Player'));
