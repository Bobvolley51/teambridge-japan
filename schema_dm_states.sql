-- Per-user DM conversation states: archived or deleted from the user's view
CREATE TABLE IF NOT EXISTS dm_conversation_states (
  user_id    UUID NOT NULL,
  channel_id TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'archived' | 'deleted'
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, channel_id)
);

ALTER TABLE dm_conversation_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own DM states"
  ON dm_conversation_states FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
