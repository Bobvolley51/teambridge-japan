-- TeamBridge Japan — Account Request Queue
-- Run in: Supabase Dashboard → SQL Editor → New Query

create table if not exists account_requests (
  id           uuid        default gen_random_uuid() primary key,
  display_name text        not null,
  email        text        not null,
  message      text,
  status       text        not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  created_at   timestamptz default now(),
  unique (email)
);

alter table account_requests enable row level security;

-- Anyone can submit a request (not logged in)
create policy "anyone can request"  on account_requests for insert with check (true);
-- Logged-in users (admins) can read and update
create policy "admins can read"     on account_requests for select using (true);
create policy "admins can update"   on account_requests for update using (true);
create policy "admins can delete"   on account_requests for delete using (true);
