-- Persisted "Noticed" state for dashboard tasks per user
-- Run in: Supabase Dashboard → SQL Editor → New Query
create table if not exists task_dismissals (
  user_id      uuid not null references auth.users(id) on delete cascade,
  task_id      uuid not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

alter table task_dismissals enable row level security;

create policy "task_dismissals_select" on task_dismissals for select using (auth.uid() = user_id);
create policy "task_dismissals_insert" on task_dismissals for insert with check (auth.uid() = user_id);

-- Persisted "Noticed" state for medical alerts per user
-- alert_id is a synthetic string: "rec_<uuid>", "pain_<name>_<date>", "av_<player_id>_<ts>"
create table if not exists medical_noticed (
  user_id    uuid not null references auth.users(id) on delete cascade,
  alert_id   text not null,
  noticed_at timestamptz not null default now(),
  primary key (user_id, alert_id)
);

alter table medical_noticed enable row level security;

create policy "medical_noticed_select" on medical_noticed for select using (auth.uid() = user_id);
create policy "medical_noticed_insert" on medical_noticed for insert with check (auth.uid() = user_id);
