import { Hono } from 'hono'
import { z } from 'zod'
import { supabaseAdmin } from '../../config/supabase'
import type { Database } from '@plukd/shared'

type BookmarkRow = Database['public']['Tables']['bookmarks']['Row']

/**
 * Error severity levels for categorization.
 * - critical: Database errors, AI failures that require immediate attention
 * - warning: Extraction failures, rate limits, recoverable errors
 */
export type ErrorSeverity = 'critical' | 'warning'

/**
 * Error type categorization based on processing_error content.
 */
export type ErrorType =
  | 'extraction_failed'
  | 'parallel_ai_extraction'
  | 'og_metadata_extraction'
  | 'complete_extraction_failure'
  | 'ai_processing'
  | 'network_error'
  | 'validation_error'
  | 'database_error'
  | 'rate_limit'
  | 'timeout'
  | 'unknown'

/**
 * Error log entry response structure.
 * Based on ADMIN_DASHBOARD_SPEC.md Error Logs Table.
 */
export interface AdminErrorLog {
  id: string
  bookmarkId: string
  severity: ErrorSeverity
  type: ErrorType
  message: string
  extractionError: string | null
  title: string
  url: string
  source: string
  userId: string
  userEmail: string | null
  retryCount: number
  createdAt: string
  updatedAt: string
}

/**
 * Admin errors list response structure.
 */
export interface AdminErrorsResponse {
  errors: AdminErrorLog[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  stats: {
    total24h: number
    critical: number
    warnings: number
    extractionErrors: number
  }
}

/**
 * Categorize error severity based on error message content.
 * Critical errors are ones that require immediate attention.
 */
function categorizeErrorSeverity(errorMessage: string | null): ErrorSeverity {
  if (!errorMessage) return 'warning'

  const criticalPatterns = [
    /database/i,
    /connection.*(?:refused|timeout|failed)/i,
    /model.*not.*respond/i,
    /rate.*limit.*exceeded/i,
    /internal.*error/i,
    /critical/i,
    /fatal/i,
    /quota/i,
  ]

  for (const pattern of criticalPatterns) {
    if (pattern.test(errorMessage)) {
      return 'critical'
    }
  }

  return 'warning'
}

/**
 * Categorize extraction error based on extraction_error field content.
 * Returns null if no specific extraction error type is found.
 */
function categorizeExtractionErrorType(extractionError: string | null): ErrorType | null {
  if (!extractionError) return null

  const lowerMessage = extractionError.toLowerCase()

  if (lowerMessage.includes('complete extraction failure')) {
    return 'complete_extraction_failure'
  }
  if (lowerMessage.includes('parallel ai extraction failed')) {
    return 'parallel_ai_extraction'
  }
  if (lowerMessage.includes('og metadata')) {
    return 'og_metadata_extraction'
  }

  return 'extraction_failed'
}

/**
 * Categorize error type based on error message content.
 * Order matters - more specific patterns should be checked first.
 */
function categorizeErrorType(errorMessage: string | null, extractionError: string | null = null): ErrorType {
  // First, check for specific extraction error types
  const extractionType = categorizeExtractionErrorType(extractionError)
  if (extractionType) {
    return extractionType
  }

  if (!errorMessage) return 'unknown'

  const lowerMessage = errorMessage.toLowerCase()

  // Check more specific patterns first
  if (lowerMessage.includes('database') || lowerMessage.includes('supabase') || lowerMessage.includes('postgres')) {
    return 'database_error'
  }
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('rate_limit') || lowerMessage.includes('429')) {
    return 'rate_limit'
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'timeout'
  }
  if (lowerMessage.includes('extraction') || lowerMessage.includes('extract')) {
    return 'extraction_failed'
  }
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
    return 'validation_error'
  }
  // Network errors - check 'connection' but exclude patterns already matched above
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch') ||
      (lowerMessage.includes('connection') && !lowerMessage.includes('database'))) {
    return 'network_error'
  }
  // AI processing - check last to avoid false positives with "model" in other contexts
  if (lowerMessage.includes('ai ') || lowerMessage.includes(' ai') ||
      lowerMessage.includes('gemini') ||
      (lowerMessage.includes('model') && (lowerMessage.includes('not respond') || lowerMessage.includes('error')))) {
    return 'ai_processing'
  }

  return 'unknown'
}

