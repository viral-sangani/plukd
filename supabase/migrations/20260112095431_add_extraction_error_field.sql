-- Add extraction_error field to bookmarks table
-- Tracks extraction failures even when processing continues with fallback content

ALTER TABLE bookmarks
ADD COLUMN extraction_error TEXT;

-- Add comment to document the field
COMMENT ON COLUMN bookmarks.extraction_error IS 'Stores extraction error messages when content extraction fails but processing continues with fallback';

-- Create index for filtering bookmarks with extraction errors
CREATE INDEX idx_bookmarks_extraction_error ON bookmarks(extraction_error)
WHERE extraction_error IS NOT NULL;
