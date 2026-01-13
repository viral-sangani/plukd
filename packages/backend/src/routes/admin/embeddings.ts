import { Hono } from 'hono'
import { z } from 'zod'
import { supabaseAdmin } from '../../config/supabase'
import {
  generateBookmarkEmbedding,
  formatEmbeddingForPostgres,
  EXPECTED_EMBEDDING_DIMENSION,
} from '../../lib/ai/embeddings'
import { enqueueBookmarkProcessing } from '../../jobs/queue'
import type { KeyTakeaway } from '@plukd/shared'

/**
 * Admin embeddings routes for monitoring and regenerating bookmark embeddings.
 *
 * All routes require admin authentication (applied in parent router).
 */
export const embeddingsRoutes = new Hono()

// Default pagination values
const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

// Query params schema for missing embeddings endpoint
const listMissingQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(MAX_LIMIT).default(DEFAULT_LIMIT),
  source: z.string().optional(),
})

// Bookmark ID param schema
const bookmarkIdSchema = z.object({
  bookmarkId: z.string().uuid('Invalid bookmark ID'),
})

/**
 * GET /missing - List bookmarks missing embeddings with pagination.
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 25, max: 100)
 * - source: Optional filter by source (twitter, reddit, web, etc.)
 *
 * Returns:
 * - bookmarks: Array of bookmark objects without embeddings
 * - stats: { total, with_embeddings, missing, coverage_percent }
 * - pagination: { page, limit, total, totalPages, hasNextPage, hasPreviousPage }
 */
