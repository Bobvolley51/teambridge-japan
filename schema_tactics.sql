-- ============================================================
-- TeamBridge Japan — Tactics (opponent scouting)
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

create table if not exists tactics_teams (
  id         uuid        default gen_random_uuid() primary key,
  name       text        not null,
  abbr       text        not null,
  color      text        not null default '#6b7280',
  logo_url   text,
  sort_order int         not null default 0,
  created_at timestamptz default now()
);

create unique index if not exists tactics_teams_name_idx on tactics_teams (lower(name));

alter table tactics_teams enable row level security;
create policy "read tactics_teams"   on tactics_teams for select using (true);
create policy "manage tactics_teams" on tactics_teams for all
  using      (auth.uid() is not null)
  with check (auth.uid() is not null);

-- ── Seed SV League teams ───────────────────────────────────────────────────────

insert into tactics_teams (name, abbr, color, sort_order) values
  ('Suntory Sunbirds',         'SUN', '#003087', 1),
  ('JT Thunders Hiroshima',    'JTH', '#e8500a', 2),
  ('Panasonic Panthers',       'PAN', '#0066b3', 3),
  ('Wolfdogs Nagoya',          'WOL', '#c8102e', 4),
  ('VC Nagano Tridents',       'VCN', '#1d6f42', 5),
  ('Toray Arrows',             'TOR', '#002d74', 6),
  ('Osaka Blazers Sakai',      'OSA', '#cc0000', 7),
  ('FC Tokyo',                 'FCT', '#0033a0', 8),
  ('JTEKT Stings Aichi',       'JTE', '#ff5500', 9),
  ('Cube Hokkaido',            'CUB', '#009ee3', 10)
on conflict do nothing;

-- ── Tactics notes ──────────────────────────────────────────────────────────────

create table if not exists tactics_notes (
  id          uuid        default gen_random_uuid() primary key,
  team_id     uuid        not null references tactics_teams(id) on delete cascade,
  category    text        not null, -- scouting | setters | servers | spikers | videos
  title       text,
  body        text,
  url         text,
  jersey      text,
  author_name text        not null default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table tactics_notes enable row level security;
create policy "read tactics_notes"   on tactics_notes for select using (true);
create policy "manage tactics_notes" on tactics_notes for all
  using      (auth.uid() is not null)
  with check (auth.uid() is not null);

create index if not exists tactics_notes_team_cat_idx
  on tactics_notes (team_id, category, created_at desc);

alter publication supabase_realtime add table tactics_notes;
