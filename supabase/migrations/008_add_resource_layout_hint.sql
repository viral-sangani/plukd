-- Add resource_layout_hint column for AI-suggested display layout
-- Stores the recommended layout for rendering extracted resources
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS resource_layout_hint TEXT;

-- Comment for documentation
COMMENT ON COLUMN bookmarks.resource_layout_hint IS 'AI-suggested layout for displaying extracted resources: numbered-steps, grid, accordion, checklist, cards, table, simple-list';
