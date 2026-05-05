-- ============================================================
-- TeamBridge Japan — Session RPE & Training Load
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

create table if not exists session_rpe (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  user_name     text        not null,
  event_id      uuid        not null references events(id)     on delete cascade,
  event_title   text,
  event_date    date        not null,
  rpe           integer     not null check (rpe >= 1 and rpe <= 10),
  duration_min  integer     not null check (duration_min > 0),
  load_au       integer     not null,   -- rpe × duration_min
  created_at    timestamptz default now(),
  unique (user_id, event_id)
);

alter table session_rpe enable row level security;
create policy "read session_rpe"   on session_rpe for select using (true);
create policy "insert session_rpe" on session_rpe for insert with check (true);
create policy "update session_rpe" on session_rpe for update using (true);

-- ============================================================
-- TeamBridge Japan — Wellness Body Pain (if not yet run)
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

create table if not exists wellness_body_pain (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  user_name     text        not null,
  response_date date        not null,
  body_part     text        not null,
  created_at    timestamptz default now()
);

alter table wellness_body_pain enable row level security;
create policy "read wellness_body_pain"   on wellness_body_pain for select using (true);
create policy "insert wellness_body_pain" on wellness_body_pain for insert with check (true);
create policy "delete wellness_body_pain" on wellness_body_pain for delete using (true);
