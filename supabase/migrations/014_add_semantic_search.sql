-- Migration: Add semantic search with pgvector
-- This adds embedding column and search function for semantic bookmark search

-- Note: The vector extension should already be enabled in Supabase
-- If you get an error about vector type not existing, enable it manually:
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to bookmarks
-- Using 768 dimensions for text-embedding-004 model
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS embedding extensions.vector(768);

-- Create HNSW index for fast approximate nearest neighbor search
-- Using cosine distance for normalized embeddings
CREATE INDEX IF NOT EXISTS idx_bookmarks_embedding
ON bookmarks
USING hnsw (embedding extensions.vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create semantic search function
CREATE OR REPLACE FUNCTION search_bookmarks_semantic(
  query_embedding extensions.vector(768),
  user_id_param uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  include_archived boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  url text,
  title text,
  source text,
  author text,
  blurb text,
  category text,
  tags text[],
  content_type text,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.url,
    b.title,
    b.source,
    b.author,
    b.blurb,
    b.category,
    b.tags,
    b.content_type,
    b.created_at,
    1 - (b.embedding <=> query_embedding) AS similarity
  FROM bookmarks b
  WHERE
    b.user_id = user_id_param
    AND b.embedding IS NOT NULL
    AND b.processing_status = 'completed'
    AND (include_archived OR NOT b.is_archived)
    AND 1 - (b.embedding <=> query_embedding) > match_threshold
  ORDER BY b.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_bookmarks_semantic TO authenticated;

-- Create helper function to update bookmark embedding
-- This handles the text-to-vector conversion
CREATE OR REPLACE FUNCTION update_bookmark_embedding(
  bookmark_id uuid,
  embedding_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE bookmarks
  SET
    embedding = embedding_value::extensions.vector(768),
    updated_at = NOW()
  WHERE id = bookmark_id;
END;
$$;

-- Grant execute permission to service role (backend uses service role key)
GRANT EXECUTE ON FUNCTION update_bookmark_embedding TO service_role;

-- Add comment for documentation
COMMENT ON COLUMN bookmarks.embedding IS 'Vector embedding for semantic search, generated from title + blurb + summary + key_takeaways';
COMMENT ON FUNCTION search_bookmarks_semantic IS 'Search bookmarks by semantic similarity using vector embeddings';
