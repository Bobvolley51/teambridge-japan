-- ============================================================
-- TeamBridge Japan — VC Nagano Tridents Demo Data
-- 14 players with realistic fake dataset across all modules
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. AUTH USERS ─────────────────────────────────────────────
-- Creates fake login accounts (no real auth flow needed for demo)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role, raw_user_meta_data
) VALUES
  ('00000001-0000-0000-0000-000000000001','yamada.koki@tridents-demo.jp',   '','2026-01-01 00:00:00+00',NOW(),NOW(),'authenticated','authenticated','{}'),
  ('00000001-0000-0000-0000-000000000002','fujisawa.k@tridents-demo.jp',    '','2026-01-01 00:00:00+00',NOW(),NOW(),'authenticated','authenticated','{}'),
  ('00000001-0000-0000-0000-000000000003','sakai.shusuke@tridents-demo.jp', '','2026-01-01 00:00:00+00',NOW(),NOW(),'authenticated','authenticated','{}'),
  ('00000001-0000-0000-0000-000000000004','chiba.kanze@tridents-demo.jp',   '','2026-01-01 00:00:00+00',NOW(),NOW(),'authenticated','authenticated','{}'),
  ('00000001-0000-0000-0000-000000000005','nanba.koji@tridents-demo.jp',    '','2026-01-01 00:00:00+00',NOW(),NOW(),'authenticated','authenticated','{}'),
  ('00000001-0000-0000-0000-000000000006','akahoshi.s@tridents-demo.jp',    '','2026-01-01 00:00:00+00',NOW(),NOW(),'authenticated','authenticated','{}'),
  ('00000001-0000-0000-0000-000000000007','nakashima.k@tridents-demo.jp',   '','2026-01-01 00:00:00+00',NOW(),NOW(),'authenticated','authenticated','{}'),
  ('00000001-0000-0000-0000-000000000008','fujiwara.s@tridents-demo.jp',    '','2026-01-01 00:00:00+00',NOW(),NOW(),'authenticated','authenticated','{}'),
  ('00000001-0000-0000-0000-000000000009','yasuhara.d@tridents-demo.jp',    '','2026-01-01 00:00:00+00',NOW(),NOW(),'authenticated','authenticated','{}'),
  ('00000001-0000-0000-0000-000000000010','kudo.yuji@tridents-demo.jp',     '','2026-01-01 00:00:00+00',NOW(),NOW(),'authenticated','authenticated','{}'),
  ('00000001-0000-0000-0000-000000000011','hoshina.y@tridents-demo.jp',     '','2026-01-01 00:00:00+00',NOW(),NOW(),'authenticated','authenticated','{}'),
  ('00000001-0000-0000-0000-000000000012','iida.koga@tridents-demo.jp',     '','2026-01-01 00:00:00+00',NOW(),NOW(),'authenticated','authenticated','{}'),
  ('00000001-0000-0000-0000-000000000013','matthew.neaves@tridents-demo.jp','','2026-01-01 00:00:00+00',NOW(),NOW(),'authenticated','authenticated','{}'),
  ('00000001-0000-0000-0000-000000000014','sato.ryuya@tridents-demo.jp',    '','2026-01-01 00:00:00+00',NOW(),NOW(),'authenticated','authenticated','{}')
ON CONFLICT (id) DO NOTHING;

