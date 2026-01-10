-- Migration: Drop unused indexes to improve write performance and reduce storage
-- These indexes were detected as unused by Supabase linter
-- They can be recreated if query patterns change and they become needed
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

-- ============================================
-- telegram_link_codes indexes
-- ============================================
-- Note: This is a temporary table for linking accounts, so indexes are rarely hit
DROP INDEX IF EXISTS idx_telegram_link_codes_user_id;
DROP INDEX IF EXISTS idx_telegram_link_codes_expires_at;

-- ============================================
-- bookmarks indexes
-- ============================================
-- Note: These can be recreated if filtering/search features are added to the UI
DROP INDEX IF EXISTS idx_bookmarks_content_type;
DROP INDEX IF EXISTS idx_bookmarks_tags;
DROP INDEX IF EXISTS idx_bookmarks_category;

-- ============================================
-- reply_settings indexes
-- ============================================
-- Note: user_id is used in RLS but PK/FK constraints may provide sufficient indexing
DROP INDEX IF EXISTS idx_reply_settings_user_id;

-- ============================================
-- tone_prompts indexes
-- ============================================
DROP INDEX IF EXISTS idx_tone_prompts_user_id;
DROP INDEX IF EXISTS idx_tone_prompts_user_tone;

-- ============================================
-- reply_generation_stats indexes
-- ============================================
DROP INDEX IF EXISTS idx_reply_stats_user_id;
DROP INDEX IF EXISTS idx_reply_stats_created_at;
DROP INDEX IF EXISTS idx_reply_stats_user_created;

-- ============================================
-- Reference: How to recreate if needed
-- ============================================
-- CREATE INDEX idx_bookmarks_category ON bookmarks(category);
-- CREATE INDEX idx_bookmarks_tags ON bookmarks USING GIN(tags);
-- CREATE INDEX idx_bookmarks_content_type ON bookmarks(content_type);
-- CREATE INDEX idx_reply_stats_created_at ON reply_generation_stats(created_at DESC);
-- CREATE INDEX idx_reply_stats_user_created ON reply_generation_stats(user_id, created_at DESC);
