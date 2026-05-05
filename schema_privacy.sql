-- Add privacy consent tracking to profiles
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- Re-run after any policy update to add new columns safely.

alter table profiles
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists privacy_version      text;
