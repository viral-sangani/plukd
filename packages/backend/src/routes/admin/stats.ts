import { Hono } from 'hono'
import { supabaseAdmin } from '../../config/supabase'
import type { ContentSource, ProcessingStatus } from '@plukd/shared'

/**
 * Admin statistics response interface matching the spec:
 * GET /api/admin/stats
 *
 * Returns comprehensive statistics for the admin dashboard including:
 * - Total bookmarks count
 * - Processing status breakdown
 * - Embedding coverage metrics
 * - Error statistics
 * - Source distribution
 */
export interface AdminStatsResponse {
  // Overview metrics
  totalBookmarks: number
  successRate: number // percentage of completed bookmarks
  embeddingCoverage: number // percentage of bookmarks with embeddings
  errorRate: number // percentage of failed bookmarks

  // Processing stats
  processing: {
    pending: number
    processing: number
    completed: number
    failed: number
  }

  // Embedding stats
  embeddings: {
    total: number
    withEmbedding: number
    missing: number
    coveragePercent: number
  }

  // Error stats (24h)
  errors: {
    total24h: number
    byType: Record<string, number>
  }

  // Extraction error stats
  extractionErrors: {
    total: number
    parallelAiFailed: number
    ogMetadataFailed: number
    completeFailure: number
    completedWithErrors: number
  }

  // Source distribution
  sourceDistribution: Array<{
    source: ContentSource
    count: number
    percentage: number
  }>

  // Metadata
  generatedAt: string
}

export const adminStatsRoutes = new Hono()

/**
 * GET / - Get all admin statistics
 *
 * Returns comprehensive statistics for the admin overview dashboard.
 * This endpoint aggregates data from the bookmarks table including:
 * - Total counts and rates
 * - Processing status breakdown
 * - Embedding coverage metrics
 * - Error distribution
 * - Source distribution with percentages
 */
