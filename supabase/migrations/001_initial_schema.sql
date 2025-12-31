-- Plukd Initial Database Schema
-- Creates tables for users, bookmarks, and telegram link codes

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

-- Content source enum
CREATE TYPE content_source AS ENUM (
  'twitter',
  'reddit',
  'linkedin',
  'youtube',
  'web'
);

-- Category enum
CREATE TYPE category AS ENUM (
  'tech-development',
  'design-ux',
  'business-finance',
  'marketing-growth',
  'personal-development',
  'news-current-events',
  'research-learning',
  'tools-resources',
  'entertainment',
  'lifestyle'
);

-- Processing status enum
CREATE TYPE processing_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  telegram_chat_id TEXT,
  telegram_username TEXT,
  telegram_linked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for telegram lookups
CREATE INDEX idx_users_telegram_chat_id ON users(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

-- ============================================================================
-- BOOKMARKS TABLE
-- ============================================================================

CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  source content_source NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  author_url TEXT,
  content TEXT,
  media_urls JSONB DEFAULT '[]'::jsonb,
  published_at TIMESTAMPTZ,
  category category NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  blurb TEXT NOT NULL,
  summary TEXT NOT NULL,
  processing_status processing_status NOT NULL DEFAULT 'pending',
  processing_error TEXT,
  raw_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Full-text search vector
  search_vector TSVECTOR
);

-- ============================================================================
-- BOOKMARKS INDEXES
-- ============================================================================

-- Index for user's bookmarks (most common query)
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);

-- Index for filtering by category
CREATE INDEX idx_bookmarks_category ON bookmarks(category);

-- Index for filtering by source
CREATE INDEX idx_bookmarks_source ON bookmarks(source);

-- Index for filtering by processing status
CREATE INDEX idx_bookmarks_processing_status ON bookmarks(processing_status);

-- Index for sorting by created_at (descending, most recent first)
CREATE INDEX idx_bookmarks_created_at ON bookmarks(created_at DESC);

-- Composite index for common user queries with category filter
CREATE INDEX idx_bookmarks_user_category ON bookmarks(user_id, category);

-- Composite index for common user queries with source filter
CREATE INDEX idx_bookmarks_user_source ON bookmarks(user_id, source);

-- GIN index for full-text search
CREATE INDEX idx_bookmarks_search_vector ON bookmarks USING GIN(search_vector);

-- GIN index for tags array
CREATE INDEX idx_bookmarks_tags ON bookmarks USING GIN(tags);

-- ============================================================================
-- TELEGRAM LINK CODES TABLE
-- ============================================================================

CREATE TABLE telegram_link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  telegram_chat_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for looking up codes
CREATE INDEX idx_telegram_link_codes_code ON telegram_link_codes(code);

-- Index for user's link codes
CREATE INDEX idx_telegram_link_codes_user_id ON telegram_link_codes(user_id);

-- Index for cleaning up expired codes
CREATE INDEX idx_telegram_link_codes_expires_at ON telegram_link_codes(expires_at);

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update search_vector when content changes
CREATE OR REPLACE FUNCTION update_bookmark_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector =
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.blurb, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create user row when auth.users is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at on users table
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on bookmarks table
CREATE TRIGGER bookmarks_updated_at
  BEFORE UPDATE ON bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update search_vector on bookmarks insert
CREATE TRIGGER bookmarks_search_vector_insert
  BEFORE INSERT ON bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_bookmark_search_vector();

-- Update search_vector on bookmarks update (only when relevant fields change)
CREATE TRIGGER bookmarks_search_vector_update
  BEFORE UPDATE OF title, content, blurb, summary ON bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_bookmark_search_vector();

-- Auto-create user row when auth.users is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE users IS 'User profiles linked to Supabase auth.users';
COMMENT ON TABLE bookmarks IS 'Saved bookmarks with AI-generated summaries and categorization';
COMMENT ON TABLE telegram_link_codes IS 'Temporary codes for linking Telegram accounts to users';

COMMENT ON COLUMN bookmarks.search_vector IS 'Full-text search vector combining title, blurb, summary, and content';
COMMENT ON COLUMN bookmarks.media_urls IS 'JSON array of media URLs (images, videos) associated with the bookmark';
COMMENT ON COLUMN bookmarks.tags IS 'Array of tags like tutorial, guide, opinion, etc.';
COMMENT ON COLUMN bookmarks.raw_metadata IS 'Original metadata from the source platform';
