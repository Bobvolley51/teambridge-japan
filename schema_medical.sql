-- TeamBridge Japan — Medical / Therapist module
-- Run in: Supabase Dashboard → SQL Editor → New Query

-- ── Player availability (shared with coaching staff) ──────────────────────────
create table if not exists player_availability (
  id           uuid        default gen_random_uuid() primary key,
  player_id    uuid        not null unique,
  player_name  text        not null,
  status       text        not null default 'full'   check (status in ('full', 'limited', 'out')),
  reason       text,
  updated_by   text,
  updated_at   timestamptz default now()
);

alter table player_availability enable row level security;
drop policy if exists "read availability"   on player_availability;
drop policy if exists "write availability"  on player_availability;
create policy "read availability"  on player_availability for select using (true);
create policy "write availability" on player_availability for all    using (true) with check (true);

-- ── Medical communications (therapist → coaching staff) ──────────────────────
create table if not exists medical_comms (
  id          uuid        default gen_random_uuid() primary key,
  title       text        not null,
  content     text        not null,
  created_by  text        not null,
  created_at  timestamptz default now()
);

alter table medical_comms enable row level security;
drop policy if exists "read comms"  on medical_comms;
drop policy if exists "write comms" on medical_comms;
create policy "read comms"  on medical_comms for select using (true);
create policy "write comms" on medical_comms for all    using (true) with check (true);

-- ── Treatment log (private — therapist only, enforced client-side) ────────────
create table if not exists medical_records (
  id           uuid        default gen_random_uuid() primary key,
  player_id    uuid,
  player_name  text        not null,
  record_date  date        not null default current_date,
  body_part    text,
  injury_type  text,
  treatment    text,
  status       text        not null default 'active'  check (status in ('active', 'monitoring', 'cleared')),
  private_notes text,
  created_by   text,
  created_at   timestamptz default now()
);

alter table medical_records enable row level security;
drop policy if exists "read records"  on medical_records;
drop policy if exists "write records" on medical_records;
create policy "read records"  on medical_records for select using (true);
create policy "write records" on medical_records for all    using (true) with check (true);

create index if not exists med_rec_player_idx on medical_records (player_name, record_date desc);
