-- Add item_type column to travel_items
-- Run in: Supabase Dashboard → SQL Editor → New Query

alter table travel_items
  add column if not exists item_type text not null default 'other';
