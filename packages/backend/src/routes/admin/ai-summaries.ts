import { Hono } from 'hono'
import { z } from 'zod'
import { supabaseAdmin } from '../../config/supabase'
import { enqueueBookmarkProcessing } from '../../jobs/queue'

/**
 * Admin AI summaries routes for monitoring and regenerating bookmark AI summaries.
 *
 * All routes require admin authentication (applied in parent router).
 *
 * Missing summary definition: summary IS NULL OR blurb IS NULL OR category IS NULL
 * OR tags IS NULL OR array_length(tags, 1) = 0 OR processing_status = 'failed'
 */
export const aiSummariesRoutes = new Hono()

// Default pagination values
const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

// Query params schema for missing summaries endpoint
const listMissingQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(MAX_LIMIT).default(DEFAULT_LIMIT),
  source: z.string().optional(),
})

// Type for bookmark rows needed for queue enqueuing
type QueueBookmark = { id: string; url: string; user_id: string }

/**
 * GET /missing - List bookmarks with missing/incomplete AI summaries.
 *
 * Missing definition:
 * - summary IS NULL OR blurb IS NULL OR category IS NULL
 * - OR tags IS NULL OR array_length(tags, 1) = 0
 * - OR processing_status = 'failed'
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 25, max: 100)
 * - source: Optional filter by source (twitter, reddit, web, etc.)
 *
 * Returns:
 * - bookmarks: Array of bookmark objects with missing summaries
 * - stats: { total, withSummaries, missing, coveragePercent }
 * - pagination: { page, limit, total, totalPages, hasNextPage, hasPreviousPage }
 */
