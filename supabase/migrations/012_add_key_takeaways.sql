-- Migration: Add key_takeaways column for actionable items
-- This column stores 3-5 actionable takeaways per bookmark
-- Each takeaway has a text and type (action, idea, reminder, reference)

-- Add key_takeaways column as JSONB to store array of takeaways
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS key_takeaways JSONB;

-- Add GIN index for efficient searching within takeaways
CREATE INDEX IF NOT EXISTS idx_bookmarks_key_takeaways ON bookmarks USING GIN(key_takeaways);

-- Add comment for documentation
COMMENT ON COLUMN bookmarks.key_takeaways IS 'Array of actionable takeaways: [{text: string, type: "action"|"idea"|"reminder"|"reference"}]. Extracted by AI during processing.';
