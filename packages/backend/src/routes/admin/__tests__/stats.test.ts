/**
 * Comprehensive tests for admin stats API routes
 *
 * Coverage:
 * 1. GET /api/admin/stats - Admin statistics endpoint
 *    - Overview metrics (total, success rate, embedding coverage, error rate)
 *    - Processing status breakdown
 *    - Embedding statistics
 *    - Error statistics (24h)
 *    - Source distribution
 *    - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Context } from 'hono'
import { adminStatsRoutes, type AdminStatsResponse } from '../stats'

// Create a sophisticated mock that tracks query chains
const createMockSupabase = () => {
  // Store configured responses for different query types
  const queryResponses: Map<string, { count?: number | null; data?: unknown[]; error?: { message: string } | null }> = new Map()
  let callCount = 0

  const createChainableQuery = () => {
    let queryType = 'unknown'
    let conditions: string[] = []

    const chain: Record<string, unknown> = {}

    // Chainable methods that track conditions
    chain.select = vi.fn().mockImplementation(() => chain)

    chain.eq = vi.fn().mockImplementation((field: string, value: string) => {
      conditions.push(`${field}=${value}`)
      if (field === 'processing_status') {
        queryType = `processing_${value}`
      } else if (field === 'source') {
        queryType = `source_${value}`
      }
      return chain
    })

    chain.not = vi.fn().mockImplementation((field: string, operator: string, value: unknown) => {
      conditions.push(`${field}!${operator}${value}`)
      if (field === 'embedding' && operator === 'is' && value === null) {
        queryType = 'embedding_with'
      }
      if (field === 'extraction_error' && operator === 'is' && value === null) {
        queryType = 'extraction_errors'
      }
      return chain
    })

    chain.gte = vi.fn().mockImplementation((field: string, value: string) => {
      conditions.push(`${field}>=${value}`)
      if (field === 'updated_at') {
        queryType = 'error_logs_24h'
      }
      return chain
    })

    // Make the chain thenable (acts like a Promise)
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason?: unknown) => unknown) => {
      callCount++

      // Determine response based on query type
      let response = queryResponses.get(queryType)

      // If no specific response, try 'default' or return empty
      if (!response) {
        response = queryResponses.get('default') || { count: 0, data: [], error: null }
      }

      return Promise.resolve(response).then(resolve, reject)
    }

    return chain
  }

  return {
    from: vi.fn().mockImplementation(() => createChainableQuery()),
    setResponse: (queryType: string, response: { count?: number | null; data?: unknown[]; error?: { message: string } | null }) => {
      queryResponses.set(queryType, response)
    },
    setDefaultResponse: (response: { count?: number | null; data?: unknown[]; error?: { message: string } | null }) => {
      queryResponses.set('default', response)
    },
    getCallCount: () => callCount,
    reset: () => {
      queryResponses.clear()
      callCount = 0
    },
  }
}

// Type for mock supabase
type MockSupabase = ReturnType<typeof createMockSupabase>

// Mock Supabase
let mockSupabase: MockSupabase
vi.mock('../../../config/supabase', () => ({
  supabaseAdmin: {
    get from() {
      return (...args: unknown[]) => mockSupabase.from(...args)
    },
  },
}))

// Test data factories
const createTestUser = (id = 'admin-1', email = 'admin@test.com') => ({
  id,
  email,
  role: 'admin',
  aud: 'authenticated',
})

// Mock Hono context factory
const createMockContext = (options: {
  method?: string
  path?: string
  query?: Record<string, string>
  user?: { id: string; email: string; role?: string }
} = {}): Context => {
  const {
    method = 'GET',
    path = '/',
    query = {},
    user = createTestUser(),
  } = options

  const jsonResponses: Array<{ data: unknown; status?: number }> = []

  const context = {
    req: {
      method,
      path,
      query: (key?: string) => (key ? query[key] : query),
      param: (key: string) => (query as Record<string, string>)[key],
    },
    get: vi.fn((key: string) => (key === 'user' ? user : undefined)),
    json: vi.fn((data: unknown, status?: number) => {
      jsonResponses.push({ data, status })
      return { data, status }
    }),
  } as unknown as Context

  // Store responses for testing
  ;(context as Context & { _jsonResponses: Array<{ data: unknown; status?: number }> })._jsonResponses = jsonResponses

  return context
}

describe('Admin Stats Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    // Set default response for all queries
    mockSupabase.setDefaultResponse({ count: 0, data: [], error: null })
    // Set default extraction errors response
    mockSupabase.setResponse('extraction_errors', { data: [], error: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET / - Admin Statistics', () => {
    describe('Response Structure', () => {
      it('should return stats with correct structure', async () => {
        // Set up mock responses
        mockSupabase.setDefaultResponse({ count: 100, error: null })
        mockSupabase.setResponse('processing_pending', { count: 10, error: null })
        mockSupabase.setResponse('processing_processing', { count: 5, error: null })
        mockSupabase.setResponse('processing_completed', { count: 80, error: null })
        mockSupabase.setResponse('processing_failed', { count: 5, error: null })
        mockSupabase.setResponse('embedding_with', { count: 75, error: null })
        mockSupabase.setResponse('error_logs_24h', { data: [], error: null })
        mockSupabase.setResponse('extraction_errors', { data: [], error: null })
        mockSupabase.setResponse('source_twitter', { count: 30, error: null })
        mockSupabase.setResponse('source_reddit', { count: 20, error: null })
        mockSupabase.setResponse('source_youtube', { count: 15, error: null })
        mockSupabase.setResponse('source_linkedin', { count: 10, error: null })
        mockSupabase.setResponse('source_instagram', { count: 15, error: null })
        mockSupabase.setResponse('source_web', { count: 10, error: null })

        const handler = adminStatsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext()
        await handler?.(ctx, async () => {})

        const response = (ctx as Context & { _jsonResponses: Array<{ data: unknown; status?: number }> })._jsonResponses[0]

        // Verify structure (actual frontend response structure)
        expect(response.data).toHaveProperty('totalBookmarks')
        expect(response.data).toHaveProperty('successRate')
        expect(response.data).toHaveProperty('embeddingsCoverage')
        expect(response.data).toHaveProperty('errorRate')
        expect(response.data).toHaveProperty('processingStats')
        expect(response.data).toHaveProperty('sourceDistribution')
        expect(response.data).toHaveProperty('extractionErrors')
      })

      it('should return processing breakdown with all statuses', async () => {
        mockSupabase.setDefaultResponse({ count: 100, error: null })
        mockSupabase.setResponse('processing_pending', { count: 10, error: null })
        mockSupabase.setResponse('processing_processing', { count: 5, error: null })
        mockSupabase.setResponse('processing_completed', { count: 80, error: null })
        mockSupabase.setResponse('processing_failed', { count: 5, error: null })
        mockSupabase.setResponse('extraction_errors', { data: [], error: null })

        const handler = adminStatsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext()
        await handler?.(ctx, async () => {})

        const response = (ctx as Context & { _jsonResponses: Array<{ data: unknown; status?: number }> })._jsonResponses[0]
        const data = response.data as { processingStats: Record<string, number> }

        expect(data.processingStats).toHaveProperty('pending')
        expect(data.processingStats).toHaveProperty('processing')
        expect(data.processingStats).toHaveProperty('completed24h')
        expect(data.processingStats).toHaveProperty('failed24h')
      })

      it('should return embeddings count and coverage', async () => {
        mockSupabase.setDefaultResponse({ count: 100, error: null })
        mockSupabase.setResponse('extraction_errors', { data: [], error: null })

        const handler = adminStatsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext()
        await handler?.(ctx, async () => {})

        const response = (ctx as Context & { _jsonResponses: Array<{ data: unknown; status?: number }> })._jsonResponses[0]
        const data = response.data as { embeddingsCount: number; embeddingsCoverage: number }

        expect(data).toHaveProperty('embeddingsCount')
        expect(data).toHaveProperty('embeddingsCoverage')
      })

      it('should return extraction errors structure', async () => {
        mockSupabase.setDefaultResponse({ count: 100, error: null })
        mockSupabase.setResponse('error_logs_24h', { data: [], error: null })
        mockSupabase.setResponse('extraction_errors', { data: [], error: null })

        const handler = adminStatsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext()
        await handler?.(ctx, async () => {})

        const response = (ctx as Context & { _jsonResponses: Array<{ data: unknown; status?: number }> })._jsonResponses[0]
        const data = response.data as { extractionErrors: Record<string, number>; processingStats: Record<string, number> }

        expect(data.extractionErrors).toHaveProperty('total')
        expect(data.extractionErrors).toHaveProperty('parallelAiFailed')
        expect(data.extractionErrors).toHaveProperty('ogMetadataFailed')
        expect(data.extractionErrors).toHaveProperty('completeFailure')
        expect(data.extractionErrors).toHaveProperty('completedWithErrors')
        expect(data.processingStats).toHaveProperty('failed24h')
      })

      it('should return source distribution as array', async () => {
        mockSupabase.setDefaultResponse({ count: 100, error: null })
        mockSupabase.setResponse('extraction_errors', { data: [], error: null })

        const handler = adminStatsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext()
        await handler?.(ctx, async () => {})

        const response = (ctx as Context & { _jsonResponses: Array<{ data: unknown; status?: number }> })._jsonResponses[0]
        const data = response.data as { sourceDistribution: Array<{ source: string }> }

        expect(Array.isArray(data.sourceDistribution)).toBe(true)
        expect(data.sourceDistribution.length).toBe(6) // 6 sources
      })
    })

    describe('Calculations', () => {
      it('should return 0 success rate when no bookmarks', async () => {
        mockSupabase.setDefaultResponse({ count: 0, error: null })
        mockSupabase.setResponse('extraction_errors', { data: [], error: null })

        const handler = adminStatsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext()
        await handler?.(ctx, async () => {})

        const response = (ctx as Context & { _jsonResponses: Array<{ data: unknown; status?: number }> })._jsonResponses[0]
        const data = response.data as { totalBookmarks: number; successRate: number; errorRate: number }

        expect(data.totalBookmarks).toBe(0)
        expect(data.successRate).toBe(0)
        expect(data.errorRate).toBe(0)
      })

      it('should return 0 embedding coverage when no completed bookmarks', async () => {
        mockSupabase.setDefaultResponse({ count: 0, error: null })
        mockSupabase.setResponse('extraction_errors', { data: [], error: null })

        const handler = adminStatsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext()
        await handler?.(ctx, async () => {})

        const response = (ctx as Context & { _jsonResponses: Array<{ data: unknown; status?: number }> })._jsonResponses[0]
        const data = response.data as { embeddingsCount: number; embeddingsCoverage: number }

        expect(data.embeddingsCount).toBe(0)
        expect(data.embeddingsCoverage).toBe(0)
      })

      it('should return zero extraction errors when none exist', async () => {
        mockSupabase.setDefaultResponse({ count: 100, error: null })
        mockSupabase.setResponse('error_logs_24h', { data: [], error: null })
        mockSupabase.setResponse('extraction_errors', { data: [], error: null })

        const handler = adminStatsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext()
        await handler?.(ctx, async () => {})

        const response = (ctx as Context & { _jsonResponses: Array<{ data: unknown; status?: number }> })._jsonResponses[0]
        const data = response.data as { extractionErrors: { total: number } }

        expect(data.extractionErrors.total).toBe(0)
      })
    })

    describe('Extraction Errors Stats', () => {
      it('should count parallel AI extraction failures', async () => {
        mockSupabase.setDefaultResponse({ count: 10, error: null })
        mockSupabase.setResponse('error_logs_24h', { data: [], error: null })
        mockSupabase.setResponse('extraction_errors', {
          data: [
            { extraction_error: 'Parallel AI extraction failed: Timeout', processing_status: 'completed' },
            { extraction_error: 'Parallel AI extraction failed: Service down', processing_status: 'failed' },
          ],
          error: null,
        })

        const handler = adminStatsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext()
        await handler?.(ctx, async () => {})

        const response = (ctx as Context & { _jsonResponses: Array<{ data: unknown; status?: number }> })._jsonResponses[0]
        const data = response.data as { extractionErrors: { total: number; parallelAiFailed: number; completedWithErrors: number } }

        expect(data.extractionErrors.total).toBe(2)
        expect(data.extractionErrors.parallelAiFailed).toBe(2)
        expect(data.extractionErrors.completedWithErrors).toBe(1)
      })

      it('should count OG metadata extraction failures', async () => {
        mockSupabase.setDefaultResponse({ count: 10, error: null })
        mockSupabase.setResponse('error_logs_24h', { data: [], error: null })
        mockSupabase.setResponse('extraction_errors', {
          data: [
            { extraction_error: 'OG metadata extraction failed: 403', processing_status: 'completed' },
            { extraction_error: 'OG metadata failed: timeout', processing_status: 'completed' },
          ],
          error: null,
        })

        const handler = adminStatsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext()
        await handler?.(ctx, async () => {})

        const response = (ctx as Context & { _jsonResponses: Array<{ data: unknown; status?: number }> })._jsonResponses[0]
        const data = response.data as { extractionErrors: { ogMetadataFailed: number } }

        expect(data.extractionErrors.ogMetadataFailed).toBe(2)
      })

      it('should count complete extraction failures', async () => {
        mockSupabase.setDefaultResponse({ count: 10, error: null })
        mockSupabase.setResponse('error_logs_24h', { data: [], error: null })
        mockSupabase.setResponse('extraction_errors', {
          data: [
            { extraction_error: 'Complete extraction failure: Primary failed, OG failed', processing_status: 'failed' },
            { extraction_error: 'Complete extraction failure: Both methods unavailable', processing_status: 'failed' },
          ],
          error: null,
        })

        const handler = adminStatsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext()
        await handler?.(ctx, async () => {})

        const response = (ctx as Context & { _jsonResponses: Array<{ data: unknown; status?: number }> })._jsonResponses[0]
        const data = response.data as { extractionErrors: { completeFailure: number } }

        expect(data.extractionErrors.completeFailure).toBe(2)
      })

      it('should count completed bookmarks with extraction errors', async () => {
        mockSupabase.setDefaultResponse({ count: 10, error: null })
        mockSupabase.setResponse('error_logs_24h', { data: [], error: null })
        mockSupabase.setResponse('extraction_errors', {
          data: [
            { extraction_error: 'Parallel AI extraction failed: Timeout', processing_status: 'completed' },
            { extraction_error: 'Parallel AI extraction failed: Error', processing_status: 'completed' },
            { extraction_error: 'Complete extraction failure: All failed', processing_status: 'failed' },
          ],
          error: null,
        })

        const handler = adminStatsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext()
        await handler?.(ctx, async () => {})

        const response = (ctx as Context & { _jsonResponses: Array<{ data: unknown; status?: number }> })._jsonResponses[0]
        const data = response.data as { extractionErrors: { total: number; completedWithErrors: number } }

        expect(data.extractionErrors.total).toBe(3)
        expect(data.extractionErrors.completedWithErrors).toBe(2)
      })
    })

    describe('Source Distribution', () => {
      it('should include all 6 content sources (capitalized)', async () => {
        mockSupabase.setDefaultResponse({ count: 10, error: null })
        mockSupabase.setResponse('extraction_errors', { data: [], error: null })

        const handler = adminStatsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext()
        await handler?.(ctx, async () => {})

        const response = (ctx as Context & { _jsonResponses: Array<{ data: unknown; status?: number }> })._jsonResponses[0]
        const data = response.data as { sourceDistribution: Array<{ source: string }> }

        const sources = data.sourceDistribution.map((s) => s.source)
        // Frontend response capitalizes first letter
        expect(sources).toContain('Twitter')
        expect(sources).toContain('Reddit')
        expect(sources).toContain('Youtube')
        expect(sources).toContain('Linkedin')
        expect(sources).toContain('Instagram')
        expect(sources).toContain('Web')
      })

      it('should return source items with correct properties', async () => {
        mockSupabase.setDefaultResponse({ count: 10, error: null })
        mockSupabase.setResponse('extraction_errors', { data: [], error: null })

        const handler = adminStatsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext()
        await handler?.(ctx, async () => {})

        const response = (ctx as Context & { _jsonResponses: Array<{ data: unknown; status?: number }> })._jsonResponses[0]
        const data = response.data as { sourceDistribution: Array<{ source: string; count: number; percentage: number }> }

        for (const source of data.sourceDistribution) {
          expect(source).toHaveProperty('source')
          expect(source).toHaveProperty('count')
          expect(source).toHaveProperty('percentage')
          expect(typeof source.source).toBe('string')
          expect(typeof source.count).toBe('number')
          expect(typeof source.percentage).toBe('number')
        }
      })
    })

    describe('Error Handling', () => {
      it('should return 500 on unexpected exception', async () => {
        mockSupabase.from = vi.fn().mockImplementation(() => {
          throw new Error('Unexpected database error')
        })

        const handler = adminStatsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext()
        await handler?.(ctx, async () => {})

        const response = (ctx as Context & { _jsonResponses: Array<{ data: { error: string }; status?: number }> })._jsonResponses[0]

        expect(response.status).toBe(500)
        expect(response.data.error).toBe('Internal server error')
      })
    })
  })
})