-- ── 2. PROFILES ───────────────────────────────────────────────
INSERT INTO profiles (id, email, display_name, role, position, jersey_number)
VALUES
  ('00000001-0000-0000-0000-000000000001','yamada.koki@tridents-demo.jp',   'Yamada Koki',       'Player','Middle',   1),
  ('00000001-0000-0000-0000-000000000002','fujisawa.k@tridents-demo.jp',    'Fujisawa Keiichiro','Player','Libero',   2),
  ('00000001-0000-0000-0000-000000000003','sakai.shusuke@tridents-demo.jp', 'Sakai Shusuke',     'Player','Opposite', 3),
  ('00000001-0000-0000-0000-000000000004','chiba.kanze@tridents-demo.jp',   'Chiba Kanze',       'Player','Middle',   4),
  ('00000001-0000-0000-0000-000000000005','nanba.koji@tridents-demo.jp',    'Nanba Koji',        'Player','Libero',   5),
  ('00000001-0000-0000-0000-000000000006','akahoshi.s@tridents-demo.jp',    'Akahoshi Shinjo',   'Player','Setter',   6),
  ('00000001-0000-0000-0000-000000000007','nakashima.k@tridents-demo.jp',   'Nakashima Kento',   'Player','Setter',   8),
  ('00000001-0000-0000-0000-000000000008','fujiwara.s@tridents-demo.jp',    'Fujiwara Shota',    'Player','Outside',  9),
  ('00000001-0000-0000-0000-000000000009','yasuhara.d@tridents-demo.jp',    'Yasuhara Dai',      'Player','Middle',  10),
  ('00000001-0000-0000-0000-000000000010','kudo.yuji@tridents-demo.jp',     'Kudo Yuji',         'Player','Outside', 11),
  ('00000001-0000-0000-0000-000000000011','hoshina.y@tridents-demo.jp',     'Hoshina Yusuke',    'Player','Setter',  12),
  ('00000001-0000-0000-0000-000000000012','iida.koga@tridents-demo.jp',     'Iida Koga',         'Player','Opposite',13),
  ('00000001-0000-0000-0000-000000000013','matthew.neaves@tridents-demo.jp','Matthew Neaves',    'Player','Opposite',14),
  ('00000001-0000-0000-0000-000000000014','sato.ryuya@tridents-demo.jp',    'Sato Ryuya',        'Player','Outside', 18)
ON CONFLICT (id) DO UPDATE SET
  display_name  = EXCLUDED.display_name,
  role          = EXCLUDED.role,
  position      = EXCLUDED.position,
  jersey_number = EXCLUDED.jersey_number;

-- ── 3. WELLNESS — last 14 days (fatigue / sleep / appetite) ───
WITH
players(uid, uname) AS (VALUES
  ('00000001-0000-0000-0000-000000000001'::uuid,'Yamada Koki'),
  ('00000001-0000-0000-0000-000000000002'::uuid,'Fujisawa Keiichiro'),
  ('00000001-0000-0000-0000-000000000003'::uuid,'Sakai Shusuke'),
  ('00000001-0000-0000-0000-000000000004'::uuid,'Chiba Kanze'),
  ('00000001-0000-0000-0000-000000000005'::uuid,'Nanba Koji'),
  ('00000001-0000-0000-0000-000000000006'::uuid,'Akahoshi Shinjo'),
  ('00000001-0000-0000-0000-000000000007'::uuid,'Nakashima Kento'),
  ('00000001-0000-0000-0000-000000000008'::uuid,'Fujiwara Shota'),
  ('00000001-0000-0000-0000-000000000009'::uuid,'Yasuhara Dai'),
  ('00000001-0000-0000-0000-000000000010'::uuid,'Kudo Yuji'),
  ('00000001-0000-0000-0000-000000000011'::uuid,'Hoshina Yusuke'),
  ('00000001-0000-0000-0000-000000000012'::uuid,'Iida Koga'),
  ('00000001-0000-0000-0000-000000000013'::uuid,'Matthew Neaves'),
  ('00000001-0000-0000-0000-000000000014'::uuid,'Sato Ryuya')
),
dates AS (
  SELECT generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day'::interval)::date AS d
),
questions(qkey) AS (VALUES ('fatigue'),('sleep'),('appetite'))
INSERT INTO wellness_responses (user_id, user_name, question_key, score, response_date)
SELECT
  p.uid, p.uname, q.qkey,
  -- Score 4–9; occasionally dip to 3 for realism
  GREATEST(3, LEAST(10, 6 + (abs(hashtext(p.uid::text || d.d::text || q.qkey)) % 5) - 2)) AS score,
  d.d
FROM players p, dates d, questions q
-- 82% daily compliance
WHERE (abs(hashtext(p.uid::text || d.d::text)) % 100) < 82
ON CONFLICT (user_id, question_key, response_date) DO NOTHING;

