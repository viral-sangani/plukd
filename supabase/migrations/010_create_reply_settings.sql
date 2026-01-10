-- Plukd Reply Settings Tables
-- Creates tables for tweet reply generation settings and tone prompts

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

-- Tone type enum for different reply styles
CREATE TYPE tone_type AS ENUM (
  'professional',
  'casual',
  'witty',
  'thoughtful',
  'supportive',
  'custom'
);

-- ============================================================================
-- REPLY SETTINGS TABLE
-- ============================================================================

CREATE TABLE reply_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  default_tone tone_type NOT NULL DEFAULT 'casual',
  include_emoji BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX idx_reply_settings_user_id ON reply_settings(user_id);

-- ============================================================================
-- TONE PROMPTS TABLE
-- ============================================================================

CREATE TABLE tone_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tone_type tone_type NOT NULL,
  custom_prompt TEXT NOT NULL,
  temperature DECIMAL(2, 1) NOT NULL DEFAULT 0.7 CHECK (temperature >= 0.0 AND temperature <= 1.0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Unique constraint to prevent duplicate tone types per user
  CONSTRAINT unique_user_tone_type UNIQUE (user_id, tone_type)
);

-- Index for user lookups
CREATE INDEX idx_tone_prompts_user_id ON tone_prompts(user_id);

-- Composite index for common queries (user + tone_type)
CREATE INDEX idx_tone_prompts_user_tone ON tone_prompts(user_id, tone_type);

-- ============================================================================
-- REPLY GENERATION STATS TABLE
-- ============================================================================

CREATE TABLE reply_generation_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tweet_url TEXT NOT NULL,
  tone_used tone_type NOT NULL,
  generated_reply TEXT NOT NULL,
  was_sent BOOLEAN NOT NULL DEFAULT false,
  generation_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX idx_reply_stats_user_id ON reply_generation_stats(user_id);

-- Index for sorting by creation date
CREATE INDEX idx_reply_stats_created_at ON reply_generation_stats(created_at DESC);

-- Composite index for user stats queries
CREATE INDEX idx_reply_stats_user_created ON reply_generation_stats(user_id, created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at on reply_settings table
CREATE TRIGGER reply_settings_updated_at
  BEFORE UPDATE ON reply_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on tone_prompts table
CREATE TRIGGER tone_prompts_updated_at
  BEFORE UPDATE ON tone_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE reply_settings IS 'User preferences for AI-generated tweet replies';
COMMENT ON TABLE tone_prompts IS 'Custom tone prompts for different reply styles';
COMMENT ON TABLE reply_generation_stats IS 'Usage tracking for reply generation feature';

COMMENT ON COLUMN reply_settings.enabled IS 'Whether reply generation is enabled for this user';
COMMENT ON COLUMN reply_settings.default_tone IS 'Default tone to use for reply generation';
COMMENT ON COLUMN reply_settings.include_emoji IS 'Whether to include emojis in generated replies';
COMMENT ON COLUMN tone_prompts.custom_prompt IS 'Custom system prompt for this tone style';
COMMENT ON COLUMN tone_prompts.temperature IS 'AI temperature parameter (0.0-1.0) for creativity control';
COMMENT ON COLUMN reply_generation_stats.was_sent IS 'Whether the user actually sent this generated reply';
COMMENT ON COLUMN reply_generation_stats.generation_time_ms IS 'Time taken to generate the reply in milliseconds';
