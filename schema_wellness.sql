-- TeamBridge Japan — Daily Wellness Check-in
-- Run in: Supabase Dashboard → SQL Editor → New Query

create table if not exists wellness_responses (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        not null,
  user_name     text        not null,
  question_key  text        not null,
  score         int         not null check (score between 1 and 10),
  response_date date        not null default current_date,
  created_at    timestamptz default now(),
  unique (user_id, question_key, response_date)
);

alter table wellness_responses enable row level security;

create policy "insert own responses"   on wellness_responses for insert with check (true);
create policy "read all responses"     on wellness_responses for select using (true);
create policy "upsert own responses"   on wellness_responses for update using (true);

create index if not exists wellness_user_date_idx on wellness_responses (user_id, response_date desc);
create index if not exists wellness_date_idx      on wellness_responses (response_date desc);
