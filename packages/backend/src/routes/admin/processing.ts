import { Hono } from 'hono'
import { z } from 'zod'
import { supabaseAdmin } from '../../config/supabase'
import { enqueueBookmarkProcessing, bookmarkQueue } from '../../jobs/queue'
import type { ProcessingStatus } from '@plukd/shared'

/**
 * Admin processing routes for monitoring and managing bookmark processing.
 *
 * All routes require admin authentication (applied in parent router).
 */
export const processingRoutes = new Hono()

// Default pagination values
const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

// Query params schema for list endpoint
const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(MAX_LIMIT).default(DEFAULT_LIMIT),
  status: z
    .enum(['pending', 'processing', 'completed', 'failed'])
    .optional(),
})

// Bookmark ID param schema
const bookmarkIdSchema = z.object({
  bookmarkId: z.string().uuid('Invalid bookmark ID'),
})

/**
 * GET / - List bookmarks by processing status with pagination.
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 25, max: 100)
 * - status: Filter by processing status (pending, processing, completed, failed)
 *
 * Returns:
 * - bookmarks: Array of bookmark objects
 * - pagination: { page, limit, total, totalPages, hasNextPage, hasPreviousPage }
 */
processingRoutes.get('/', async (c) => {
  try {
    const query = c.req.query()

    // Parse and validate query params
    const params = listQuerySchema.parse({
      page: query.page,
      limit: query.limit,
      status: query.status || undefined,
    })

    // Build query
    let dbQuery = supabaseAdmin
      .from('bookmarks')
      .select('id, url, title, source, processing_status, processing_error, created_at, updated_at', {
        count: 'exact',
      })

    // Apply status filter if provided
    if (params.status) {
      dbQuery = dbQuery.eq('processing_status', params.status)
    }

    // Order by created_at descending (newest first)
    dbQuery = dbQuery.order('created_at', { ascending: false })

    // Apply pagination
    const offset = (params.page - 1) * params.limit
    dbQuery = dbQuery.range(offset, offset + params.limit - 1)

    const { data: bookmarks, error, count } = await dbQuery

    if (error) {
      console.error('[admin/processing] Error fetching bookmarks:', error)
      return c.json({ error: 'Failed to fetch bookmarks' }, 500)
    }

    const total = count || 0
    const totalPages = Math.ceil(total / params.limit)
    const hasNextPage = params.page < totalPages
    const hasPreviousPage = params.page > 1

    return c.json({
      bookmarks: bookmarks || [],
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
    console.error('[admin/processing] Error in list:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /stats - Get processing queue statistics.
 *
 * Returns counts by processing status and queue metrics from BullMQ.
 */
processingRoutes.get('/stats', async (c) => {
  try {
    // Get counts by processing status from database
    const statusCounts: Record<ProcessingStatus, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    }

    const statuses: ProcessingStatus[] = ['pending', 'processing', 'completed', 'failed']

    await Promise.all(
      statuses.map(async (status) => {
        const { count, error } = await supabaseAdmin
          .from('bookmarks')
          .select('*', { count: 'exact', head: true })
          .eq('processing_status', status)

        if (!error) {
          statusCounts[status] = count || 0
        }
      })
    )

    // Get queue metrics from BullMQ
    const [waiting, active, completed, failed] = await Promise.all([
      bookmarkQueue.getWaitingCount(),
      bookmarkQueue.getActiveCount(),
      bookmarkQueue.getCompletedCount(),
      bookmarkQueue.getFailedCount(),
    ])

    return c.json({
      database: statusCounts,
      queue: {
        waiting,
        active,
        completed,
        failed,
      },
    })
  } catch (error) {
    console.error('[admin/processing] Error getting stats:', error)
    return c.json({ error: 'Failed to get processing stats' }, 500)
  }
})

/**
 * POST /:bookmarkId/reprocess - Requeue a bookmark for processing.
 *
 * This will:
 * 1. Verify the bookmark exists
 * 2. Reset its processing status to 'pending'
 * 3. Clear any previous processing error
 * 4. Enqueue it in BullMQ for processing
 *
 * Path params:
 * - bookmarkId: UUID of the bookmark to reprocess
 *
 * Returns:
 * - success: boolean
 * - message: string
 * - bookmarkId: string
 */
processingRoutes.post('/:bookmarkId/reprocess', async (c) => {
  try {
    const { bookmarkId } = bookmarkIdSchema.parse({
      bookmarkId: c.req.param('bookmarkId'),
    })

    // Fetch the bookmark to verify it exists and get required fields
    const { data: bookmark, error: fetchError } = await supabaseAdmin
      .from('bookmarks')
      .select('id, url, user_id, processing_status')
      .eq('id', bookmarkId)
      .single<{ id: string; url: string; user_id: string; processing_status: string }>()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return c.json({ error: 'Bookmark not found' }, 404)
      }
      console.error('[admin/processing] Error fetching bookmark:', fetchError)
      return c.json({ error: 'Failed to fetch bookmark' }, 500)
    }

    // Reset processing status
    const { error: updateError } = await supabaseAdmin
      .from('bookmarks')
      .update({
        processing_status: 'pending' as ProcessingStatus,
        processing_error: null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', bookmarkId)

    if (updateError) {
      console.error('[admin/processing] Error resetting bookmark status:', updateError)
      return c.json({ error: 'Failed to reset bookmark status' }, 500)
    }

    // Enqueue for processing
    await enqueueBookmarkProcessing(bookmark.id, bookmark.url, bookmark.user_id)

    console.log(`[admin/processing] Requeued bookmark ${bookmarkId} for processing`)

    return c.json({
      success: true,
      message: 'Bookmark requeued for processing',
      bookmarkId: bookmark.id,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid bookmark ID', details: error.issues }, 400)
    }
    console.error('[admin/processing] Error in reprocess:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /bulk-reprocess - Requeue multiple bookmarks for processing.
 *
 * Body:
 * - bookmarkIds: Array of bookmark UUIDs to reprocess
 *
 * Returns:
 * - success: boolean
 * - processed: number of bookmarks successfully requeued
 * - failed: number of bookmarks that failed to requeue
 * - errors: Array of { bookmarkId, error } for failed items
 */
const bulkReprocessSchema = z.object({
  bookmarkIds: z.array(z.string().uuid()).min(1, 'At least one bookmark ID required').max(100, 'Maximum 100 bookmarks per request'),
})

processingRoutes.post('/bulk-reprocess', async (c) => {
  try {
    const body = await c.req.json()
    const { bookmarkIds } = bulkReprocessSchema.parse(body)

    // Type for bookmark rows in bulk operations
    type BulkBookmark = { id: string; url: string; user_id: string }

    // Fetch all bookmarks to verify they exist
    const { data: bookmarksData, error: fetchError } = await supabaseAdmin
      .from('bookmarks')
      .select('id, url, user_id')
      .in('id', bookmarkIds)

    if (fetchError) {
      console.error('[admin/processing] Error fetching bookmarks:', fetchError)
      return c.json({ error: 'Failed to fetch bookmarks' }, 500)
    }

    const bookmarks = (bookmarksData as BulkBookmark[] | null) || []
    const foundIds = new Set(bookmarks.map((b) => b.id))
    const errors: Array<{ bookmarkId: string; error: string }> = []

    // Mark missing bookmarks as errors
    for (const id of bookmarkIds) {
      if (!foundIds.has(id)) {
        errors.push({ bookmarkId: id, error: 'Bookmark not found' })
      }
    }

    if (bookmarks.length === 0) {
      return c.json({
        success: false,
        processed: 0,
        failed: bookmarkIds.length,
        errors,
      })
    }

    // Reset processing status for all found bookmarks
    const { error: updateError } = await supabaseAdmin
      .from('bookmarks')
      .update({
        processing_status: 'pending' as ProcessingStatus,
        processing_error: null,
        updated_at: new Date().toISOString(),
      } as never)
      .in('id', bookmarks.map((b) => b.id))

    if (updateError) {
      console.error('[admin/processing] Error resetting bookmark statuses:', updateError)
      return c.json({ error: 'Failed to reset bookmark statuses' }, 500)
    }

    // Enqueue all bookmarks for processing
    let processed = 0
    for (const bookmark of bookmarks) {
      try {
        await enqueueBookmarkProcessing(bookmark.id, bookmark.url, bookmark.user_id)
        processed++
      } catch (enqueueError) {
        const errorMessage = enqueueError instanceof Error ? enqueueError.message : String(enqueueError)
        errors.push({ bookmarkId: bookmark.id, error: errorMessage })
      }
    }

    console.log(`[admin/processing] Bulk requeued ${processed} bookmarks for processing`)

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
    console.error('[admin/processing] Error in bulk-reprocess:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
