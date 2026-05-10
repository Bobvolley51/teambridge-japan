-- Teambridge Japan - Complete Database Migration Script
-- Run all schema files in the correct order for full database setup
-- Execute in: Supabase Dashboard → SQL Editor

-- This master script orchestrates all database setup
-- Individual schema files are also available for incremental updates

-- ============================================================
-- STEP 1: Core Tables (Messages, Tasks, Announcements)
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  channel        TEXT        NOT NULL DEFAULT 'general',
  user_name      TEXT        NOT NULL,
  user_initials  TEXT        NOT NULL,
  content        TEXT        NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'todo',
  assignee    TEXT,
  priority    TEXT        NOT NULL DEFAULT 'medium',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcements (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT        NOT NULL,
  content      TEXT        NOT NULL,
  author_name  TEXT        NOT NULL,
  priority     TEXT        NOT NULL DEFAULT 'medium',
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STEP 2: User Profiles & Authentication
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id           UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email        TEXT NOT NULL,
  display_name TEXT,
  avatar_url   TEXT,
  role         TEXT NOT NULL DEFAULT 'Player',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'Player')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- STEP 3: Teams & Channels
-- ============================================================

CREATE TABLE IF NOT EXISTS teams (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL UNIQUE,
  description TEXT,
  owner_id    UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channels (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id     UUID        REFERENCES teams(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STEP 4: Events & Scheduling
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id     UUID        REFERENCES teams(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  description TEXT,
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ NOT NULL,
  location    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_participants (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    UUID        REFERENCES events(id) ON DELETE CASCADE,
  profile_id  UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT        DEFAULT 'invited' -- invited, accepted, declined, maybe
);

CREATE TABLE IF NOT EXISTS recurrence (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    UUID        REFERENCES events(id) ON DELETE CASCADE,
  frequency   TEXT, -- daily, weekly, monthly
  end_date    TIMESTAMPTZ
);

-- ============================================================
-- STEP 5: Notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL, -- message, event, task, announcement
  title       TEXT        NOT NULL,
  content     TEXT,
  read        BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STEP 6: Wellness & Performance
-- ============================================================

CREATE TABLE IF NOT EXISTS wellness_check (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  mood        INTEGER, -- 1-5 scale
  sleep_hours DECIMAL(3,1),
  injury_notes TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session_rpe (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    UUID        REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  rpe_score   INTEGER, -- Rate of Perceived Exertion (1-10)
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STEP 7: Travel & Logistics
-- ============================================================

CREATE TABLE IF NOT EXISTS travel_plans (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    UUID        REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  departure   TIMESTAMPTZ,
  arrival     TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS travel_items_type (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL UNIQUE, -- Passport, Visa, etc.
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STEP 8: Tactics & Analytics
-- ============================================================

CREATE TABLE IF NOT EXISTS tactics (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id     UUID        REFERENCES teams(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  positions   JSONB, -- {setter: [...], middle: [...], etc}
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STEP 9: Account Requests & Access Control
-- ============================================================

CREATE TABLE IF NOT EXISTS account_requests (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT        NOT NULL UNIQUE,
  team_id     UUID        REFERENCES teams(id),
  status      TEXT        DEFAULT 'pending', -- pending, approved, denied
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS privacy_settings (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  show_stats  BOOLEAN     DEFAULT true,
  show_email  BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STEP 10: Storage - Avatar Bucket with RLS
-- ============================================================

-- Create the bucket (public so avatar URLs work without auth tokens)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- RLS Policy: Allow authenticated users to upload their own avatar
CREATE POLICY IF NOT EXISTS "avatar_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND name = auth.uid()::text || '.jpg'
  );

-- RLS Policy: Allow authenticated users to replace their own avatar
CREATE POLICY IF NOT EXISTS "avatar_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name = auth.uid()::text || '.jpg'
  );

-- RLS Policy: Allow everyone to read avatars (required for public URLs)
CREATE POLICY IF NOT EXISTS "avatar_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- ============================================================
-- STEP 11: Row Level Security (RLS)
-- ============================================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellness_check ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_rpe ENABLE ROW LEVEL SECURITY;
ALTER TABLE tactics ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_settings ENABLE ROW LEVEL SECURITY;

-- Messages RLS
CREATE POLICY IF NOT EXISTS "read messages" ON messages FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "insert messages" ON messages FOR INSERT WITH CHECK (true);

-- Tasks RLS
CREATE POLICY IF NOT EXISTS "read tasks" ON tasks FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "insert tasks" ON tasks FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "update tasks" ON tasks FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "delete tasks" ON tasks FOR DELETE USING (true);

-- Announcements RLS
CREATE POLICY IF NOT EXISTS "read announcements" ON announcements FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "insert announcements" ON announcements FOR INSERT WITH CHECK (true);

-- Profiles RLS
CREATE POLICY IF NOT EXISTS "anyone read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "anyone insert profiles" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "authenticated update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Notifications RLS
CREATE POLICY IF NOT EXISTS "users read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "authenticated insert notifications" ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- STEP 12: Realtime Subscriptions
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================================
-- STEP 13: Indexes for Performance
-- ============================================================

CREATE INDEX IF NOT EXISTS messages_channel_idx ON messages (channel, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_user_idx ON messages (user_name, created_at DESC);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks (status, created_at ASC);
CREATE INDEX IF NOT EXISTS announcements_created_idx ON announcements (created_at DESC);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles (email);
CREATE INDEX IF NOT EXISTS teams_owner_idx ON teams (owner_id);
CREATE INDEX IF NOT EXISTS events_team_idx ON events (team_id, start_time);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS wellness_user_date_idx ON wellness_check (user_id, date DESC);
CREATE INDEX IF NOT EXISTS account_requests_status_idx ON account_requests (status);

-- ============================================================
-- SUCCESS
-- ============================================================
-- Database setup complete!
-- All tables, RLS policies, and indexes are ready
-- Migration executed at: NOW()
