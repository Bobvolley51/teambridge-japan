-- Announcement read receipts
-- Run in: Supabase Dashboard → SQL Editor → New Query

create table if not exists announcement_reads (
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table announcement_reads enable row level security;

create policy "reads_select" on announcement_reads for select using (auth.role() = 'authenticated');
create policy "reads_insert" on announcement_reads for insert with check (auth.uid() = user_id);
