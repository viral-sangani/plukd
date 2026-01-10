/**
 * Backfill embeddings for existing bookmarks.
 *
 * This script generates embeddings for all bookmarks that:
 * - Have processing_status = 'completed'
 * - Don't have an embedding yet (embedding IS NULL)
 *
 * Run with: bun run scripts/backfill-embeddings.ts
 */

import { createClient } from '@supabase/supabase-js'
import { google } from '@ai-sdk/google'
import { embed } from 'ai'
import type { KeyTakeaway, Database } from '@plukd/shared'

// Configuration
const BATCH_SIZE = 10 // Process N bookmarks at a time
const DELAY_BETWEEN_BATCHES_MS = 1000 // Wait 1s between batches to avoid rate limits
const MAX_EMBEDDING_INPUT_LENGTH = 8000

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceRoleKey)

type BookmarkRow = Database['public']['Tables']['bookmarks']['Row']

/**
 * Generate an embedding for a bookmark's content
 */
async function generateEmbedding(
  title: string,
  blurb: string,
  summary: string,
  keyTakeaways?: KeyTakeaway[] | null
): Promise<number[]> {
  const parts: string[] = []

  if (title) {
    parts.push(`Title: ${title}`)
  }

  if (blurb) {
    parts.push(`Summary: ${blurb}`)
  }

  if (keyTakeaways && keyTakeaways.length > 0) {
    const takeawayTexts = keyTakeaways.map((t) => t.text).join('; ')
    parts.push(`Key points: ${takeawayTexts}`)
  }

  if (summary) {
    parts.push(`Details: ${summary}`)
  }

  let text = parts.join('\n\n')
  if (text.length > MAX_EMBEDDING_INPUT_LENGTH) {
    text = text.slice(0, MAX_EMBEDDING_INPUT_LENGTH)
  }

  const { embedding } = await embed({
    model: google.textEmbeddingModel('text-embedding-004'),
    value: text,
  })

  return embedding
}

/**
 * Format embedding as PostgreSQL vector literal
 */
function formatEmbeddingForPostgres(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

/**
 * Get count of bookmarks that need embeddings
 */
async function getBookmarksNeedingEmbeddings(): Promise<number> {
  const { count, error } = await supabase
    .from('bookmarks')
    .select('*', { count: 'exact', head: true })
    .eq('processing_status', 'completed')
    .is('embedding', null)

  if (error) {
    console.error('Error counting bookmarks:', error.message)
    return 0
  }

  return count || 0
}

/**
 * Fetch a batch of bookmarks that need embeddings
 */
async function fetchBookmarksBatch(offset: number): Promise<BookmarkRow[]> {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('processing_status', 'completed')
    .is('embedding', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + BATCH_SIZE - 1)

  if (error) {
    console.error('Error fetching bookmarks:', error.message)
    return []
  }

  return data || []
}

/**
 * Update a bookmark's embedding
 */
async function updateBookmarkEmbedding(bookmarkId: string, embedding: number[]): Promise<boolean> {
  const embeddingLiteral = formatEmbeddingForPostgres(embedding)

  // RPC function defined in migration 013_add_semantic_search.sql
  const { error } = await supabase.rpc(
    'update_bookmark_embedding' as never,
    {
      bookmark_id: bookmarkId,
      embedding_value: embeddingLiteral,
    } as never
  )

  if (error) {
    console.error(`Error updating embedding for ${bookmarkId}:`, error.message)
    return false
  }

  return true
}

/**
 * Process a single bookmark
 */
async function processBookmark(bookmark: BookmarkRow): Promise<boolean> {
  try {
    const keyTakeaways = bookmark.key_takeaways as KeyTakeaway[] | null

    const embedding = await generateEmbedding(
      bookmark.title,
      bookmark.blurb,
      bookmark.summary,
      keyTakeaways
    )

    return await updateBookmarkEmbedding(bookmark.id, embedding)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`Error processing bookmark ${bookmark.id}: ${errorMessage}`)
    return false
  }
}

/**
 * Main backfill function
 */
async function backfillEmbeddings() {
  console.log('=== Embedding Backfill Script ===\n')

  // Get total count
  const totalCount = await getBookmarksNeedingEmbeddings()
  console.log(`Found ${totalCount} bookmarks needing embeddings\n`)

  if (totalCount === 0) {
    console.log('All bookmarks already have embeddings. Nothing to do.')
    return
  }

  let processed = 0
  let successful = 0
  let failed = 0
  let offset = 0

  while (true) {
    // Fetch batch
    const bookmarks = await fetchBookmarksBatch(offset)

    if (bookmarks.length === 0) {
      break
    }

    console.log(`Processing batch ${Math.floor(offset / BATCH_SIZE) + 1} (${bookmarks.length} bookmarks)...`)

    // Process each bookmark in the batch
    for (const bookmark of bookmarks) {
      processed++
      const success = await processBookmark(bookmark)

      if (success) {
        successful++
        console.log(`  [${processed}/${totalCount}] ${bookmark.title.slice(0, 50)}... `)
      } else {
        failed++
        console.log(`  [${processed}/${totalCount}] FAILED: ${bookmark.title.slice(0, 50)}...`)
      }
    }

    // Move to next batch
    // Note: We re-query from offset 0 because we've updated bookmarks in this batch
    // They now have embeddings and won't be returned by the query
    offset = 0

    // Check if there are more bookmarks
    const remaining = await getBookmarksNeedingEmbeddings()
    if (remaining === 0) {
      break
    }

    // Wait before next batch to avoid rate limits
    console.log(`  Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`)
    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS))
  }

  console.log('\n=== Backfill Complete ===')
  console.log(`Total processed: ${processed}`)
  console.log(`Successful: ${successful}`)
  console.log(`Failed: ${failed}`)
}

// Run the backfill
backfillEmbeddings()
  .then(() => {
    console.log('\nScript finished.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nScript failed with error:', error)
    process.exit(1)
  })
