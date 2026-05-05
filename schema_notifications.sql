-- Notifications table
-- Run in: Supabase Dashboard → SQL Editor → New Query

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,  -- 'announcement', 'calendar_invite', 'task_deadline'
  title      text not null,
  body       text,
  nav_target text,           -- nav section to open on click
  ref_id     uuid,           -- announcement/event/task id
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "notif_select" on notifications for select using (auth.uid() = user_id);
create policy "notif_insert" on notifications for insert with check (auth.role() = 'authenticated');
create policy "notif_update" on notifications for update using (auth.uid() = user_id);

-- Enable realtime
alter publication supabase_realtime add table notifications;
