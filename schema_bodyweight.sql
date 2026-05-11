-- TeamBridge Japan — Weekly player body weight
-- Run in: Supabase Dashboard → SQL Editor → New Query

create table if not exists player_bodyweight (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        not null,
  user_name     text        not null,
  weight_kg     numeric(5,2) not null,
  week_start    date        not null,   -- Monday of the ISO week
  recorded_date date        not null default current_date,
  created_at    timestamptz default now(),
  unique (user_id, week_start)
);

alter table player_bodyweight enable row level security;

drop policy if exists "insert own weight" on player_bodyweight;
drop policy if exists "upsert own weight" on player_bodyweight;
drop policy if exists "read all weights"  on player_bodyweight;

create policy "insert own weight"  on player_bodyweight for insert with check (true);
create policy "upsert own weight"  on player_bodyweight for update using (true);
create policy "read all weights"   on player_bodyweight for select using (true);

create index if not exists bw_user_week_idx on player_bodyweight (user_id, week_start desc);
create index if not exists bw_week_idx      on player_bodyweight (week_start desc);