-- ── 4. NUTRITION — last 14 days ───────────────────────────────
WITH
players(uid, uname) AS (VALUES
  ('00000001-0000-0000-0000-000000000001'::uuid,'Yamada Koki'),
  ('00000001-0000-0000-0000-000000000002'::uuid,'Fujisawa Keiichiro'),
  ('00000001-0000-0000-0000-000000000003'::uuid,'Sakai Shusuke'),
  ('00000001-0000-0000-0000-000000000004'::uuid,'Chiba Kanze'),
  ('00000001-0000-0000-0000-000000000005'::uuid,'Nanba Koji'),
  ('00000001-0000-0000-0000-000000000006'::uuid,'Akahoshi Shinjo'),
  ('00000001-0000-0000-0000-000000000007'::uuid,'Nakashima Kento'),
  ('00000001-0000-0000-0000-000000000008'::uuid,'Fujiwara Shota'),
  ('00000001-0000-0000-0000-000000000009'::uuid,'Yasuhara Dai'),
  ('00000001-0000-0000-0000-000000000010'::uuid,'Kudo Yuji'),
  ('00000001-0000-0000-0000-000000000011'::uuid,'Hoshina Yusuke'),
  ('00000001-0000-0000-0000-000000000012'::uuid,'Iida Koga'),
  ('00000001-0000-0000-0000-000000000013'::uuid,'Matthew Neaves'),
  ('00000001-0000-0000-0000-000000000014'::uuid,'Sato Ryuya')
),
dates AS (
  SELECT generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day'::interval)::date AS d
),
meals(mtype) AS (VALUES ('breakfast'),('lunch'),('dinner'),('snack')),
combos AS (
  SELECT p.uid, p.uname, d.d, m.mtype,
    abs(hashtext(p.uid::text || d.d::text || m.mtype || 'r')) % 10 AS rnd
  FROM players p, dates d, meals m
  -- 73% per-meal compliance
  WHERE (abs(hashtext(p.uid::text || d.d::text || m.mtype)) % 100) < 73
)
INSERT INTO nutrition_entries (user_id, user_name, meal_date, meal_type, player_rating)
SELECT
  uid, uname, d, mtype,
  CASE
    WHEN rnd = 0 THEN 'red'
    WHEN rnd <= 3 THEN 'yellow'
    ELSE 'green'
  END
FROM combos
ON CONFLICT (user_id, meal_date, meal_type) DO NOTHING;

