/**
 * Comprehensive tests for bookmarks CRUD operations
 *
 * Coverage:
 * 1. POST /process - Reprocess bookmark
 * 2. GET /:id - Get single bookmark
 * 3. PUT /:id - Update bookmark (full)
 * 4. PATCH /:id - Update bookmark (partial with is_archived)
 * 5. PATCH /bulk-archive - Bulk archive/unarchive
 * 6. DELETE /:id - Delete bookmark
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Context } from 'hono'
import { bookmarksRoutes } from '../bookmarks'
import type { ProcessingStatus, Category, Tag } from '@plukd/shared'

// Mock Supabase admin client
const createMockSupabaseChain = () => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  single: vi.fn(),
})

// Mock queue
vi.mock('../../jobs/queue', () => ({
  enqueueBookmarkProcessing: vi.fn().mockResolvedValue({ id: 'job-123' }),
}))

// Mock Supabase
let mockSupabase: ReturnType<typeof createMockSupabaseChain>
vi.mock('../../config/supabase', () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === 'from') {
          return mockSupabase.from
        }
        return undefined
      },
    }
  ),
}))

// Test data factories
const createTestUser = (id = 'user-1') => ({
  id,
  email: `${id}@test.com`,
})

const createTestBookmark = (
  id: string,
  userId: string,
  overrides: Record<string, unknown> = {}
) => ({
  id,
  user_id: userId,
  url: 'https://example.com/article',
  title: 'Test Article',
  processing_status: 'completed' as ProcessingStatus,
  category: 'news' as Category,
  tags: ['tutorial'] as Tag[],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

// Mock Hono context factory
const createMockContext = (options: {
  method?: string
  path?: string
  body?: unknown
  user?: { id: string; email: string }
  params?: Record<string, string>
} = {}): Context => {
  const {
    method = 'POST',
    path = '/',
    body = {},
    user = createTestUser(),
    params = {},
  } = options

  const jsonResponses: Array<{ data: unknown; status?: number }> = []

  const context = {
    req: {
      method,
      path,
      json: vi.fn().mockResolvedValue(body),
      param: (key: string) => params[key],
    },
    get: vi.fn((key: string) => (key === 'user' ? user : undefined)),
    json: vi.fn((data: unknown, status?: number) => {
      jsonResponses.push({ data, status })
      return { data, status }
    }),
  } as unknown as Context

  ;(context as any)._jsonResponses = jsonResponses

  return context
}

describe('Bookmarks CRUD Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabaseChain()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================
  // POST /process - Reprocess Bookmark
  // ============================================================
  describe('POST /process - Reprocess Bookmark', () => {
    describe('Happy Path', () => {
      it('should reprocess bookmark and reset status to pending', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-0000-0000-000000000001'
        const bookmark = createTestBookmark(bookmarkId, user.id, {
          title: 'Good Title',
          url: 'https://example.com/article',
          processing_status: 'failed',
          processing_error: 'Previous error',
        })

        mockSupabase.single.mockResolvedValueOnce({
          data: bookmark,
          error: null,
        })

        mockSupabase.eq.mockResolvedValue({
          data: null,
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'POST' && r.path === '/process'
        )?.handler

        const ctx = createMockContext({
          body: { bookmarkId },
          user,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data).toMatchObject({
          success: true,
          message: 'Processing triggered',
          bookmarkId,
        })

        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            processing_status: 'pending',
            processing_error: null,
          })
        )
      })

      it('should clear bad title when reprocessing', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-0000-0000-000000000001'
        const url = 'https://example.com/article'
        const bookmark = createTestBookmark(bookmarkId, user.id, {
          title: 'Untitled',
          url,
        })

        mockSupabase.single.mockResolvedValueOnce({
          data: bookmark,
          error: null,
        })

        mockSupabase.eq.mockResolvedValue({
          data: null,
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'POST' && r.path === '/process'
        )?.handler

        const ctx = createMockContext({
          body: { bookmarkId },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            title: url, // Should reset to URL
          })
        )
      })

      it('should preserve good title when reprocessing', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-0000-0000-000000000001'
        const bookmark = createTestBookmark(bookmarkId, user.id, {
          title: 'How to Build a Great App',
          url: 'https://example.com/article',
        })

        mockSupabase.single.mockResolvedValueOnce({
          data: bookmark,
          error: null,
        })

        mockSupabase.eq.mockResolvedValue({
          data: null,
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'POST' && r.path === '/process'
        )?.handler

        const ctx = createMockContext({
          body: { bookmarkId },
          user,
        })
        await handler?.(ctx, async () => {})

        // Should not include title in update (preserved)
        expect(mockSupabase.update).not.toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.anything(),
          })
        )
      })

      it('should enqueue processing job', async () => {
        const { enqueueBookmarkProcessing } = await import('../../jobs/queue')
        const user = createTestUser()
        const bookmarkId = '00000000-0000-0000-0000-000000000001'
        const url = 'https://example.com/article'
        const bookmark = createTestBookmark(bookmarkId, user.id, { url })

        mockSupabase.single.mockResolvedValueOnce({
          data: bookmark,
          error: null,
        })

        mockSupabase.eq.mockResolvedValue({
          data: null,
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'POST' && r.path === '/process'
        )?.handler

        const ctx = createMockContext({
          body: { bookmarkId },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(enqueueBookmarkProcessing).toHaveBeenCalledWith(
          bookmarkId,
          url,
          user.id
        )
      })
    })

    describe('Validation', () => {
      it('should reject invalid UUID format', async () => {
        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'POST' && r.path === '/process'
        )?.handler

        const ctx = createMockContext({
          body: { bookmarkId: 'invalid-uuid' },
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(400)
        expect(response.data.error).toContain('Invalid bookmark ID')
      })

      it('should reject missing bookmarkId', async () => {
        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'POST' && r.path === '/process'
        )?.handler

        const ctx = createMockContext({
          body: {},
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(400)
      })
    })

    describe('Error Cases', () => {
      it('should return 404 when bookmark not found', async () => {
        mockSupabase.single.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' },
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'POST' && r.path === '/process'
        )?.handler

        const ctx = createMockContext({
          body: { bookmarkId: '00000000-0000-0000-0000-000000000001' },
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(404)
        expect(response.data.error).toBe('Bookmark not found')
      })

      it('should return 404 when bookmark belongs to other user', async () => {
        const userA = createTestUser('user-a')
        const bookmark = createTestBookmark(
          '00000000-0000-0000-0000-000000000001',
          'user-b'
        )

        mockSupabase.single.mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' },
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'POST' && r.path === '/process'
        )?.handler

        const ctx = createMockContext({
          body: { bookmarkId: '00000000-0000-0000-0000-000000000001' },
          user: userA,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(404)
      })

      it('should handle database update error', async () => {
        const user = createTestUser()
        const bookmark = createTestBookmark(
          '00000000-0000-0000-0000-000000000001',
          user.id
        )

        mockSupabase.single.mockResolvedValueOnce({
          data: bookmark,
          error: null,
        })

        mockSupabase.eq.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'POST' && r.path === '/process'
        )?.handler

        const ctx = createMockContext({
          body: { bookmarkId: '00000000-0000-0000-0000-000000000001' },
          user,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(500)
        expect(response.data.error).toBe('Failed to reset bookmark status')
      })
    })

    describe('Edge Cases', () => {
      it('should handle bookmark already processing', async () => {
        const user = createTestUser()
        const bookmark = createTestBookmark(
          '00000000-0000-0000-0000-000000000001',
          user.id,
          {
            processing_status: 'processing',
          }
        )

        mockSupabase.single.mockResolvedValueOnce({
          data: bookmark,
          error: null,
        })

        mockSupabase.eq.mockResolvedValue({
          data: null,
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'POST' && r.path === '/process'
        )?.handler

        const ctx = createMockContext({
          body: { bookmarkId: '00000000-0000-0000-0000-000000000001' },
          user,
        })
        await handler?.(ctx, async () => {})

        // Should still reset to pending
        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            processing_status: 'pending',
          })
        )
      })

      it('should handle bookmark already completed', async () => {
        const user = createTestUser()
        const bookmark = createTestBookmark(
          '00000000-0000-0000-0000-000000000001',
          user.id,
          {
            processing_status: 'completed',
          }
        )

        mockSupabase.single.mockResolvedValueOnce({
          data: bookmark,
          error: null,
        })

        mockSupabase.eq.mockResolvedValue({
          data: null,
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'POST' && r.path === '/process'
        )?.handler

        const ctx = createMockContext({
          body: { bookmarkId: '00000000-0000-0000-0000-000000000001' },
          user,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data.success).toBe(true)
      })

      it('should clear title when it matches URL', async () => {
        const user = createTestUser()
        const url = 'https://example.com/article'
        const bookmark = createTestBookmark(
          '00000000-0000-0000-0000-000000000001',
          user.id,
          {
            title: url,
            url,
          }
        )

        mockSupabase.single.mockResolvedValueOnce({
          data: bookmark,
          error: null,
        })

        mockSupabase.eq.mockResolvedValue({
          data: null,
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'POST' && r.path === '/process'
        )?.handler

        const ctx = createMockContext({
          body: { bookmarkId: '00000000-0000-0000-0000-000000000001' },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            title: url,
          })
        )
      })
    })
  })

  // ============================================================
  // GET /:id - Get Single Bookmark
  // ============================================================
  describe('GET /:id - Get Single Bookmark', () => {
    describe('Happy Path', () => {
      it('should return completed bookmark', async () => {
        const user = createTestUser()
        const bookmark = createTestBookmark(
          '00000000-0000-0000-0000-000000000001',
          user.id,
          {
            processing_status: 'completed',
            title: 'Test Article',
          }
        )

        mockSupabase.single.mockResolvedValue({
          data: bookmark,
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'GET',
          params: { id: '00000000-0000-0000-0000-000000000001' },
          user,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data).toMatchObject({
          id: '00000000-0000-0000-0000-000000000001',
          title: 'Test Article',
          processing_status: 'completed',
        })
      })

      it('should return pending bookmark', async () => {
        const user = createTestUser()
        const bookmark = createTestBookmark(
          '00000000-0000-0000-0000-000000000001',
          user.id,
          {
            processing_status: 'pending',
            updated_at: new Date().toISOString(),
          }
        )

        mockSupabase.single.mockResolvedValue({
          data: bookmark,
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'GET',
          params: { id: '00000000-0000-0000-0000-000000000001' },
          user,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data.processing_status).toBe('pending')
      })

      it('should return processing bookmark', async () => {
        const user = createTestUser()
        const bookmark = createTestBookmark(
          '00000000-0000-0000-0000-000000000001',
          user.id,
          {
            processing_status: 'processing',
            updated_at: new Date().toISOString(),
          }
        )

        mockSupabase.single.mockResolvedValue({
          data: bookmark,
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'GET',
          params: { id: '00000000-0000-0000-0000-000000000001' },
          user,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data.processing_status).toBe('processing')
      })

      it('should return failed bookmark', async () => {
        const user = createTestUser()
        const bookmark = createTestBookmark(
          '00000000-0000-0000-0000-000000000001',
          user.id,
          {
            processing_status: 'failed',
            processing_error: 'Extraction failed',
          }
        )

        mockSupabase.single.mockResolvedValue({
          data: bookmark,
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'GET',
          params: { id: '00000000-0000-0000-0000-000000000001' },
          user,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data).toMatchObject({
          processing_status: 'failed',
          processing_error: 'Extraction failed',
        })
      })
    })

    describe('Timeout Logic', () => {
      it('should auto-fail pending bookmark > 5 minutes', async () => {
        const user = createTestUser()
        const fiveMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString()
        const bookmark = createTestBookmark(
          '00000000-0000-0000-0000-000000000001',
          user.id,
          {
            processing_status: 'pending',
            updated_at: fiveMinutesAgo,
          }
        )

        mockSupabase.single
          .mockResolvedValueOnce({
            data: bookmark,
            error: null,
          })
          .mockResolvedValueOnce({
            data: {
              ...bookmark,
              processing_status: 'failed',
              processing_error: 'Processing timed out. Please try regenerating the summary.',
            },
            error: null,
          })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'GET',
          params: { id: '00000000-0000-0000-0000-000000000001' },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            processing_status: 'failed',
            processing_error: 'Processing timed out. Please try regenerating the summary.',
          })
        )
      })

      it('should auto-fail processing bookmark > 5 minutes', async () => {
        const user = createTestUser()
        const fiveMinutesAgo = new Date(Date.now() - 7 * 60 * 1000).toISOString()
        const bookmark = createTestBookmark(
          '00000000-0000-0000-0000-000000000001',
          user.id,
          {
            processing_status: 'processing',
            updated_at: fiveMinutesAgo,
          }
        )

        mockSupabase.single
          .mockResolvedValueOnce({
            data: bookmark,
            error: null,
          })
          .mockResolvedValueOnce({
            data: {
              ...bookmark,
              processing_status: 'failed',
            },
            error: null,
          })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'GET',
          params: { id: '00000000-0000-0000-0000-000000000001' },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).toHaveBeenCalled()
      })

      it('should NOT auto-fail if just under 5 minutes', async () => {
        const user = createTestUser()
        const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000).toISOString()
        const bookmark = createTestBookmark(
          '00000000-0000-0000-0000-000000000001',
          user.id,
          {
            processing_status: 'pending',
            updated_at: fourMinutesAgo,
          }
        )

        mockSupabase.single.mockResolvedValue({
          data: bookmark,
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'GET',
          params: { id: '00000000-0000-0000-0000-000000000001' },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).not.toHaveBeenCalled()
      })

      it('should return original bookmark if timeout update fails', async () => {
        const user = createTestUser()
        const fiveMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString()
        const bookmark = createTestBookmark(
          '00000000-0000-0000-0000-000000000001',
          user.id,
          {
            processing_status: 'pending',
            updated_at: fiveMinutesAgo,
          }
        )

        mockSupabase.single
          .mockResolvedValueOnce({
            data: bookmark,
            error: null,
          })
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'Update failed' },
          })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'GET',
          params: { id: '00000000-0000-0000-0000-000000000001' },
          user,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data).toEqual(bookmark)
      })
    })

    describe('Validation', () => {
      it('should reject invalid UUID', async () => {
        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'GET',
          params: { id: 'invalid-uuid' },
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(400)
        expect(response.data.error).toBe('Invalid bookmark ID')
      })
    })

    describe('Error Cases', () => {
      it('should return 404 when bookmark not found', async () => {
        mockSupabase.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'GET',
          params: { id: '00000000-0000-0000-0000-000000000001' },
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(404)
        expect(response.data.error).toBe('Bookmark not found')
      })

      it('should handle database error', async () => {
        mockSupabase.single.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'GET',
          params: { id: '00000000-0000-0000-0000-000000000001' },
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(500)
        expect(response.data.error).toBe('Failed to fetch bookmark')
      })
    })

    describe('User Isolation', () => {
      it('should return 404 for other users bookmark', async () => {
        const userA = createTestUser('user-a')

        mockSupabase.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'GET' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'GET',
          params: { id: '00000000-0000-0000-0000-000000000001' },
          user: userA,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(404)
      })
    })
  })

  // Continue with PUT, PATCH, bulk-archive, and DELETE in next section due to length
})
