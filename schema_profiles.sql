-- ============================================================
-- TeamBridge Japan — Profiles & Roles
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Profiles table
create table if not exists profiles (
  id           uuid references auth.users on delete cascade primary key,
  email        text not null,
  display_name text,
  role         text not null default 'Player',
  created_at   timestamptz default now()
);

-- 2. RLS
alter table profiles enable row level security;
create policy "Anyone can read profiles"        on profiles for select using (true);
create policy "Anyone can insert profiles"      on profiles for insert with check (true);
create policy "Authenticated can update profiles" on profiles for update using (auth.uid() is not null);

-- 3. Auto-create profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'Player')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Insert profiles for users that already exist
insert into public.profiles (id, email, role)
select id, email, 'Player'
from auth.users
on conflict (id) do nothing;