-- ── 5. VERT SESSIONS — 5 sessions (liberos excluded) ──────────
WITH
vert_players(uid, uname, pos) AS (VALUES
  ('00000001-0000-0000-0000-000000000001'::uuid,'Yamada Koki',    'Middle'),
  ('00000001-0000-0000-0000-000000000003'::uuid,'Sakai Shusuke',  'Opposite'),
  ('00000001-0000-0000-0000-000000000004'::uuid,'Chiba Kanze',    'Middle'),
  ('00000001-0000-0000-0000-000000000006'::uuid,'Akahoshi Shinjo','Setter'),
  ('00000001-0000-0000-0000-000000000007'::uuid,'Nakashima Kento','Setter'),
  ('00000001-0000-0000-0000-000000000008'::uuid,'Fujiwara Shota', 'Outside'),
  ('00000001-0000-0000-0000-000000000009'::uuid,'Yasuhara Dai',   'Middle'),
  ('00000001-0000-0000-0000-000000000010'::uuid,'Kudo Yuji',      'Outside'),
  ('00000001-0000-0000-0000-000000000011'::uuid,'Hoshina Yusuke', 'Setter'),
  ('00000001-0000-0000-0000-000000000012'::uuid,'Iida Koga',      'Opposite'),
  ('00000001-0000-0000-0000-000000000013'::uuid,'Matthew Neaves', 'Opposite'),
  ('00000001-0000-0000-0000-000000000014'::uuid,'Sato Ryuya',     'Outside')
),
sessions(sdate, sname) AS (VALUES
  ('2026-04-15'::date,'Morning Practice'),
  ('2026-04-22'::date,'Practice'),
  ('2026-04-29'::date,'Match vs Voreas'),
  ('2026-05-06'::date,'Practice'),
  ('2026-05-09'::date,'Practice')
),
-- Position baselines: jumps, hi_jump_cm, jpam, power, hi_pct, alert_pct, elev_pct, energy, sets, intensity
baselines(pos, bj, bh, bp, bpw, bhip, bap, bep, ben, bse, bi) AS (VALUES
  ('Setter',   95, 44.0, 0.85, 43,  8, 3,  9, 4100, 3.0, 63),
  ('Middle',  128, 52.0, 1.10, 53, 13, 7, 17, 5900, 4.6, 79),
  ('Outside', 118, 50.0, 1.00, 50, 11, 5, 14, 5500, 4.3, 73),
  ('Opposite',122, 53.0, 1.05, 54, 12, 6, 15, 5700, 4.4, 76)
),
raw AS (
  SELECT p.uid, p.uname, p.pos, s.sdate, s.sname,
         b.bj, b.bh, b.bp, b.bpw, b.bhip, b.bap, b.bep, b.ben, b.bse, b.bi
  FROM vert_players p
  CROSS JOIN sessions s
  JOIN baselines b ON b.pos = p.pos
)
INSERT INTO vert_sessions (
  session_date, session_name, vert_name, user_id,
  jumps, avg_hi_jump_cm, jpam, avg_hi_jump_power,
  high_impact_pct, alert_impact_pct, elevated_pct,
  energy, sets_by_energy, intensity
)
SELECT
  sdate, sname, uname, uid,
  bj  + (abs(hashtext(uid::text||sdate::text||'j'))  % 25) - 12,
  round((bh + ((abs(hashtext(uid::text||sdate::text||'h')) % 70) - 35)::numeric / 10.0), 1),
  round((bp + ((abs(hashtext(uid::text||sdate::text||'p')) % 60) - 30)::numeric / 100.0), 2),
  bpw + (abs(hashtext(uid::text||sdate::text||'pw')) % 12) - 6,
  GREATEST(2, LEAST(25, bhip + (abs(hashtext(uid::text||sdate::text||'hip')) % 10) - 5)),
  GREATEST(1, LEAST(15, bap  + (abs(hashtext(uid::text||sdate::text||'ap'))  % 6)  - 3)),
  GREATEST(3, LEAST(30, bep  + (abs(hashtext(uid::text||sdate::text||'ep'))  % 12) - 6)),
  ben + (abs(hashtext(uid::text||sdate::text||'en')) % 1200) - 600,
  round((bse + ((abs(hashtext(uid::text||sdate::text||'se')) % 40) - 20)::numeric / 10.0), 1),
  GREATEST(50, LEAST(100, bi + (abs(hashtext(uid::text||sdate::text||'ii')) % 20) - 10))
FROM raw;

-- ── 6. EVENTS ─────────────────────────────────────────────────
INSERT INTO events (id, title, start_time, end_time, all_day, created_by)
VALUES
  ('00000002-0000-0000-0000-000000000001','Morning Practice', '2026-04-15 09:00:00+09','2026-04-15 11:00:00+09',false,'Demo'),
  ('00000002-0000-0000-0000-000000000002','Evening Practice', '2026-04-19 17:00:00+09','2026-04-19 19:00:00+09',false,'Demo'),
  ('00000002-0000-0000-0000-000000000003','Practice',         '2026-04-22 09:00:00+09','2026-04-22 11:30:00+09',false,'Demo'),
  ('00000002-0000-0000-0000-000000000004','Match vs Voreas',  '2026-04-29 14:00:00+09','2026-04-29 17:00:00+09',false,'Demo'),
  ('00000002-0000-0000-0000-000000000005','Practice',         '2026-04-28 09:00:00+09','2026-04-28 11:00:00+09',false,'Demo'),
  ('00000002-0000-0000-0000-000000000006','Practice',         '2026-05-01 17:00:00+09','2026-05-01 19:00:00+09',false,'Demo'),
  ('00000002-0000-0000-0000-000000000007','Morning Practice', '2026-05-03 09:00:00+09','2026-05-03 11:30:00+09',false,'Demo'),
  ('00000002-0000-0000-0000-000000000008','Match vs Tokyo',   '2026-05-07 14:00:00+09','2026-05-07 17:00:00+09',false,'Demo'),
  ('00000002-0000-0000-0000-000000000009','Practice',         '2026-05-09 09:00:00+09','2026-05-09 11:00:00+09',false,'Demo'),
  ('00000002-0000-0000-0000-000000000010','Morning Practice', '2026-05-12 09:00:00+09','2026-05-12 11:00:00+09',false,'Demo')
