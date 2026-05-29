-- Wellness v2 migration — run in Supabase Dashboard → SQL Editor

-- 1. Expand wellness_responses score column to numeric 0-100
ALTER TABLE wellness_responses ALTER COLUMN score TYPE numeric(5,1);
ALTER TABLE wellness_responses DROP CONSTRAINT IF EXISTS wellness_responses_score_check;
ALTER TABLE wellness_responses ADD CONSTRAINT wellness_responses_score_check
  CHECK (score between 0 and 100);

-- 2. Add pain_level to wellness_body_pain (may already exist)
ALTER TABLE wellness_body_pain ADD COLUMN IF NOT EXISTS pain_level integer;

-- 3. Add new session_rpe columns
ALTER TABLE session_rpe ADD COLUMN IF NOT EXISTS energy_level        integer CHECK (energy_level between 0 and 100);
ALTER TABLE session_rpe ADD COLUMN IF NOT EXISTS focus_level         integer CHECK (focus_level  between 0 and 100);
ALTER TABLE session_rpe ADD COLUMN IF NOT EXISTS mindfulness         boolean;
ALTER TABLE session_rpe ADD COLUMN IF NOT EXISTS practice_goal_reached boolean;
