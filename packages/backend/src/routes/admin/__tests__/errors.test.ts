/**
 * Comprehensive tests for admin errors API routes
 *
 * Coverage:
 * 1. GET / - List error logs (pagination, filtering, search, sorting)
 * 2. GET /:id - Get single error details
 * 3. POST /:id/resolve - Mark error as resolved
 * 4. Error categorization (severity and type)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Context } from 'hono'
import {
  adminErrorsRoutes,
  type AdminErrorLog,
  type AdminErrorsResponse,
  type ErrorSeverity,
  type ErrorType,
} from '../errors'
import type { ProcessingStatus, ContentSource, Category, Tag } from '@plukd/shared'

// Mock Supabase admin client - creates chainable mock
const createMockSupabaseChain = () => {
  const chain: Record<string, any> = {}

  // Chainable methods - return the chain object
  const chainableMethods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'in', 'is', 'not',
    'gt', 'lt', 'gte', 'lte',
    'like', 'ilike', 'contains', 'overlaps', 'or',
    'order',
  ]

  for (const method of chainableMethods) {
    chain[method] = vi.fn().mockImplementation(() => chain)
  }

  // range() - terminal, returns a thenable
  chain.range = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 })

  // Terminal methods - return promises directly
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })

  // from() method - returns the chain
  chain.from = vi.fn().mockImplementation(() => chain)

  // rpc() method - returns promise
  chain.rpc = vi.fn().mockResolvedValue({ data: null, error: null })

  return chain
}

// Mock Supabase
let mockSupabase: ReturnType<typeof createMockSupabaseChain>
vi.mock('../../../config/supabase', () => ({
  supabaseAdmin: {
    get from() {
      return (...args: unknown[]) => mockSupabase.from(...args)
    },
  },
}))

// Test data factories
const createTestUser = (id = 'user-1') => ({
  id,
  email: `${id}@test.com`,
  name: `Test User ${id}`,
})

const createTestBookmark = (
  id: string,
  userId: string,
  overrides: Record<string, unknown> = {}
) => ({
  id,
  user_id: userId,
  url: 'https://example.com/article',
  source: 'web' as ContentSource,
  title: 'Test Article',
  author: null,
  author_url: null,
  content: null,
  media_urls: null,
  published_at: null,
  blurb: 'Test blurb',
  summary: 'Test summary',
  category: 'news' as Category,
  tags: ['tutorial'] as Tag[],
  processing_status: 'failed' as ProcessingStatus,
  processing_error: 'Extraction failed: Unable to fetch content',
  raw_metadata: null,
  is_archived: false,
  content_type: null,
  extracted_resources: null,
  resource_layout_hint: null,
  key_takeaways: null,
  search_vector: null,
  embedding: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

// Mock Hono context factory
const createMockContext = (options: {
  method?: string
  path?: string
  query?: Record<string, string>
  body?: unknown
  user?: { id: string; email: string }
  params?: Record<string, string>
} = {}): Context => {
  const {
    method = 'GET',
    path = '/',
    query = {},
    body = {},
    user = createTestUser(),
    params = {},
  } = options

  const jsonResponses: Array<{ data: unknown; status?: number }> = []

  const context = {
    req: {
      method,
      path,
      query: (key?: string) => (key ? query[key] : query),
      json: vi.fn().mockResolvedValue(body),
      param: (key: string) => params[key],
    },
    get: vi.fn((key: string) => (key === 'user' ? user : undefined)),
    json: vi.fn((data: unknown, status?: number) => {
      jsonResponses.push({ data, status })
      return { data, status }
    }),
    text: vi.fn(),
  } as unknown as Context

  // Store responses for testing
  ;(context as any)._jsonResponses = jsonResponses

  return context
}

describe('Admin Errors Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabaseChain()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================
  // GET / - List Error Logs
  // ============================================================
  describe('GET / - List Error Logs', () => {
    describe('Basic Functionality', () => {
      it('should return error logs with default pagination', async () => {
        const bookmarks = Array.from({ length: 5 }, (_, i) =>
          createTestBookmark(`bookmark-${i}`, `user-${i}`, {
            processing_error: 'Extraction failed',
          })
        )

        // Create a fully chainable mock that returns itself for all operations
        const bookmarksChain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({
            data: bookmarks,
            error: null,
            count: 5,
          }),
        }

        // Create users chain
        const usersChain = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: bookmarks.map((b) => ({ id: b.user_id, email: `${b.user_id}@test.com` })),
            error: null,
          }),
        }

        // Create stats chain that returns count directly from gte
        const statsChain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockResolvedValue({ count: 10, error: null }),
        }

        let bookmarkQueryCount = 0
        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'users') return usersChain
          bookmarkQueryCount++
          // First call is main query, subsequent is stats
          if (bookmarkQueryCount === 1) return bookmarksChain
          return statsChain
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({ query: {} })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data).toMatchObject({
          errors: expect.arrayContaining([
            expect.objectContaining({
              bookmarkId: expect.any(String),
              severity: expect.any(String),
              type: expect.any(String),
              message: expect.any(String),
            }),
          ]),
          pagination: {
            page: 1,
            limit: 50,
            total: 5,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          stats: expect.objectContaining({
            total24h: expect.any(Number),
            critical: expect.any(Number),
            warnings: expect.any(Number),
          }),
        })
      })

      it('should apply pagination correctly', async () => {
        mockSupabase.range.mockResolvedValue({
          data: [],
          error: null,
          count: 100,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({
          query: { page: '2', limit: '25' },
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data.pagination).toMatchObject({
          page: 2,
          limit: 25,
          total: 100,
          totalPages: 4,
          hasNextPage: true,
          hasPreviousPage: true,
        })
        expect(mockSupabase.range).toHaveBeenCalledWith(25, 49)
      })
    })

    describe('Filtering', () => {
      it('should filter by time range (24h)', async () => {
        mockSupabase.range.mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({
          query: { timeRange: '24h' },
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.gte).toHaveBeenCalledWith(
          'updated_at',
          expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
        )
      })

      it('should filter by time range (1h)', async () => {
        mockSupabase.range.mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({
          query: { timeRange: '1h' },
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.gte).toHaveBeenCalled()
      })

      it('should filter by time range (7d)', async () => {
        mockSupabase.range.mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({
          query: { timeRange: '7d' },
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.gte).toHaveBeenCalled()
      })

      it('should filter by time range (30d)', async () => {
        mockSupabase.range.mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({
          query: { timeRange: '30d' },
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.gte).toHaveBeenCalled()
      })

      it('should not filter by time when timeRange is all (main query)', async () => {
        // Track gte calls to verify the main query doesn't have time filter
        const gteCalls: Array<{ field: string; value: string }> = []
        const originalGte = mockSupabase.gte

        mockSupabase.gte = vi.fn().mockImplementation((field: string, value: string) => {
          gteCalls.push({ field, value })
          return mockSupabase
        })

        mockSupabase.range.mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({
          query: { timeRange: 'all' },
        })
        await handler?.(ctx, async () => {})

        // With timeRange='all', the first call should NOT be for the main query filter
        // The only gte call should be for the 24h stats (which always happens)
        // So gte should be called exactly once (for stats), not twice (for filter + stats)
        expect(gteCalls.length).toBe(1) // Only the 24h stats query
      })

      it('should search in processing_error', async () => {
        mockSupabase.range.mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({
          query: { search: 'rate limit' },
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.ilike).toHaveBeenCalledWith(
          'processing_error',
          '%rate limit%'
        )
      })
    })

    describe('Sorting', () => {
      it('should sort by updated_at desc by default', async () => {
        mockSupabase.range.mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({ query: {} })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.order).toHaveBeenCalledWith('updated_at', {
          ascending: false,
        })
      })

      it('should sort by created_at asc', async () => {
        mockSupabase.range.mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({
          query: { sortBy: 'created_at', sortOrder: 'asc' },
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.order).toHaveBeenCalledWith('created_at', {
          ascending: true,
        })
      })
    })

    describe('Error Categorization', () => {
      it('should categorize extraction errors as warning', async () => {
        const bookmark = createTestBookmark('bookmark-1', 'user-1', {
          processing_error: 'Extraction failed: Unable to fetch content',
        })

        mockSupabase.range.mockResolvedValue({
          data: [bookmark],
          error: null,
          count: 1,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({ query: {} })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
        expect(response.data.errors[0].type).toBe('extraction_failed')
        expect(response.data.errors[0].severity).toBe('warning')
      })

      it('should categorize database errors as critical', async () => {
        const bookmark = createTestBookmark('bookmark-1', 'user-1', {
          processing_error: 'Database error: connection failed',
        })

        mockSupabase.range.mockResolvedValue({
          data: [bookmark],
          error: null,
          count: 1,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({ query: {} })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
        expect(response.data.errors[0].type).toBe('database_error')
        expect(response.data.errors[0].severity).toBe('critical')
      })

      it('should categorize rate limit errors as critical', async () => {
        const bookmark = createTestBookmark('bookmark-1', 'user-1', {
          processing_error: 'Rate limit exceeded (429)',
        })

        mockSupabase.range.mockResolvedValue({
          data: [bookmark],
          error: null,
          count: 1,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({ query: {} })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
        expect(response.data.errors[0].type).toBe('rate_limit')
        expect(response.data.errors[0].severity).toBe('critical')
      })

      it('should categorize AI errors correctly', async () => {
        const bookmark = createTestBookmark('bookmark-1', 'user-1', {
          processing_error: 'Gemini model not responding',
        })

        mockSupabase.range.mockResolvedValue({
          data: [bookmark],
          error: null,
          count: 1,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({ query: {} })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
        expect(response.data.errors[0].type).toBe('ai_processing')
        // AI errors with "model not responding" are critical
        expect(response.data.errors[0].severity).toBe('critical')
      })

      it('should categorize timeout errors correctly', async () => {
        const bookmark = createTestBookmark('bookmark-1', 'user-1', {
          processing_error: 'Request timed out',
        })

        mockSupabase.range.mockResolvedValue({
          data: [bookmark],
          error: null,
          count: 1,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({ query: {} })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
        expect(response.data.errors[0].type).toBe('timeout')
      })

      it('should categorize network errors correctly', async () => {
        const bookmark = createTestBookmark('bookmark-1', 'user-1', {
          processing_error: 'Network error: fetch failed',
        })

        mockSupabase.range.mockResolvedValue({
          data: [bookmark],
          error: null,
          count: 1,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({ query: {} })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
        expect(response.data.errors[0].type).toBe('network_error')
      })

      it('should categorize validation errors correctly', async () => {
        const bookmark = createTestBookmark('bookmark-1', 'user-1', {
          processing_error: 'Invalid URL format',
        })

        mockSupabase.range.mockResolvedValue({
          data: [bookmark],
          error: null,
          count: 1,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({ query: {} })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
        expect(response.data.errors[0].type).toBe('validation_error')
      })

      it('should categorize unknown errors correctly', async () => {
        const bookmark = createTestBookmark('bookmark-1', 'user-1', {
          processing_error: 'Something unexpected happened',
        })

        mockSupabase.range.mockResolvedValue({
          data: [bookmark],
          error: null,
          count: 1,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({ query: {} })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
        expect(response.data.errors[0].type).toBe('unknown')
        expect(response.data.errors[0].severity).toBe('warning')
      })

      it('should handle null processing_error', async () => {
        const bookmark = createTestBookmark('bookmark-1', 'user-1', {
          processing_error: null,
        })

        mockSupabase.range.mockResolvedValue({
          data: [bookmark],
          error: null,
          count: 1,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({ query: {} })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
        expect(response.data.errors[0].message).toBe('Unknown error')
        expect(response.data.errors[0].type).toBe('unknown')
      })
    })

    describe('Error Handling', () => {
      it('should return 400 for invalid query parameters', async () => {
        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({
          query: { page: '-1', limit: '500' },
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(400)
        expect(response.data.error).toBe('Invalid query parameters')
      })

      it('should return 500 for database error', async () => {
        mockSupabase.range.mockResolvedValue({
          data: null,
          error: { message: 'Database connection error' },
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({ query: {} })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(500)
        expect(response.data.error).toBe('Failed to fetch error logs')
      })

      it('should return empty array when no errors exist', async () => {
        mockSupabase.range.mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({ query: {} })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data.errors).toEqual([])
        expect(response.data.pagination.total).toBe(0)
      })
    })

    describe('User Email Lookup', () => {
      it('should include user email in error logs', async () => {
        const bookmark = createTestBookmark('bookmark-1', 'user-1')

        mockSupabase.range.mockResolvedValue({
          data: [bookmark],
          error: null,
          count: 1,
        })

        // Mock users query
        const usersChain = createMockSupabaseChain()
        usersChain.select.mockImplementation(() => usersChain)
        usersChain.in.mockResolvedValue({
          data: [{ id: 'user-1', email: 'test@example.com' }],
          error: null,
        })

        let callCount = 0
        mockSupabase.from.mockImplementation((table: string) => {
          callCount++
          if (table === 'users') return usersChain
          return mockSupabase
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({ query: {} })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
        expect(response.data.errors[0].userEmail).toBe('test@example.com')
      })

      it('should handle missing user gracefully', async () => {
        const bookmark = createTestBookmark('bookmark-1', 'user-1')

        mockSupabase.range.mockResolvedValue({
          data: [bookmark],
          error: null,
          count: 1,
        })

        // Mock users query returning empty
        const usersChain = createMockSupabaseChain()
        usersChain.select.mockImplementation(() => usersChain)
        usersChain.in.mockResolvedValue({
          data: [],
          error: null,
        })

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'users') return usersChain
          return mockSupabase
        })

        const handler = adminErrorsRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/'
        )?.handler

        const ctx = createMockContext({ query: {} })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
        expect(response.data.errors[0].userEmail).toBeNull()
      })
    })
  })

  // ============================================================
  // GET /:id - Get Error Details
  // ============================================================
  describe('GET /:id - Get Error Details', () => {
    it('should return error details for valid ID', async () => {
      const bookmark = createTestBookmark('00000000-0000-4000-8000-000000000001', 'user-1')

      mockSupabase.single.mockResolvedValue({
        data: bookmark,
        error: null,
      })

      // Mock user query
      const userChain = createMockSupabaseChain()
      userChain.select.mockImplementation(() => userChain)
      userChain.eq.mockImplementation(() => userChain)
      userChain.single.mockResolvedValue({
        data: { email: 'test@example.com' },
        error: null,
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') return userChain
        return mockSupabase
      })

      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'GET' && r.path === '/:id'
      )?.handler

      const ctx = createMockContext({
        params: { id: '00000000-0000-4000-8000-000000000001' },
      })
      await handler?.(ctx, async () => {})

      const response = (ctx as any)._jsonResponses[0]
      expect(response.data).toMatchObject({
        id: '00000000-0000-4000-8000-000000000001',
        bookmarkId: '00000000-0000-4000-8000-000000000001',
        message: expect.any(String),
        severity: expect.any(String),
        type: expect.any(String),
        title: 'Test Article',
        url: 'https://example.com/article',
        source: 'web',
        userEmail: 'test@example.com',
      })
    })

    it('should return 400 for invalid UUID format', async () => {
      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'GET' && r.path === '/:id'
      )?.handler

      const ctx = createMockContext({
        params: { id: 'not-a-uuid' },
      })
      await handler?.(ctx, async () => {})

      const response = (ctx as any)._jsonResponses[0]
      expect(response.status).toBe(400)
      expect(response.data.error).toBe('Invalid error ID')
    })

    it('should return 404 for non-existent error', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Row not found' },
      })

      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'GET' && r.path === '/:id'
      )?.handler

      const ctx = createMockContext({
        params: { id: '00000000-0000-4000-8000-000000000999' },
      })
      await handler?.(ctx, async () => {})

      const response = (ctx as any)._jsonResponses[0]
      expect(response.status).toBe(404)
      expect(response.data.error).toBe('Error not found')
    })

    it('should return 500 for database error', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Connection error' },
      })

      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'GET' && r.path === '/:id'
      )?.handler

      const ctx = createMockContext({
        params: { id: '00000000-0000-4000-8000-000000000001' },
      })
      await handler?.(ctx, async () => {})

      const response = (ctx as any)._jsonResponses[0]
      expect(response.status).toBe(500)
      expect(response.data.error).toBe('Failed to fetch error details')
    })
  })

  // ============================================================
  // POST /:id/resolve - Mark Error as Resolved
  // ============================================================
  describe('POST /:id/resolve - Mark Error as Resolved', () => {
    it('should resolve error by deleting failed bookmark', async () => {
      // Create a mock chain that handles delete().eq().eq() properly
      const deleteChain = createMockSupabaseChain()

      // Make delete() return an object with chainable eq() that eventually resolves
      const mockDeleteResult = {
        eq: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      }
      deleteChain.delete.mockImplementation(() => mockDeleteResult)

      mockSupabase.from.mockImplementation(() => deleteChain)

      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'POST' && r.path === '/:id/resolve'
      )?.handler

      const ctx = createMockContext({
        method: 'POST',
        params: { id: '00000000-0000-4000-8000-000000000001' },
      })
      await handler?.(ctx, async () => {})

      const response = (ctx as any)._jsonResponses[0]
      expect(response.data).toMatchObject({
        success: true,
        message: 'Error resolved',
      })
      expect(deleteChain.delete).toHaveBeenCalled()
    })

    it('should return 400 for invalid UUID format', async () => {
      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'POST' && r.path === '/:id/resolve'
      )?.handler

      const ctx = createMockContext({
        method: 'POST',
        params: { id: 'invalid-uuid' },
      })
      await handler?.(ctx, async () => {})

      const response = (ctx as any)._jsonResponses[0]
      expect(response.status).toBe(400)
      expect(response.data.error).toBe('Invalid error ID')
    })

    it('should return 500 for database error during resolve', async () => {
      // Create a mock chain that handles delete().eq().eq() and returns an error
      const deleteChain = createMockSupabaseChain()

      const mockDeleteResult = {
        eq: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
        })),
      }
      deleteChain.delete.mockImplementation(() => mockDeleteResult)

      mockSupabase.from.mockImplementation(() => deleteChain)

      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'POST' && r.path === '/:id/resolve'
      )?.handler

      const ctx = createMockContext({
        method: 'POST',
        params: { id: '00000000-0000-4000-8000-000000000001' },
      })
      await handler?.(ctx, async () => {})

      const response = (ctx as any)._jsonResponses[0]
      expect(response.status).toBe(500)
      expect(response.data.error).toBe('Failed to resolve error')
    })
  })

  // ============================================================
  // Response Structure
  // ============================================================
  describe('Response Structure', () => {
    it('should include all required fields in error log', async () => {
      const bookmark = createTestBookmark('00000000-0000-4000-8000-000000000001', 'user-1', {
        url: 'https://twitter.com/user/status/123',
        source: 'twitter',
        title: 'Twitter Thread',
        processing_error: 'Rate limit exceeded',
      })

      mockSupabase.range.mockResolvedValue({
        data: [bookmark],
        error: null,
        count: 1,
      })

      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'GET' && r.path === '/'
      )?.handler

      const ctx = createMockContext({ query: {} })
      await handler?.(ctx, async () => {})

      const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
      const errorLog = response.data.errors[0]

      expect(errorLog).toHaveProperty('id')
      expect(errorLog).toHaveProperty('bookmarkId')
      expect(errorLog).toHaveProperty('severity')
      expect(errorLog).toHaveProperty('type')
      expect(errorLog).toHaveProperty('message')
      expect(errorLog).toHaveProperty('title')
      expect(errorLog).toHaveProperty('url')
      expect(errorLog).toHaveProperty('source')
      expect(errorLog).toHaveProperty('userId')
      expect(errorLog).toHaveProperty('userEmail')
      expect(errorLog).toHaveProperty('retryCount')
      expect(errorLog).toHaveProperty('createdAt')
      expect(errorLog).toHaveProperty('updatedAt')
    })

    it('should include stats in response', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      })

      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'GET' && r.path === '/'
      )?.handler

      const ctx = createMockContext({ query: {} })
      await handler?.(ctx, async () => {})

      const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }

      expect(response.data.stats).toHaveProperty('total24h')
      expect(response.data.stats).toHaveProperty('critical')
      expect(response.data.stats).toHaveProperty('warnings')
      expect(response.data.stats).toHaveProperty('extractionErrors')
    })
  })

  // ============================================================
  // Extraction Error Tracking
  // ============================================================
  describe('Extraction Error Tracking', () => {
    it('should include extractionError field in error logs', async () => {
      const bookmark = createTestBookmark('bookmark-1', 'user-1', {
        processing_error: 'AI processing failed',
        extraction_error: 'Parallel AI extraction failed: Gopher API unavailable',
      })

      mockSupabase.range.mockResolvedValue({
        data: [bookmark],
        error: null,
        count: 1,
      })

      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'GET' && r.path === '/'
      )?.handler

      const ctx = createMockContext({ query: {} })
      await handler?.(ctx, async () => {})

      const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
      expect(response.data.errors[0]).toHaveProperty('extractionError')
      expect(response.data.errors[0].extractionError).toBe('Parallel AI extraction failed: Gopher API unavailable')
    })

    it('should handle null extractionError', async () => {
      const bookmark = createTestBookmark('bookmark-1', 'user-1', {
        processing_error: 'AI processing failed',
        extraction_error: null,
      })

      mockSupabase.range.mockResolvedValue({
        data: [bookmark],
        error: null,
        count: 1,
      })

      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'GET' && r.path === '/'
      )?.handler

      const ctx = createMockContext({ query: {} })
      await handler?.(ctx, async () => {})

      const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
      expect(response.data.errors[0].extractionError).toBeNull()
    })

    it('should categorize parallel_ai_extraction type correctly', async () => {
      const bookmark = createTestBookmark('bookmark-1', 'user-1', {
        processing_error: 'Processing failed',
        extraction_error: 'Parallel AI extraction failed: Timeout',
      })

      mockSupabase.range.mockResolvedValue({
        data: [bookmark],
        error: null,
        count: 1,
      })

      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'GET' && r.path === '/'
      )?.handler

      const ctx = createMockContext({ query: {} })
      await handler?.(ctx, async () => {})

      const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
      expect(response.data.errors[0].type).toBe('parallel_ai_extraction')
    })

    it('should categorize og_metadata_extraction type correctly', async () => {
      const bookmark = createTestBookmark('bookmark-1', 'user-1', {
        processing_error: 'Processing failed',
        extraction_error: 'OG metadata extraction failed: Network error',
      })

      mockSupabase.range.mockResolvedValue({
        data: [bookmark],
        error: null,
        count: 1,
      })

      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'GET' && r.path === '/'
      )?.handler

      const ctx = createMockContext({ query: {} })
      await handler?.(ctx, async () => {})

      const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
      expect(response.data.errors[0].type).toBe('og_metadata_extraction')
    })

    it('should categorize complete_extraction_failure type correctly', async () => {
      const bookmark = createTestBookmark('bookmark-1', 'user-1', {
        processing_error: 'Processing failed',
        extraction_error: 'Complete extraction failure: Primary extraction failed (Timeout), OG metadata failed (403)',
      })

      mockSupabase.range.mockResolvedValue({
        data: [bookmark],
        error: null,
        count: 1,
      })

      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'GET' && r.path === '/'
      )?.handler

      const ctx = createMockContext({ query: {} })
      await handler?.(ctx, async () => {})

      const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
      expect(response.data.errors[0].type).toBe('complete_extraction_failure')
    })

    it('should filter by extractionErrorsOnly', async () => {
      const bookmarksChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      }

      mockSupabase.from.mockImplementation(() => bookmarksChain)

      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'GET' && r.path === '/'
      )?.handler

      const ctx = createMockContext({
        query: { extractionErrorsOnly: 'true' },
      })
      await handler?.(ctx, async () => {})

      // Verify the not() filter was applied for extraction_error
      expect(bookmarksChain.not).toHaveBeenCalledWith('extraction_error', 'is', null)
    })

    it('should count extraction errors in stats', async () => {
      const bookmarks = [
        createTestBookmark('bookmark-1', 'user-1', {
          processing_error: 'AI failed',
          extraction_error: 'Parallel AI extraction failed: Timeout',
        }),
        createTestBookmark('bookmark-2', 'user-2', {
          processing_error: 'AI failed',
          extraction_error: null,
        }),
        createTestBookmark('bookmark-3', 'user-3', {
          processing_error: 'AI failed',
          extraction_error: 'Complete extraction failure: Both failed',
        }),
      ]

      mockSupabase.range.mockResolvedValue({
        data: bookmarks,
        error: null,
        count: 3,
      })

      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'GET' && r.path === '/'
      )?.handler

      const ctx = createMockContext({ query: {} })
      await handler?.(ctx, async () => {})

      const response = (ctx as any)._jsonResponses[0] as { data: AdminErrorsResponse }
      expect(response.data.stats.extractionErrors).toBe(2) // Two bookmarks have extraction errors
    })

    it('should include extractionError in GET /:id response', async () => {
      const bookmark = createTestBookmark('00000000-0000-4000-8000-000000000001', 'user-1', {
        processing_error: 'AI failed',
        extraction_error: 'Parallel AI extraction failed: Service unavailable',
      })

      mockSupabase.single.mockResolvedValue({
        data: bookmark,
        error: null,
      })

      const userChain = createMockSupabaseChain()
      userChain.select.mockImplementation(() => userChain)
      userChain.eq.mockImplementation(() => userChain)
      userChain.single.mockResolvedValue({
        data: { email: 'test@example.com' },
        error: null,
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') return userChain
        return mockSupabase
      })

      const handler = adminErrorsRoutes.routes.find(
        (r) => r.method === 'GET' && r.path === '/:id'
      )?.handler

      const ctx = createMockContext({
        params: { id: '00000000-0000-4000-8000-000000000001' },
      })
      await handler?.(ctx, async () => {})

      const response = (ctx as any)._jsonResponses[0]
      expect(response.data.extractionError).toBe('Parallel AI extraction failed: Service unavailable')
    })
  })
})