ON CONFLICT (id) DO NOTHING;

-- ── 7. SESSION RPE ────────────────────────────────────────────
WITH
players(uid, uname) AS (VALUES
  ('00000001-0000-0000-0000-000000000001'::uuid,'Yamada Koki'),
  ('00000001-0000-0000-0000-000000000002'::uuid,'Fujisawa Keiichiro'),
  ('00000001-0000-0000-0000-000000000003'::uuid,'Sakai Shusuke'),
  ('00000001-0000-0000-0000-000000000004'::uuid,'Chiba Kanze'),
  ('00000001-0000-0000-0000-000000000005'::uuid,'Nanba Koji'),
  ('00000001-0000-0000-0000-000000000006'::uuid,'Akahoshi Shinjo'),
  ('00000001-0000-0000-0000-000000000007'::uuid,'Nakashima Kento'),
  ('00000001-0000-0000-0000-000000000008'::uuid,'Fujiwara Shota'),
  ('00000001-0000-0000-0000-000000000009'::uuid,'Yasuhara Dai'),
  ('00000001-0000-0000-0000-000000000010'::uuid,'Kudo Yuji'),
  ('00000001-0000-0000-0000-000000000011'::uuid,'Hoshina Yusuke'),
  ('00000001-0000-0000-0000-000000000012'::uuid,'Iida Koga'),
  ('00000001-0000-0000-0000-000000000013'::uuid,'Matthew Neaves'),
  ('00000001-0000-0000-0000-000000000014'::uuid,'Sato Ryuya')
),
event_data(eid, etitle, edate, is_match, dur) AS (VALUES
  ('00000002-0000-0000-0000-000000000001'::uuid,'Morning Practice', '2026-04-15'::date,false,120),
  ('00000002-0000-0000-0000-000000000002'::uuid,'Evening Practice', '2026-04-19'::date,false,120),
  ('00000002-0000-0000-0000-000000000003'::uuid,'Practice',         '2026-04-22'::date,false,150),
  ('00000002-0000-0000-0000-000000000004'::uuid,'Match vs Voreas',  '2026-04-29'::date,true, 160),
  ('00000002-0000-0000-0000-000000000005'::uuid,'Practice',         '2026-04-28'::date,false,120),
  ('00000002-0000-0000-0000-000000000006'::uuid,'Practice',         '2026-05-01'::date,false,120),
  ('00000002-0000-0000-0000-000000000007'::uuid,'Morning Practice', '2026-05-03'::date,false,150),
  ('00000002-0000-0000-0000-000000000008'::uuid,'Match vs Tokyo',   '2026-05-07'::date,true, 160),
  ('00000002-0000-0000-0000-000000000009'::uuid,'Practice',         '2026-05-09'::date,false,120),
  ('00000002-0000-0000-0000-000000000010'::uuid,'Morning Practice', '2026-05-12'::date,false,120)
),
combos AS (
  SELECT p.uid, p.uname, e.eid, e.etitle, e.edate, e.is_match, e.dur,
    abs(hashtext(p.uid::text || e.eid::text || 'rpe')) % 5 AS rnoise
  FROM players p, event_data e
  WHERE (abs(hashtext(p.uid::text || e.eid::text)) % 100) < 88
),
with_rpe AS (
  SELECT *,
    CASE WHEN is_match
      THEN GREATEST(6, LEAST(9, 7 + rnoise - 2))
      ELSE GREATEST(4, LEAST(8, 6 + rnoise - 2))
    END AS rpe_val
  FROM combos
)
INSERT INTO session_rpe (user_id, user_name, event_id, event_title, event_date, rpe, duration_min, load_au)
SELECT uid, uname, eid, etitle, edate, rpe_val, dur, dur * rpe_val
FROM with_rpe
ON CONFLICT (user_id, event_id) DO NOTHING;

-- ── DONE ──────────────────────────────────────────────────────
-- 14 players, 14 days wellness + nutrition, 5 VERT sessions,
-- 10 events with RPE data. Safe to run multiple times (ON CONFLICT).
