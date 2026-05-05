-- ============================================================
-- TeamBridge Japan — Complete Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Messages (Chat)
create table if not exists messages (
  id             uuid        default gen_random_uuid() primary key,
  channel        text        not null default 'general',
  user_name      text        not null,
  user_initials  text        not null,
  content        text        not null,
  created_at     timestamptz default now()
);
alter table messages enable row level security;
create policy "read messages"   on messages for select using (true);
create policy "insert messages" on messages for insert with check (true);

-- 2. Tasks (Kanban)
create table if not exists tasks (
  id          uuid        default gen_random_uuid() primary key,
  title       text        not null,
  status      text        not null default 'todo',
  assignee    text,
  priority    text        not null default 'medium',
  created_at  timestamptz default now()
);
alter table tasks enable row level security;
create policy "read tasks"   on tasks for select using (true);
create policy "insert tasks" on tasks for insert with check (true);
create policy "update tasks" on tasks for update using (true);
create policy "delete tasks" on tasks for delete using (true);

-- 3. Announcements (Feed)
create table if not exists announcements (
  id           uuid        default gen_random_uuid() primary key,
  title        text        not null,
  content      text        not null,
  author_name  text        not null,
  priority     text        not null default 'medium',
  created_at   timestamptz default now()
);
alter table announcements enable row level security;
create policy "read announcements"   on announcements for select using (true);
create policy "insert announcements" on announcements for insert with check (true);

-- 4. Enable Realtime
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table announcements;

-- 5. Indexes
create index if not exists messages_channel_idx     on messages      (channel, created_at desc);
create index if not exists tasks_status_idx          on tasks         (status, created_at asc);
create index if not exists announcements_created_idx on announcements (created_at desc);
