-- Plukd Row Level Security Policies
-- Ensures users can only access their own data

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_link_codes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Note: INSERT is handled by the trigger on auth.users
-- Users should not be able to delete their profile directly (handled via auth.users cascade)

-- ============================================================================
-- BOOKMARKS TABLE POLICIES
-- ============================================================================

-- Users can read their own bookmarks
CREATE POLICY "Users can read own bookmarks"
  ON bookmarks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create bookmarks for themselves
CREATE POLICY "Users can create own bookmarks"
  ON bookmarks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own bookmarks
CREATE POLICY "Users can update own bookmarks"
  ON bookmarks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own bookmarks
CREATE POLICY "Users can delete own bookmarks"
  ON bookmarks
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TELEGRAM LINK CODES TABLE POLICIES
-- ============================================================================

-- Users can read their own telegram link codes
CREATE POLICY "Users can read own telegram link codes"
  ON telegram_link_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create telegram link codes for themselves
CREATE POLICY "Users can create own telegram link codes"
  ON telegram_link_codes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own telegram link codes
CREATE POLICY "Users can update own telegram link codes"
  ON telegram_link_codes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own telegram link codes
CREATE POLICY "Users can delete own telegram link codes"
  ON telegram_link_codes
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SERVICE ROLE BYPASS NOTE
-- ============================================================================

-- The service role (used by the Telegram bot API) bypasses RLS by default.
-- This allows the API to:
-- 1. Look up users by telegram_chat_id
-- 2. Create bookmarks on behalf of users
-- 3. Verify and consume telegram link codes
--
-- Always use the anon key for client-side requests and service_role key
-- only for server-side API routes that need elevated permissions.