adminStatsRoutes.get('/', async (c) => {
  try {
    // Execute all stat queries in parallel for performance
    const [
      totalResult,
      processingStatsResult,
      embeddingStatsResult,
      errorStats24hResult,
      sourceDistributionResult,
      extractionErrorStatsResult,
    ] = await Promise.all([
      // Total bookmarks count
      supabaseAdmin
        .from('bookmarks')
        .select('*', { count: 'exact', head: true }),

      // Processing status counts
      getProcessingStats(),

      // Embedding coverage stats
      getEmbeddingStats(),

      // Error stats (last 24h)
      getErrorStats24h(),

      // Source distribution
      getSourceDistribution(),

      // Extraction error stats
      getExtractionErrorStats(),
    ])

    // Check for critical errors in the total count query
    if (totalResult.error) {
      console.error('[admin/stats] Error fetching total count:', totalResult.error)
      return c.json({ error: 'Failed to fetch statistics' }, 500)
    }

    const totalBookmarks = totalResult.count || 0
    const processingStats = processingStatsResult
    const embeddingStats = embeddingStatsResult
    const errorStats = errorStats24hResult
    const sourceDistribution = sourceDistributionResult
    const extractionErrorStats = extractionErrorStatsResult

    // Calculate rates
    const successRate = totalBookmarks > 0
      ? (processingStats.completed / totalBookmarks) * 100
      : 0

    const errorRate = totalBookmarks > 0
      ? (processingStats.failed / totalBookmarks) * 100
      : 0

    // Transform to match frontend expected structure
    const frontendResponse = {
      totalBookmarks,
      successRate: Math.round(successRate * 10) / 10,
      successRateChange: 0, // TODO: Calculate trend from historical data
      embeddingsCount: embeddingStats.withEmbedding,
      embeddingsCoverage: embeddingStats.coveragePercent,
      errorRate: Math.round(errorRate * 10) / 10,
      errorRateChange: 0, // TODO: Calculate trend from historical data
      sourceDistribution: sourceDistribution.map((s) => ({
        source: s.source.charAt(0).toUpperCase() + s.source.slice(1),
        count: s.count,
        percentage: s.percentage,
      })),
      processingStats: {
        completed24h: processingStats.completed, // For now, use total completed
        failed24h: errorStats.total24h,
        pending: processingStats.pending,
        processing: processingStats.processing,
        avgProcessingTime: 0, // TODO: Calculate from job data
      },
      extractionErrors: extractionErrorStats,
    }

    return c.json(frontendResponse)
  } catch (error) {
    console.error('[admin/stats] Error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * Get processing status breakdown
 */
async function getProcessingStats(): Promise<{
  pending: number
  processing: number
  completed: number
  failed: number
}> {
  const statuses: ProcessingStatus[] = ['pending', 'processing', 'completed', 'failed']

  const results = await Promise.all(
    statuses.map(async (status) => {
      const { count, error } = await supabaseAdmin
        .from('bookmarks')
        .select('*', { count: 'exact', head: true })
        .eq('processing_status', status)

      if (error) {
        console.error(`[admin/stats] Error fetching ${status} count:`, error)
        return { status, count: 0 }
      }

      return { status, count: count || 0 }
    })
  )

  const stats: Record<ProcessingStatus, number> = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  }

  for (const result of results) {
    stats[result.status] = result.count
  }

  return stats
}

/**
 * Get embedding coverage statistics
 */
async function getEmbeddingStats(): Promise<{
  total: number
  withEmbedding: number
  missing: number
  coveragePercent: number
}> {
  // Get total completed bookmarks (only count completed for embedding stats)
  const { count: totalCompleted, error: totalError } = await supabaseAdmin
    .from('bookmarks')
    .select('*', { count: 'exact', head: true })
    .eq('processing_status', 'completed')

  if (totalError) {
    console.error('[admin/stats] Error fetching completed count:', totalError)
    return { total: 0, withEmbedding: 0, missing: 0, coveragePercent: 0 }
  }

  // Get bookmarks with embeddings (non-null embedding column)
  const { count: withEmbedding, error: embeddingError } = await supabaseAdmin
    .from('bookmarks')
    .select('*', { count: 'exact', head: true })
    .eq('processing_status', 'completed')
    .not('embedding', 'is', null)

  if (embeddingError) {
    console.error('[admin/stats] Error fetching embedding count:', embeddingError)
    return { total: totalCompleted || 0, withEmbedding: 0, missing: totalCompleted || 0, coveragePercent: 0 }
  }

  const total = totalCompleted || 0
  const embedded = withEmbedding || 0
  const missing = total - embedded
  const coveragePercent = total > 0
    ? Math.round((embedded / total) * 1000) / 10 // Round to 1 decimal
    : 0

  return {
    total,
    withEmbedding: embedded,
    missing,
    coveragePercent,
  }
}

/**
 * Get error statistics for the last 24 hours
 */
async function getErrorStats24h(): Promise<{
  total24h: number
  byType: Record<string, number>
}> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Get failed bookmarks in last 24h with their error messages
  const { data: failedBookmarks, error } = await supabaseAdmin
    .from('bookmarks')
    .select('processing_error')
    .eq('processing_status', 'failed')
    .gte('updated_at', twentyFourHoursAgo)

  if (error) {
    console.error('[admin/stats] Error fetching error stats:', error)
    return { total24h: 0, byType: {} }
  }

  const byType: Record<string, number> = {}

  // Categorize errors by type
  for (const bookmark of failedBookmarks || []) {
    const errorMessage = bookmark.processing_error || 'Unknown error'
    const errorType = categorizeError(errorMessage)
    byType[errorType] = (byType[errorType] || 0) + 1
  }

  return {
    total24h: failedBookmarks?.length || 0,
    byType,
  }
}

/**
 * Categorize an error message into a high-level error type
 */
function categorizeError(errorMessage: string): string {
  const lowerMessage = errorMessage.toLowerCase()

  if (lowerMessage.includes('extraction') || lowerMessage.includes('extract')) {
    return 'Extraction Failed'
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'Processing Timeout'
  }
  if (lowerMessage.includes('network') || lowerMessage.includes('connection') || lowerMessage.includes('econnrefused')) {
    return 'Network Error'
  }
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
    return 'Rate Limited'
  }
  if (lowerMessage.includes('invalid url') || lowerMessage.includes('validation')) {
    return 'Validation Error'
  }
  if (lowerMessage.includes('ai') || lowerMessage.includes('model') || lowerMessage.includes('gemini')) {
    return 'AI Processing Error'
  }
  if (lowerMessage.includes('database') || lowerMessage.includes('postgres') || lowerMessage.includes('supabase')) {
    return 'Database Error'
  }

  return 'Other'
}

/**
 * Get source distribution with counts and percentages
 */
async function getSourceDistribution(): Promise<Array<{
  source: ContentSource
  count: number
  percentage: number
}>> {
  const sources: ContentSource[] = ['twitter', 'reddit', 'youtube', 'linkedin', 'instagram', 'web']

  // Get total count first
  const { count: total, error: totalError } = await supabaseAdmin
    .from('bookmarks')
    .select('*', { count: 'exact', head: true })

  if (totalError) {
    console.error('[admin/stats] Error fetching total for distribution:', totalError)
    return sources.map(source => ({ source, count: 0, percentage: 0 }))
  }

  const totalCount = total || 0

  // Get count for each source
  const results = await Promise.all(
    sources.map(async (source) => {
      const { count, error } = await supabaseAdmin
        .from('bookmarks')
        .select('*', { count: 'exact', head: true })
        .eq('source', source)

      if (error) {
        console.error(`[admin/stats] Error fetching ${source} count:`, error)
        return { source, count: 0 }
      }

      return { source, count: count || 0 }
    })
  )

  // Calculate percentages and sort by count descending
  return results
    .map(({ source, count }) => ({
      source,
      count,
      percentage: totalCount > 0
        ? Math.round((count / totalCount) * 1000) / 10 // Round to 1 decimal
        : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Get extraction error statistics.
 * Tracks bookmarks where extraction failed but processing continued with fallback.
 */
async function getExtractionErrorStats(): Promise<{
  total: number
  parallelAiFailed: number
  ogMetadataFailed: number
  completeFailure: number
  completedWithErrors: number
}> {
  // Get bookmarks with extraction errors
  const { data: bookmarksWithErrors, error } = await supabaseAdmin
    .from('bookmarks')
    .select('extraction_error, processing_status')
    .not('extraction_error', 'is', null)

  if (error) {
    console.error('[admin/stats] Error fetching extraction error stats:', error)
    return {
      total: 0,
      parallelAiFailed: 0,
      ogMetadataFailed: 0,
      completeFailure: 0,
      completedWithErrors: 0,
    }
  }

  const bookmarks = bookmarksWithErrors || []
  const total = bookmarks.length

  // Count by error type
  let parallelAiFailed = 0
  let ogMetadataFailed = 0
  let completeFailure = 0
  let completedWithErrors = 0

  for (const bookmark of bookmarks) {
    const errorMessage = (bookmark.extraction_error || '').toLowerCase()

    if (errorMessage.includes('complete extraction failure')) {
      completeFailure++
    } else if (errorMessage.includes('parallel ai extraction failed')) {
      parallelAiFailed++
    } else if (errorMessage.includes('og metadata')) {
      ogMetadataFailed++
    }

    // Count completed bookmarks with extraction errors
    if (bookmark.processing_status === 'completed') {
      completedWithErrors++
    }
  }

  return {
    total,
    parallelAiFailed,
    ogMetadataFailed,
    completeFailure,
    completedWithErrors,
  }
}
