-- ============================================================
-- TeamBridge Japan — Events / Calendar
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

create table if not exists events (
  id          uuid        default gen_random_uuid() primary key,
  title       text        not null,
  description text,
  location    text,
  start_time  timestamptz not null,
  end_time    timestamptz not null,
  all_day     boolean     not null default false,
  created_by  text        not null,
  created_at  timestamptz default now()
);

alter table events enable row level security;
create policy "read events"   on events for select using (true);
create policy "insert events" on events for insert with check (true);
create policy "update events" on events for update using (true);
create policy "delete events" on events for delete using (true);

alter publication supabase_realtime add table events;

create index if not exists events_start_idx on events (start_time asc);
