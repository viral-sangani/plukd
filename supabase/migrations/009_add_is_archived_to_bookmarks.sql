-- Add is_archived column to bookmarks table
-- Allows users to archive read/completed bookmarks

ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Index for efficient filtering by user and archived status
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_archived
ON bookmarks(user_id, is_archived);