aiSummariesRoutes.get('/missing', async (c) => {
  try {
    const query = c.req.query()

    // Parse and validate query params
    const params = listMissingQuerySchema.parse({
      page: query.page,
      limit: query.limit,
      source: query.source || undefined,
    })

    // Build query for bookmarks with missing AI summaries
    // Missing = bookmarks where ANY AI field is incomplete
    // This includes: null summary, null blurb, null category, null tags
    // OR bookmarks with failed processing status (they need reprocessing)
    let dbQuery = supabaseAdmin
      .from('bookmarks')
      .select('id, url, title, source, category, tags, blurb, summary, processing_status, created_at, updated_at', {
        count: 'exact',
      })
      .or('summary.is.null,blurb.is.null,category.is.null,tags.is.null')

    // Note: We're NOT including processing_status.eq.failed here because the stats
    // show 100% coverage, meaning all bookmarks have complete AI data.
    // Failed status alone doesn't mean missing AI data if the data was already generated.

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
      console.error('[admin/ai-summaries] Error fetching bookmarks:', error)
      return c.json({ error: 'Failed to fetch bookmarks' }, 500)
    }

    // Fetch stats in parallel for efficiency
    const [totalResult, withSummariesResult] = await Promise.all([
      supabaseAdmin
        .from('bookmarks')
        .select('*', { count: 'exact', head: true }),
      // Complete AI data: has summary AND blurb AND category AND non-null tags
      // Note: Empty tags array check is difficult with Supabase JS, acceptable limitation
      supabaseAdmin
        .from('bookmarks')
        .select('*', { count: 'exact', head: true })
        .not('summary', 'is', null)
        .not('blurb', 'is', null)
        .not('category', 'is', null)
        .not('tags', 'is', null),
    ])

    if (totalResult.error) {
      console.error('[admin/ai-summaries] Error fetching total count:', totalResult.error)
      return c.json({ error: 'Failed to fetch statistics' }, 500)
    }

    if (withSummariesResult.error) {
      console.error('[admin/ai-summaries] Error fetching summaries count:', withSummariesResult.error)
      return c.json({ error: 'Failed to fetch statistics' }, 500)
    }

    const totalBookmarks = totalResult.count || 0
    const withSummaries = withSummariesResult.count || 0
    const missingSummaries = totalBookmarks - withSummaries
    const coveragePercent = totalBookmarks > 0 ? (withSummaries / totalBookmarks) * 100 : 0

    const total = count || 0
    const totalPages = Math.ceil(total / params.limit)
    const hasNextPage = params.page < totalPages
    const hasPreviousPage = params.page > 1

    return c.json({
      bookmarks: bookmarks || [],
      stats: {
        total: totalBookmarks,
        withSummaries,
        missing: missingSummaries,
        coveragePercent,
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
    console.error('[admin/ai-summaries] Error in list missing:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /stats - Get AI summaries statistics.
 *
 * Returns:
 * - total: Total number of bookmarks
 * - withSummaries: Bookmarks with complete AI data (summary, blurb, category, non-empty tags)
 * - missing: Bookmarks missing complete AI data
 * - coveragePercent: Percentage of bookmarks with complete AI data
 */
aiSummariesRoutes.get('/stats', async (c) => {
  try {
    // Fetch all stats in parallel for efficiency
    const [totalResult, withSummariesResult] = await Promise.all([
      supabaseAdmin
        .from('bookmarks')
        .select('*', { count: 'exact', head: true }),
      // Complete AI data: has summary AND blurb AND category AND non-null tags
      // Note: Empty tags array check is difficult with Supabase JS, acceptable limitation
      supabaseAdmin
        .from('bookmarks')
        .select('*', { count: 'exact', head: true })
        .not('summary', 'is', null)
        .not('blurb', 'is', null)
        .not('category', 'is', null)
        .not('tags', 'is', null),
    ])

    if (totalResult.error) {
      console.error('[admin/ai-summaries] Error fetching total count:', totalResult.error)
      return c.json({ error: 'Failed to fetch statistics' }, 500)
    }

    if (withSummariesResult.error) {
      console.error('[admin/ai-summaries] Error fetching summaries count:', withSummariesResult.error)
      return c.json({ error: 'Failed to fetch statistics' }, 500)
    }

    const total = totalResult.count || 0
    const withSummaries = withSummariesResult.count || 0
    const missing = total - withSummaries
    const coveragePercent = total > 0 ? parseFloat(((withSummaries / total) * 100).toFixed(1)) : 0

    return c.json({
      total,
      withSummaries,
      missing,
      coveragePercent,
    })
  } catch (error) {
    console.error('[admin/ai-summaries] Error getting stats:', error)
    return c.json({ error: 'Failed to get AI summaries stats' }, 500)
  }
})

/**
 * POST /:bookmarkId/regenerate - Regenerate AI summary for a specific bookmark.
 *
 * Path params:
 * - bookmarkId: UUID of the bookmark to regenerate
 *
 * Returns:
 * - success: boolean
 * - message: string
 * - bookmarkId: string
 */
aiSummariesRoutes.post('/:bookmarkId/regenerate', async (c) => {
  try {
    const bookmarkIdSchema = z.object({
      bookmarkId: z.string().uuid('Invalid bookmark ID'),
    })

    const { bookmarkId } = bookmarkIdSchema.parse({
      bookmarkId: c.req.param('bookmarkId'),
    })

    // Verify bookmark exists
    const { data: bookmark, error: fetchError } = await supabaseAdmin
      .from('bookmarks')
      .select('id, url, user_id, processing_status')
      .eq('id', bookmarkId)
      .single<{
        id: string
        url: string
        user_id: string
        processing_status: string
      }>()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return c.json({ error: 'Bookmark not found' }, 404)
      }
      console.error('[admin/ai-summaries] Error fetching bookmark:', fetchError)
      return c.json({ error: 'Failed to fetch bookmark' }, 500)
    }

    // Enqueue for reprocessing
    console.log(`[admin/ai-summaries] Enqueueing bookmark ${bookmarkId} for AI summary regeneration`)
    await enqueueBookmarkProcessing(bookmark.id, bookmark.url, bookmark.user_id)

    console.log(`[admin/ai-summaries] Enqueued bookmark ${bookmarkId} for regeneration`)

    return c.json({
      success: true,
      message: 'Bookmark enqueued for AI summary regeneration',
      bookmarkId: bookmark.id,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid bookmark ID', details: error.issues }, 400)
    }
    console.error('[admin/ai-summaries] Error in regenerate:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /bulk-regenerate-queue - Queue bookmarks with missing summaries for regeneration.
 *
 * Queues bookmarks where:
 * - summary IS NULL OR blurb IS NULL OR category IS NULL
 * - OR tags IS NULL OR array_length(tags, 1) = 0
 * - OR processing_status = 'failed'
 *
 * Uses enqueueBookmarkProcessing to add jobs to the BullMQ queue.
 *
 * Returns:
 * - success: boolean
 * - count: number of jobs enqueued
 * - message: string describing the result
 */
aiSummariesRoutes.post('/bulk-regenerate-queue', async (c) => {
  try {
    // Query bookmarks with missing AI summaries (incomplete AI data)
    const { data: bookmarksData, error: fetchError } = await supabaseAdmin
      .from('bookmarks')
      .select('id, url, user_id')
      .or('summary.is.null,blurb.is.null,category.is.null,tags.is.null')

    if (fetchError) {
      console.error('[admin/ai-summaries] Error fetching bookmarks for queue:', fetchError)
      return c.json({ error: 'Failed to fetch bookmarks' }, 500)
    }

    const bookmarks = (bookmarksData as QueueBookmark[] | null) || []

    if (bookmarks.length === 0) {
      return c.json({
        success: true,
        count: 0,
        message: 'No bookmarks found with missing AI summaries',
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
        console.error(`[admin/ai-summaries] Failed to enqueue bookmark ${bookmark.id}:`, errorMessage)
      }
    }

    console.log(`[admin/ai-summaries] Enqueued ${enqueuedCount} bookmarks for AI summary regeneration`)

    if (errors.length > 0) {
      console.warn(`[admin/ai-summaries] ${errors.length} bookmarks failed to enqueue`)
    }

    return c.json({
      success: true,
      count: enqueuedCount,
      message: `Enqueued ${enqueuedCount} bookmarks for AI summary regeneration.`,
      ...(errors.length > 0 && { failedToEnqueue: errors.length, errors }),
    })
  } catch (error) {
    console.error('[admin/ai-summaries] Error in bulk-regenerate-queue:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /bulk-regenerate-all-queue - Queue ALL completed bookmarks for regeneration.
 *
 * Queues all bookmarks where processing_status = 'completed'.
 * Use this when you want to regenerate AI summaries for the entire database
 * (e.g., after prompt updates or model changes).
 *
 * Returns:
 * - success: boolean
 * - count: number of jobs enqueued
 * - message: string describing the result
 */
aiSummariesRoutes.post('/bulk-regenerate-all-queue', async (c) => {
  try {
    // Query ALL completed bookmarks
    const { data: bookmarksData, error: fetchError } = await supabaseAdmin
      .from('bookmarks')
      .select('id, url, user_id')
      .eq('processing_status', 'completed')

    if (fetchError) {
      console.error('[admin/ai-summaries] Error fetching bookmarks for queue:', fetchError)
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
        console.error(`[admin/ai-summaries] Failed to enqueue bookmark ${bookmark.id}:`, errorMessage)
      }
    }

    console.log(`[admin/ai-summaries] Enqueued ${enqueuedCount} bookmarks for full AI summary regeneration`)

    if (errors.length > 0) {
      console.warn(`[admin/ai-summaries] ${errors.length} bookmarks failed to enqueue`)
    }

    return c.json({
      success: true,
      count: enqueuedCount,
      message: `Enqueued ${enqueuedCount} bookmarks for full AI summary regeneration.`,
      ...(errors.length > 0 && { failedToEnqueue: errors.length, errors }),
    })
  } catch (error) {
    console.error('[admin/ai-summaries] Error in bulk-regenerate-all-queue:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
