-- Plukd Reply Settings Row Level Security Policies
-- Ensures users can only access their own reply settings and stats

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE reply_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tone_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_generation_stats ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- REPLY SETTINGS TABLE POLICIES
-- ============================================================================

-- Users can read their own reply settings
CREATE POLICY "Users can read own reply settings"
  ON reply_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create reply settings for themselves
CREATE POLICY "Users can create own reply settings"
  ON reply_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reply settings
CREATE POLICY "Users can update own reply settings"
  ON reply_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reply settings
CREATE POLICY "Users can delete own reply settings"
  ON reply_settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TONE PROMPTS TABLE POLICIES
-- ============================================================================

-- Users can read their own tone prompts
CREATE POLICY "Users can read own tone prompts"
  ON tone_prompts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create tone prompts for themselves
CREATE POLICY "Users can create own tone prompts"
  ON tone_prompts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tone prompts
CREATE POLICY "Users can update own tone prompts"
  ON tone_prompts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own tone prompts
CREATE POLICY "Users can delete own tone prompts"
  ON tone_prompts
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- REPLY GENERATION STATS TABLE POLICIES
-- ============================================================================

-- Users can read their own reply generation stats
CREATE POLICY "Users can read own reply stats"
  ON reply_generation_stats
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create reply stats for themselves
CREATE POLICY "Users can create own reply stats"
  ON reply_generation_stats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reply stats
CREATE POLICY "Users can update own reply stats"
  ON reply_generation_stats
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reply stats
CREATE POLICY "Users can delete own reply stats"
  ON reply_generation_stats
  FOR DELETE
  USING (auth.uid() = user_id);
