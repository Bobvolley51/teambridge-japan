-- Add user_id to account_requests so approval can confirm the right auth user
-- Run in: Supabase Dashboard → SQL Editor → New Query

alter table account_requests
  add column if not exists user_id uuid;
