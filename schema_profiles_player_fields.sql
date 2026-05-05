-- ============================================================
-- TeamBridge Japan — Player position & jersey number
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

alter table profiles
  add column if not exists position      text,     -- null | 'Setter' | 'Middle' | 'Outside' | 'Opposite' | 'Libero'
  add column if not exists jersey_number integer;  -- null = unassigned
