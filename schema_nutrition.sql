-- TeamBridge Japan — Nutrition Diary
-- Run in: Supabase Dashboard → SQL Editor → New Query

-- 1. Entries (one per player per meal per day)
create table if not exists nutrition_entries (
  id                      uuid        default gen_random_uuid() primary key,
  user_id                 uuid        not null,
  user_name               text        not null,
  meal_date               date        not null,
  meal_type               text        not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  notes                   text,
  coach_review_requested  boolean     not null default false,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),
  unique (user_id, meal_date, meal_type)
);

alter table nutrition_entries enable row level security;

drop policy if exists "nutr_entries_select" on nutrition_entries;
drop policy if exists "nutr_entries_insert" on nutrition_entries;
drop policy if exists "nutr_entries_update" on nutrition_entries;
drop policy if exists "nutr_entries_delete" on nutrition_entries;

create policy "nutr_entries_select" on nutrition_entries for select using (true);
create policy "nutr_entries_insert" on nutrition_entries for insert with check (auth.uid() = user_id);
create policy "nutr_entries_update" on nutrition_entries for update using (true);
create policy "nutr_entries_delete" on nutrition_entries for delete using (auth.uid() = user_id);

create index if not exists nutr_entries_user_date on nutrition_entries (user_id, meal_date desc);
create index if not exists nutr_entries_date      on nutrition_entries (meal_date desc);

-- 2. Photos (multiple per entry)
create table if not exists nutrition_photos (
  id           uuid        default gen_random_uuid() primary key,
  entry_id     uuid        not null references nutrition_entries(id) on delete cascade,
  storage_path text        not null,
  created_at   timestamptz default now()
);

alter table nutrition_photos enable row level security;

drop policy if exists "nutr_photos_select" on nutrition_photos;
drop policy if exists "nutr_photos_insert" on nutrition_photos;
drop policy if exists "nutr_photos_delete" on nutrition_photos;

create policy "nutr_photos_select" on nutrition_photos for select using (true);
create policy "nutr_photos_insert" on nutrition_photos for insert with check (true);
create policy "nutr_photos_delete" on nutrition_photos for delete using (true);

create index if not exists nutr_photos_entry on nutrition_photos (entry_id);

-- 3. Comments / trainer feedback (one per trainer per entry, upsert by author+entry)
create table if not exists nutrition_comments (
  id          uuid        default gen_random_uuid() primary key,
  entry_id    uuid        not null references nutrition_entries(id) on delete cascade,
  author_id   uuid        not null,
  author_name text        not null,
  comment     text        not null default '',
  rating      text        check (rating in ('green','yellow','red')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (entry_id, author_id)
);

alter table nutrition_comments enable row level security;

drop policy if exists "nutr_comments_select" on nutrition_comments;
drop policy if exists "nutr_comments_insert" on nutrition_comments;
drop policy if exists "nutr_comments_update" on nutrition_comments;

create policy "nutr_comments_select" on nutrition_comments for select using (true);
create policy "nutr_comments_insert" on nutrition_comments for insert with check (auth.uid() = author_id);
create policy "nutr_comments_update" on nutrition_comments for update using (auth.uid() = author_id);

create index if not exists nutr_comments_entry on nutrition_comments (entry_id);

-- Storage bucket: create manually in Supabase Dashboard → Storage → New bucket
-- Name: nutrition-photos
-- Public: true (URLs are long/unguessable; keeping public avoids signed-URL complexity)
-- File size limit: 2MB (client compresses to ~500KB before upload)