embeddingsRoutes.get('/missing', async (c) => {
  try {
    const query = c.req.query()

    // Parse and validate query params
    const params = listMissingQuerySchema.parse({
      page: query.page,
      limit: query.limit,
      source: query.source || undefined,
    })

    // Build query for bookmarks with NULL embedding
    let dbQuery = supabaseAdmin
      .from('bookmarks')
      .select('id, url, title, source, processing_status, created_at, updated_at', {
        count: 'exact',
      })
      .is('embedding', null)

    // Apply source filter if provided
    if (params.source) {
      dbQuery = dbQuery.eq('source', params.source)
    }

    // Order by created_at descending (newest first)
    dbQuery = dbQuery.order('created_at', { ascending: false })

    // Apply pagination
    const offset = (params.page - 1) * params.limit
    dbQuery = dbQuery.range(offset, offset + params.limit - 1)

    const { data: bookmarks, error, count } = await dbQuery

    if (error) {
      console.error('[admin/embeddings] Error fetching bookmarks:', error)
      return c.json({ error: 'Failed to fetch bookmarks' }, 500)
    }

    // Fetch stats in parallel for efficiency
    const [totalResult, withEmbeddingResult] = await Promise.all([
      supabaseAdmin
        .from('bookmarks')
        .select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('bookmarks')
        .select('*', { count: 'exact', head: true })
        .not('embedding', 'is', null),
    ])

    if (totalResult.error) {
      console.error('[admin/embeddings] Error fetching total count:', totalResult.error)
      return c.json({ error: 'Failed to fetch statistics' }, 500)
    }

    if (withEmbeddingResult.error) {
      console.error('[admin/embeddings] Error fetching embedding count:', withEmbeddingResult.error)
      return c.json({ error: 'Failed to fetch statistics' }, 500)
    }

    const totalBookmarks = totalResult.count || 0
    const withEmbeddings = withEmbeddingResult.count || 0
    const missingEmbeddings = totalBookmarks - withEmbeddings
    const coveragePercent = totalBookmarks > 0 ? (withEmbeddings / totalBookmarks) * 100 : 0

    const total = count || 0
    const totalPages = Math.ceil(total / params.limit)
    const hasNextPage = params.page < totalPages
    const hasPreviousPage = params.page > 1

    return c.json({
      bookmarks: bookmarks || [],
      stats: {
        total: totalBookmarks,
        with_embeddings: withEmbeddings,
        missing: missingEmbeddings,
        coverage_percent: coveragePercent,
      },
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid query parameters', details: error.issues }, 400)
    }
    console.error('[admin/embeddings] Error in list missing:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /stats - Get embedding statistics.
 *
 * Returns counts of bookmarks with and without embeddings, grouped by source.
 */
embeddingsRoutes.get('/stats', async (c) => {
  try {
    // Get total bookmarks count
    const { count: totalCount, error: totalError } = await supabaseAdmin
      .from('bookmarks')
      .select('*', { count: 'exact', head: true })

    if (totalError) {
      console.error('[admin/embeddings] Error fetching total count:', totalError)
      return c.json({ error: 'Failed to fetch statistics' }, 500)
    }

    // Get count of bookmarks with embeddings
    const { count: withEmbeddingCount, error: withEmbeddingError } = await supabaseAdmin
      .from('bookmarks')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null)

    if (withEmbeddingError) {
      console.error('[admin/embeddings] Error fetching embedding count:', withEmbeddingError)
      return c.json({ error: 'Failed to fetch statistics' }, 500)
    }

    // Get count of bookmarks missing embeddings
    const { count: missingCount, error: missingError } = await supabaseAdmin
      .from('bookmarks')
      .select('*', { count: 'exact', head: true })
      .is('embedding', null)

    if (missingError) {
      console.error('[admin/embeddings] Error fetching missing count:', missingError)
      return c.json({ error: 'Failed to fetch statistics' }, 500)
    }

    // Get missing counts by source
    const sources = ['twitter', 'reddit', 'youtube', 'linkedin', 'instagram', 'web'] as const
    const missingBySource: Record<string, number> = {}

    await Promise.all(
      sources.map(async (source) => {
        const { count, error } = await supabaseAdmin
          .from('bookmarks')
          .select('*', { count: 'exact', head: true })
          .eq('source', source)
          .is('embedding', null)

        if (!error) {
          missingBySource[source] = count || 0
        }
      })
    )

    const total = totalCount || 0
    const withEmbedding = withEmbeddingCount || 0
    const missing = missingCount || 0
    const coverage = total > 0 ? ((withEmbedding / total) * 100).toFixed(1) : '0.0'

    return c.json({
      total,
      withEmbedding,
      missing,
      coverage: parseFloat(coverage),
      missingBySource,
    })
  } catch (error) {
    console.error('[admin/embeddings] Error getting stats:', error)
    return c.json({ error: 'Failed to get embedding stats' }, 500)
  }
})

/**
 * POST /:bookmarkId/regenerate - Regenerate embedding for a specific bookmark.
 *
 * This will:
 * 1. Verify the bookmark exists
 * 2. Fetch the bookmark's content (title, blurb, summary, key_takeaways)
 * 3. Generate a new embedding using the AI model
 * 4. Save the embedding to the database
 *
 * Path params:
 * - bookmarkId: UUID of the bookmark to regenerate embedding for
 *
 * Returns:
 * - success: boolean
 * - message: string
 * - bookmarkId: string
 */
embeddingsRoutes.post('/:bookmarkId/regenerate', async (c) => {
  try {
    const { bookmarkId } = bookmarkIdSchema.parse({
      bookmarkId: c.req.param('bookmarkId'),
    })

    // Fetch the bookmark to verify it exists and get required fields
    const { data: bookmark, error: fetchError } = await supabaseAdmin
      .from('bookmarks')
      .select('id, title, blurb, summary, key_takeaways, processing_status')
      .eq('id', bookmarkId)
      .single<{
        id: string
        title: string
        blurb: string | null
        summary: string | null
        key_takeaways: KeyTakeaway[] | null
        processing_status: string
      }>()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return c.json({ error: 'Bookmark not found' }, 404)
      }
      console.error('[admin/embeddings] Error fetching bookmark:', fetchError)
      return c.json({ error: 'Failed to fetch bookmark' }, 500)
    }

    // Check if bookmark has been processed (has content to embed)
    if (bookmark.processing_status !== 'completed') {
      return c.json({
        error: 'Bookmark has not been processed',
        message: 'Only completed bookmarks can have embeddings regenerated. Process the bookmark first.',
        processingStatus: bookmark.processing_status,
      }, 400)
    }

    // Generate embedding
    console.log(`[admin/embeddings] Generating embedding for bookmark ${bookmarkId}`)
    const embedding = await generateBookmarkEmbedding(
      bookmark.title,
      bookmark.blurb || '',
      bookmark.summary || '',
      bookmark.key_takeaways
    )

    // Validate embedding dimension
    if (embedding.length !== EXPECTED_EMBEDDING_DIMENSION) {
      console.error(
        `[admin/embeddings] Invalid embedding dimension: expected ${EXPECTED_EMBEDDING_DIMENSION}, got ${embedding.length}`
      )
      return c.json({
        error: 'Invalid embedding dimension',
        expected: EXPECTED_EMBEDDING_DIMENSION,
        actual: embedding.length,
      }, 500)
    }

    // Save embedding using RPC function
    const embeddingLiteral = formatEmbeddingForPostgres(embedding)
    const { error: embeddingError } = await supabaseAdmin.rpc(
      'update_bookmark_embedding' as never,
      {
        bookmark_id: bookmarkId,
        embedding_value: embeddingLiteral,
      } as never
    )

    if (embeddingError) {
      console.error('[admin/embeddings] Error saving embedding:', embeddingError)
      return c.json({ error: 'Failed to save embedding' }, 500)
    }

    console.log(`[admin/embeddings] Regenerated embedding for bookmark ${bookmarkId}`)

    return c.json({
      success: true,
      message: 'Embedding regenerated successfully',
      bookmarkId: bookmark.id,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid bookmark ID', details: error.issues }, 400)
    }
    console.error('[admin/embeddings] Error in regenerate:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /bulk-regenerate - Regenerate embeddings for multiple bookmarks.
 *
 * Body:
 * - bookmarkIds: Array of bookmark UUIDs to regenerate embeddings for (optional)
 * - source: Filter by source to regenerate all missing from that source (optional)
 * - limit: Maximum number of bookmarks to process (default: 50, max: 100)
 *
 * If neither bookmarkIds nor source is provided, regenerates for all missing.
 *
 * Returns:
 * - success: boolean
 * - processed: number of embeddings successfully regenerated
 * - failed: number of embeddings that failed
 * - errors: Array of { bookmarkId, error } for failed items
 */
const bulkRegenerateSchema = z.object({
  bookmarkIds: z.array(z.string().uuid()).optional(),
  source: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
})

embeddingsRoutes.post('/bulk-regenerate', async (c) => {
  try {
    const body = await c.req.json()
    const params = bulkRegenerateSchema.parse(body)

    let bookmarks: Array<{
      id: string
      title: string
      blurb: string | null
      summary: string | null
      key_takeaways: KeyTakeaway[] | null
    }> = []

    if (params.bookmarkIds && params.bookmarkIds.length > 0) {
      // Fetch specific bookmarks
      const { data, error } = await supabaseAdmin
        .from('bookmarks')
        .select('id, title, blurb, summary, key_takeaways')
        .in('id', params.bookmarkIds)
        .eq('processing_status', 'completed')
        .limit(params.limit)

      if (error) {
        console.error('[admin/embeddings] Error fetching bookmarks:', error)
        return c.json({ error: 'Failed to fetch bookmarks' }, 500)
      }

      bookmarks = (data as typeof bookmarks) || []
    } else {
      // Fetch bookmarks missing embeddings, optionally filtered by source
      let query = supabaseAdmin
        .from('bookmarks')
        .select('id, title, blurb, summary, key_takeaways')
        .is('embedding', null)
        .eq('processing_status', 'completed')
        .limit(params.limit)

      if (params.source) {
        query = query.eq('source', params.source)
      }

      const { data, error } = await query

      if (error) {
        console.error('[admin/embeddings] Error fetching bookmarks:', error)
        return c.json({ error: 'Failed to fetch bookmarks' }, 500)
      }

      bookmarks = (data as typeof bookmarks) || []
    }

    if (bookmarks.length === 0) {
      return c.json({
        success: true,
        message: 'No bookmarks found to process',
        processed: 0,
        failed: 0,
      })
    }

    // Process each bookmark
    const errors: Array<{ bookmarkId: string; error: string }> = []
    let processed = 0

    for (const bookmark of bookmarks) {
      try {
        // Generate embedding
        const embedding = await generateBookmarkEmbedding(
          bookmark.title,
          bookmark.blurb || '',
          bookmark.summary || '',
          bookmark.key_takeaways
        )

        // Validate dimension
        if (embedding.length !== EXPECTED_EMBEDDING_DIMENSION) {
          errors.push({
            bookmarkId: bookmark.id,
            error: `Invalid dimension: ${embedding.length}`,
          })
          continue
        }

        // Save embedding
        const embeddingLiteral = formatEmbeddingForPostgres(embedding)
        const { error: saveError } = await supabaseAdmin.rpc(
          'update_bookmark_embedding' as never,
          {
            bookmark_id: bookmark.id,
            embedding_value: embeddingLiteral,
          } as never
        )

        if (saveError) {
          errors.push({
            bookmarkId: bookmark.id,
            error: saveError.message,
          })
          continue
        }

        processed++
      } catch (embeddingError) {
        const errorMessage = embeddingError instanceof Error ? embeddingError.message : String(embeddingError)
        errors.push({
          bookmarkId: bookmark.id,
          error: errorMessage,
        })
      }
    }

    console.log(`[admin/embeddings] Bulk regenerated ${processed} embeddings, ${errors.length} failed`)

    return c.json({
      success: processed > 0,
      processed,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', details: error.issues }, 400)
    }
    console.error('[admin/embeddings] Error in bulk-regenerate:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /bulk-regenerate-queue - Enqueue all bookmarks missing embeddings for processing.
 *
 * This endpoint queues bookmarks for background processing using BullMQ.
 * The worker processes 5 jobs concurrently for efficient bulk embedding regeneration.
 *
 * Only bookmarks with processing_status = 'completed' and embedding IS NULL are queued.
 * This ensures we only regenerate embeddings for bookmarks that have been fully processed
 * but are missing their vector embeddings.
 *
 * Returns:
 * - success: boolean
 * - count: number of jobs enqueued
 * - message: string describing the result
 */
// Type for bookmark rows needed for queue enqueuing
type QueueBookmark = { id: string; url: string; user_id: string }

embeddingsRoutes.post('/bulk-regenerate-queue', async (c) => {
  try {
    // Query all bookmarks missing embeddings where processing is completed
    const { data: bookmarksData, error: fetchError } = await supabaseAdmin
      .from('bookmarks')
      .select('id, url, user_id')
      .is('embedding', null)
      .eq('processing_status', 'completed')

    if (fetchError) {
      console.error('[admin/embeddings] Error fetching bookmarks for queue:', fetchError)
      return c.json({ error: 'Failed to fetch bookmarks' }, 500)
    }

    const bookmarks = (bookmarksData as QueueBookmark[] | null) || []

    if (bookmarks.length === 0) {
      return c.json({
        success: true,
        count: 0,
        message: 'No bookmarks found missing embeddings',
      })
    }

    // Enqueue each bookmark for processing
    let enqueuedCount = 0
    const errors: Array<{ bookmarkId: string; error: string }> = []

    for (const bookmark of bookmarks) {
      try {
        await enqueueBookmarkProcessing(bookmark.id, bookmark.url, bookmark.user_id)
        enqueuedCount++
      } catch (enqueueError) {
        const errorMessage = enqueueError instanceof Error ? enqueueError.message : String(enqueueError)
        errors.push({
          bookmarkId: bookmark.id,
          error: errorMessage,
        })
        console.error(`[admin/embeddings] Failed to enqueue bookmark ${bookmark.id}:`, errorMessage)
      }
    }

    console.log(`[admin/embeddings] Enqueued ${enqueuedCount} bookmarks for embedding regeneration`)

    if (errors.length > 0) {
      console.warn(`[admin/embeddings] ${errors.length} bookmarks failed to enqueue`)
    }

    return c.json({
      success: true,
      count: enqueuedCount,
      message: `Enqueued ${enqueuedCount} bookmarks for processing. Worker concurrency: 5.`,
      ...(errors.length > 0 && { failedToEnqueue: errors.length, errors }),
    })
  } catch (error) {
    console.error('[admin/embeddings] Error in bulk-regenerate-queue:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /bulk-regenerate-all-queue - Enqueue ALL bookmarks for processing (including those with existing embeddings).
 *
 * This endpoint queues ALL completed bookmarks for background processing using BullMQ,
 * regardless of whether they already have embeddings. Use this when you want to
 * regenerate embeddings for the entire database (e.g., after model updates).
 *
 * Only bookmarks with processing_status = 'completed' are queued.
 *
 * Returns:
 * - success: boolean
 * - count: number of jobs enqueued
 * - message: string describing the result
 */
embeddingsRoutes.post('/bulk-regenerate-all-queue', async (c) => {
  try {
    // Query ALL completed bookmarks (regardless of embedding status)
    const { data: bookmarksData, error: fetchError } = await supabaseAdmin
      .from('bookmarks')
      .select('id, url, user_id')
      .eq('processing_status', 'completed')

    if (fetchError) {
      console.error('[admin/embeddings] Error fetching bookmarks for queue:', fetchError)
      return c.json({ error: 'Failed to fetch bookmarks' }, 500)
    }

    const bookmarks = (bookmarksData as QueueBookmark[] | null) || []

    if (bookmarks.length === 0) {
      return c.json({
        success: true,
        count: 0,
        message: 'No completed bookmarks found',
      })
    }

    // Enqueue each bookmark for processing
    let enqueuedCount = 0
    const errors: Array<{ bookmarkId: string; error: string }> = []

    for (const bookmark of bookmarks) {
      try {
        await enqueueBookmarkProcessing(bookmark.id, bookmark.url, bookmark.user_id)
        enqueuedCount++
      } catch (enqueueError) {
        const errorMessage = enqueueError instanceof Error ? enqueueError.message : String(enqueueError)
        errors.push({
          bookmarkId: bookmark.id,
          error: errorMessage,
        })
        console.error(`[admin/embeddings] Failed to enqueue bookmark ${bookmark.id}:`, errorMessage)
      }
    }

    console.log(`[admin/embeddings] Enqueued ${enqueuedCount} bookmarks for full embedding regeneration`)

    if (errors.length > 0) {
      console.warn(`[admin/embeddings] ${errors.length} bookmarks failed to enqueue`)
    }

    return c.json({
      success: true,
      count: enqueuedCount,
      message: `Enqueued ${enqueuedCount} bookmarks for full regeneration. Worker concurrency: 5.`,
      ...(errors.length > 0 && { failedToEnqueue: errors.length, errors }),
    })
  } catch (error) {
    console.error('[admin/embeddings] Error in bulk-regenerate-all-queue:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
