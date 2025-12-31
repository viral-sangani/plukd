-- Migration: Change category from ENUM to TEXT for flexibility
-- This allows dynamic categories without schema changes

-- Step 1: Alter the column type from category enum to TEXT
ALTER TABLE bookmarks
ALTER COLUMN category TYPE TEXT;

-- Step 2: Drop the old enum type (no longer needed)
DROP TYPE IF EXISTS category;

-- Step 3: Add a check constraint to ensure category is not empty
ALTER TABLE bookmarks
ADD CONSTRAINT bookmarks_category_not_empty CHECK (category <> '');
