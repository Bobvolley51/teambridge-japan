-- Rename role 'Athletic' → 'Athletic Trainer' in profiles table
-- Run in: Supabase Dashboard → SQL Editor → New Query

UPDATE profiles
SET role = 'Athletic Trainer'
WHERE role = 'Athletic';
