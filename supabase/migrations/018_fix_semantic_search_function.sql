-- Migration: Fix semantic search function search_path and source type
-- The <=> operator for vector distance is in the extensions schema,
-- so we need to include extensions in the search_path for the function.
-- Also, the source column is content_source enum and needs to be cast to text.

-- Recreate the semantic search function with corrected search_path and source cast
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
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.url,
    b.title,
    b.source::text,
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

-- Also fix the update_bookmark_embedding function
CREATE OR REPLACE FUNCTION update_bookmark_embedding(
  bookmark_id uuid,
  embedding_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE bookmarks
  SET
    embedding = embedding_value::extensions.vector(768),
    updated_at = NOW()
  WHERE id = bookmark_id;
END;
$$;

-- Ensure permissions are still granted
GRANT EXECUTE ON FUNCTION search_bookmarks_semantic TO authenticated;
GRANT EXECUTE ON FUNCTION update_bookmark_embedding TO service_role;
