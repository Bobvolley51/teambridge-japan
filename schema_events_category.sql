-- Add category column to events table
-- Run in: Supabase Dashboard → SQL Editor → New Query

alter table events
  add column if not exists category text not null default 'Training';
