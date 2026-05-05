-- Travel section extensions
-- Run in: Supabase Dashboard → SQL Editor → New Query

-- Extra detail fields on travel_trips
alter table travel_trips
  add column if not exists flight_number text,
  add column if not exists hotel_name    text,
  add column if not exists hotel_address text;

-- Who's on the trip
create table if not exists travel_participants (
  trip_id    uuid not null references travel_trips(id) on delete cascade,
  profile_id uuid not null references profiles(id)     on delete cascade,
  primary key (trip_id, profile_id)
);

-- Shared packing list items (staff create, all users see)
create table if not exists travel_packing_items (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references travel_trips(id) on delete cascade,
  title      text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

-- Per-user packed checkbox (strictly private — each user only sees their own)
create table if not exists travel_packing_checks (
  item_id uuid not null references travel_packing_items(id) on delete cascade,
  user_id uuid not null references auth.users(id)           on delete cascade,
  primary key (item_id, user_id)
);

-- RLS
alter table travel_participants   enable row level security;
alter table travel_packing_items  enable row level security;
alter table travel_packing_checks enable row level security;

-- Participants: all authenticated users can read; authenticated can write (app enforces canEdit)
create policy "tp_read"  on travel_participants for select to authenticated using (true);
create policy "tp_write" on travel_participants for all    to authenticated using (true) with check (true);

-- Packing items: all authenticated can read; authenticated can write
create policy "tpi_read"  on travel_packing_items for select to authenticated using (true);
create policy "tpi_write" on travel_packing_items for all    to authenticated using (true) with check (true);

-- Packing checks: each user can only read and write their own rows
create policy "tpc_own" on travel_packing_checks
  for all to authenticated
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());
