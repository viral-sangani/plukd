-- Add content_type column for AI classification
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS content_type TEXT;

-- Add extracted_resources column for list-type content
-- Stores structured resources: {name, description?, url?, category?}
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS extracted_resources JSONB;

-- Add index for filtering by content_type
CREATE INDEX IF NOT EXISTS idx_bookmarks_content_type ON bookmarks(content_type);

-- Comment for documentation
COMMENT ON COLUMN bookmarks.content_type IS 'AI-classified content type: thread, article, video, discussion, announcement, list, other';
COMMENT ON COLUMN bookmarks.extracted_resources IS 'Structured resources extracted from list-type content: [{name, description?, url?, category?}]';
