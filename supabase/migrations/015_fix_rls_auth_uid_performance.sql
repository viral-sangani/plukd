-- Migration: Fix RLS policies for better performance
-- Issue: auth.uid() was being re-evaluated for each row instead of once per query
-- Fix: Wrap auth.uid() in (select auth.uid()) to ensure single evaluation
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ============================================
-- Drop existing policies for all affected tables
-- ============================================

-- Users table policies
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Bookmarks table policies
DROP POLICY IF EXISTS "Users can read own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can create own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can update own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON bookmarks;

-- Telegram link codes table policies
DROP POLICY IF EXISTS "Users can read own telegram link codes" ON telegram_link_codes;
DROP POLICY IF EXISTS "Users can create own telegram link codes" ON telegram_link_codes;
DROP POLICY IF EXISTS "Users can update own telegram link codes" ON telegram_link_codes;
DROP POLICY IF EXISTS "Users can delete own telegram link codes" ON telegram_link_codes;

-- Reply settings table policies
DROP POLICY IF EXISTS "Users can read own reply settings" ON reply_settings;
DROP POLICY IF EXISTS "Users can create own reply settings" ON reply_settings;
DROP POLICY IF EXISTS "Users can update own reply settings" ON reply_settings;
DROP POLICY IF EXISTS "Users can delete own reply settings" ON reply_settings;

-- Tone prompts table policies
DROP POLICY IF EXISTS "Users can read own tone prompts" ON tone_prompts;
DROP POLICY IF EXISTS "Users can create own tone prompts" ON tone_prompts;
DROP POLICY IF EXISTS "Users can update own tone prompts" ON tone_prompts;
DROP POLICY IF EXISTS "Users can delete own tone prompts" ON tone_prompts;

-- Reply generation stats table policies
DROP POLICY IF EXISTS "Users can read own reply stats" ON reply_generation_stats;
DROP POLICY IF EXISTS "Users can create own reply stats" ON reply_generation_stats;
DROP POLICY IF EXISTS "Users can update own reply stats" ON reply_generation_stats;
DROP POLICY IF EXISTS "Users can delete own reply stats" ON reply_generation_stats;

-- ============================================
-- Recreate policies with optimized (select auth.uid())
-- ============================================

-- ----------------
-- Users table
-- ----------------
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- ----------------
-- Bookmarks table
-- ----------------
CREATE POLICY "Users can read own bookmarks"
  ON bookmarks
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own bookmarks"
  ON bookmarks
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own bookmarks"
  ON bookmarks
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own bookmarks"
  ON bookmarks
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ----------------
-- Telegram link codes table
-- ----------------
CREATE POLICY "Users can read own telegram link codes"
  ON telegram_link_codes
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own telegram link codes"
  ON telegram_link_codes
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own telegram link codes"
  ON telegram_link_codes
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own telegram link codes"
  ON telegram_link_codes
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ----------------
-- Reply settings table
-- ----------------
CREATE POLICY "Users can read own reply settings"
  ON reply_settings
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own reply settings"
  ON reply_settings
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own reply settings"
  ON reply_settings
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own reply settings"
  ON reply_settings
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ----------------
-- Tone prompts table
-- ----------------
CREATE POLICY "Users can read own tone prompts"
  ON tone_prompts
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own tone prompts"
  ON tone_prompts
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own tone prompts"
  ON tone_prompts
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own tone prompts"
  ON tone_prompts
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ----------------
-- Reply generation stats table
-- ----------------
CREATE POLICY "Users can read own reply stats"
  ON reply_generation_stats
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own reply stats"
  ON reply_generation_stats
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own reply stats"
  ON reply_generation_stats
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own reply stats"
  ON reply_generation_stats
  FOR DELETE
  USING ((select auth.uid()) = user_id);