// Query params schema for list endpoint
const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  severity: z.enum(['critical', 'warning', 'all']).default('all'),
  timeRange: z.enum(['1h', '24h', '7d', '30d', 'all']).default('24h'),
  search: z.string().optional(),
  sortBy: z.enum(['created_at', 'updated_at']).default('updated_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  extractionErrorsOnly: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
})

export const adminErrorsRoutes = new Hono()

// Default pagination limit
const DEFAULT_PAGE_LIMIT = 50

/**
 * GET / - List error logs (failed bookmarks with processing errors)
 *
 * Query params:
 * - page: Page number (default 1)
 * - limit: Results per page (default 50, max 100)
 * - severity: Filter by severity ('critical' | 'warning' | 'all')
 * - timeRange: Filter by time range ('1h' | '24h' | '7d' | '30d' | 'all')
 * - search: Search in error message
 * - sortBy: Sort field ('created_at' | 'updated_at')
 * - sortOrder: Sort direction ('asc' | 'desc')
 */
adminErrorsRoutes.get('/', async (c) => {
  try {
    const query = c.req.query()

    // Parse and validate query params
    const params = listQuerySchema.parse({
      page: query.page,
      limit: query.limit,
      severity: query.severity || 'all',
      timeRange: query.timeRange || '24h',
      search: query.search || undefined,
      sortBy: query.sortBy || 'updated_at',
      sortOrder: query.sortOrder || 'desc',
      extractionErrorsOnly: query.extractionErrorsOnly,
    })

    // Calculate time filter based on timeRange
    let timeFilter: Date | null = null
    const now = new Date()
    switch (params.timeRange) {
      case '1h':
        timeFilter = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case '24h':
        timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'all':
      default:
        timeFilter = null
    }

    // Build query for failed bookmarks
    let dbQuery = supabaseAdmin
      .from('bookmarks')
      .select('*', { count: 'exact' })
      .eq('processing_status', 'failed')

    // Apply time filter
    if (timeFilter) {
      dbQuery = dbQuery.gte('updated_at', timeFilter.toISOString())
    }

    // Apply search filter on processing_error
    if (params.search) {
      dbQuery = dbQuery.ilike('processing_error', `%${params.search}%`)
    }

    // Apply extraction errors filter
    if (params.extractionErrorsOnly) {
      dbQuery = dbQuery.not('extraction_error', 'is', null)
    }

    // Apply sorting
    dbQuery = dbQuery.order(params.sortBy, {
      ascending: params.sortOrder === 'asc',
    })

    // Apply pagination
    const offset = (params.page - 1) * params.limit
    dbQuery = dbQuery.range(offset, offset + params.limit - 1)

    const { data: bookmarks, error, count } = await dbQuery

    if (error) {
      console.error('[admin/errors] Error fetching failed bookmarks:', error)
      return c.json({ error: 'Failed to fetch error logs' }, 500)
    }

    const typedBookmarks = bookmarks as BookmarkRow[] | null

    // Get user emails for the bookmarks (batch lookup)
    const userIds = [...new Set((typedBookmarks || []).map((b) => b.user_id))]
    const userEmailMap: Record<string, string | null> = {}

    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .in('id', userIds)

      if (users) {
        for (const user of users) {
          userEmailMap[user.id] = user.email
        }
      }
    }

    // Transform bookmarks to error logs
    const errors: AdminErrorLog[] = (typedBookmarks || []).map((bookmark) => {
      const extractionError = (bookmark as BookmarkRow & { extraction_error?: string | null }).extraction_error ?? null
      const severity = categorizeErrorSeverity(bookmark.processing_error)
      const errorType = categorizeErrorType(bookmark.processing_error, extractionError)

      return {
        id: bookmark.id, // Using bookmark ID as error log ID
        bookmarkId: bookmark.id,
        severity,
        type: errorType,
        message: bookmark.processing_error || 'Unknown error',
        extractionError,
        title: bookmark.title,
        url: bookmark.url,
        source: bookmark.source,
        userId: bookmark.user_id,
        userEmail: userEmailMap[bookmark.user_id] || null,
        retryCount: 0, // TODO: Track retry count in database if needed
        createdAt: bookmark.created_at,
        updatedAt: bookmark.updated_at,
      }
    })

    // Filter by severity if specified (done in-memory after categorization)
    const filteredErrors =
      params.severity === 'all'
        ? errors
        : errors.filter((e) => e.severity === params.severity)

    // Get 24h stats for response
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const { count: total24h } = await supabaseAdmin
      .from('bookmarks')
      .select('*', { count: 'exact', head: true })
      .eq('processing_status', 'failed')
      .gte('updated_at', twentyFourHoursAgo.toISOString())

    // Count critical vs warning errors
    const critical = filteredErrors.filter((e) => e.severity === 'critical').length
    const warnings = filteredErrors.filter((e) => e.severity === 'warning').length
    const extractionErrors = filteredErrors.filter((e) => e.extractionError !== null).length

    const total = count || 0
    const totalPages = Math.ceil(total / params.limit)

    const response: AdminErrorsResponse = {
      errors: filteredErrors,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
        hasNextPage: params.page < totalPages,
        hasPreviousPage: params.page > 1,
      },
      stats: {
        total24h: total24h || 0,
        critical,
        warnings,
        extractionErrors,
      },
    }

    return c.json(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid query parameters', details: error.issues }, 400)
    }
    console.error('[admin/errors] Error in list:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /:id - Get error details for a specific bookmark
 */
adminErrorsRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return c.json({ error: 'Invalid error ID' }, 400)
    }

    // Fetch the failed bookmark
    const { data: bookmark, error } = await supabaseAdmin
      .from('bookmarks')
      .select('*')
      .eq('id', id)
      .eq('processing_status', 'failed')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ error: 'Error not found' }, 404)
      }
      console.error('[admin/errors] Error fetching error details:', error)
      return c.json({ error: 'Failed to fetch error details' }, 500)
    }

    const typedBookmark = bookmark as BookmarkRow

    // Get user email
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', typedBookmark.user_id)
      .single()

    const extractionError = (typedBookmark as BookmarkRow & { extraction_error?: string | null }).extraction_error ?? null
    const severity = categorizeErrorSeverity(typedBookmark.processing_error)
    const errorType = categorizeErrorType(typedBookmark.processing_error, extractionError)

    const errorLog: AdminErrorLog = {
      id: typedBookmark.id,
      bookmarkId: typedBookmark.id,
      severity,
      type: errorType,
      message: typedBookmark.processing_error || 'Unknown error',
      extractionError,
      title: typedBookmark.title,
      url: typedBookmark.url,
      source: typedBookmark.source,
      userId: typedBookmark.user_id,
      userEmail: user?.email || null,
      retryCount: 0,
      createdAt: typedBookmark.created_at,
      updatedAt: typedBookmark.updated_at,
    }

    return c.json(errorLog)
  } catch (error) {
    console.error('[admin/errors] Error in get:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /:id/resolve - Mark error as resolved (delete the failed bookmark)
 */
adminErrorsRoutes.post('/:id/resolve', async (c) => {
  try {
    const id = c.req.param('id')

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return c.json({ error: 'Invalid error ID' }, 400)
    }

    // Delete the failed bookmark
    const { error } = await supabaseAdmin
      .from('bookmarks')
      .delete()
      .eq('id', id)
      .eq('processing_status', 'failed')

    if (error) {
      console.error('[admin/errors] Error resolving error:', error)
      return c.json({ error: 'Failed to resolve error' }, 500)
    }

    return c.json({ success: true, message: 'Error resolved' })
  } catch (error) {
    console.error('[admin/errors] Error in resolve:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
