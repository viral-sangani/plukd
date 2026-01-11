/**
 * Comprehensive tests for bookmarks update and delete operations
 *
 * Coverage:
 * 1. PUT /:id - Update bookmark (full update, excludes is_archived)
 * 2. PATCH /:id - Update bookmark (partial update, includes is_archived)
 * 3. PATCH /bulk-archive - Bulk archive/unarchive operations
 * 4. DELETE /:id - Delete bookmark
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Context } from 'hono'
import { bookmarksRoutes } from '../bookmarks'
import type { Category, Tag } from '@plukd/shared'

// Mock Supabase admin client - creates chainable mock that is also thenable
const createMockSupabaseChain = () => {
  // Default response when the chain is awaited
  let pendingResponse: { data: unknown; error: unknown; count?: number | null } = { data: null, error: null }

  const chain: Record<string, any> = {}

  // Make chain thenable - when awaited, resolve with pendingResponse
  chain.then = (resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) => {
    return Promise.resolve(pendingResponse).then(resolve, reject)
  }

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

  // range() and limit() - typically terminal, return thenable chain
  chain.range = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 })
  chain.limit = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 })

  // Terminal methods - return promises directly
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })

  // from() method - returns the chain
  chain.from = vi.fn().mockImplementation(() => chain)

  // rpc() method - returns promise
  chain.rpc = vi.fn().mockResolvedValue({ data: null, error: null })

  // Helper to set the pending response for thenable resolution
  chain._setResponse = (response: { data: unknown; error: unknown; count?: number | null }) => {
    pendingResponse = response
  }

  return chain
}

// Mock Supabase
let mockSupabase: ReturnType<typeof createMockSupabaseChain>
vi.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    get from() {
      return (...args: unknown[]) => mockSupabase.from(...args)
    },
    get rpc() {
      return (...args: unknown[]) => mockSupabase.rpc(...args)
    },
  },
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
  title: 'Test Article',
  category: 'news' as Category,
  tags: ['tutorial'] as Tag[],
  blurb: 'Test blurb',
  summary: 'Test summary',
  is_archived: false,
  ...overrides,
})

// Mock Hono context factory
const createMockContext = (options: {
  method?: string
  body?: unknown
  user?: { id: string; email: string }
  params?: Record<string, string>
} = {}): Context => {
  const {
    method = 'PUT',
    body = {},
    user = createTestUser(),
    params = {},
  } = options

  const jsonResponses: Array<{ data: unknown; status?: number }> = []

  const context = {
    req: {
      method,
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

describe('Bookmarks Update and Delete Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabaseChain()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================
  // PUT /:id - Update Bookmark (Full)
  // ============================================================
  describe('PUT /:id - Update Bookmark (Full)', () => {
    describe('Happy Path', () => {
      it('should update title', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-4000-8000-000000000001'
        const updatedBookmark = createTestBookmark(bookmarkId, user.id, {
          title: 'Updated Title',
        })

        mockSupabase.single
          .mockResolvedValueOnce({ data: { id: bookmarkId }, error: null })
          .mockResolvedValueOnce({ data: updatedBookmark, error: null })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PUT' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          params: { id: bookmarkId },
          body: { title: 'Updated Title' },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Updated Title',
          })
        )
      })

      it('should update category', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-4000-8000-000000000001'
        const updatedBookmark = createTestBookmark(bookmarkId, user.id, {
          category: 'ai',
        })

        mockSupabase.single
          .mockResolvedValueOnce({ data: { id: bookmarkId }, error: null })
          .mockResolvedValueOnce({ data: updatedBookmark, error: null })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PUT' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          params: { id: bookmarkId },
          body: { category: 'ai' },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            category: 'ai',
          })
        )
      })

      it('should update tags', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-4000-8000-000000000001'
        const newTags = ['guide', 'tutorial', 'news']
        const updatedBookmark = createTestBookmark(bookmarkId, user.id, {
          tags: newTags,
        })

        mockSupabase.single
          .mockResolvedValueOnce({ data: { id: bookmarkId }, error: null })
          .mockResolvedValueOnce({ data: updatedBookmark, error: null })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PUT' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          params: { id: bookmarkId },
          body: { tags: newTags },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            tags: newTags,
          })
        )
      })

      it('should update blurb', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-4000-8000-000000000001'
        const updatedBookmark = createTestBookmark(bookmarkId, user.id, {
          blurb: 'Updated blurb',
        })

        mockSupabase.single
          .mockResolvedValueOnce({ data: { id: bookmarkId }, error: null })
          .mockResolvedValueOnce({ data: updatedBookmark, error: null })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PUT' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          params: { id: bookmarkId },
          body: { blurb: 'Updated blurb' },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            blurb: 'Updated blurb',
          })
        )
      })

      it('should update summary', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-4000-8000-000000000001'
        const updatedBookmark = createTestBookmark(bookmarkId, user.id, {
          summary: 'Updated summary',
        })

        mockSupabase.single
          .mockResolvedValueOnce({ data: { id: bookmarkId }, error: null })
          .mockResolvedValueOnce({ data: updatedBookmark, error: null })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PUT' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          params: { id: bookmarkId },
          body: { summary: 'Updated summary' },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            summary: 'Updated summary',
          })
        )
      })

      it('should update multiple fields at once', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-4000-8000-000000000001'
        const updatedBookmark = createTestBookmark(bookmarkId, user.id, {
          title: 'New Title',
          category: 'ai',
          tags: ['tutorial', 'guide'],
          blurb: 'New blurb',
        })

        mockSupabase.single
          .mockResolvedValueOnce({ data: { id: bookmarkId }, error: null })
          .mockResolvedValueOnce({ data: updatedBookmark, error: null })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PUT' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          params: { id: bookmarkId },
          body: {
            title: 'New Title',
            category: 'ai',
            tags: ['tutorial', 'guide'],
            blurb: 'New blurb',
          },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'New Title',
            category: 'ai',
            tags: ['tutorial', 'guide'],
            blurb: 'New blurb',
          })
        )
      })

      it('should update updated_at timestamp', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-4000-8000-000000000001'

        mockSupabase.single
          .mockResolvedValueOnce({ data: { id: bookmarkId }, error: null })
          .mockResolvedValueOnce({
            data: createTestBookmark(bookmarkId, user.id),
            error: null,
          })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PUT' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          params: { id: bookmarkId },
          body: { title: 'Updated' },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            updated_at: expect.any(String),
          })
        )
      })
    })

    describe('Validation', () => {
      it('should reject invalid UUID', async () => {
        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PUT' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          params: { id: 'invalid-uuid' },
          body: { title: 'Test' },
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(400)
        expect(response.data.error).toBe('Invalid bookmark ID')
      })

      it('should reject invalid category', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-4000-8000-000000000001'

        mockSupabase.single.mockResolvedValueOnce({
          data: { id: bookmarkId },
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PUT' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          params: { id: bookmarkId },
          body: { category: 'invalid-category' },
          user,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(400)
        expect(response.data.error).toBe('Invalid update data')
      })

      it('should reject invalid tags', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-4000-8000-000000000001'

        mockSupabase.single.mockResolvedValueOnce({
          data: { id: bookmarkId },
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PUT' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          params: { id: bookmarkId },
          body: { tags: ['invalid-tag'] },
          user,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(400)
      })
    })

    describe('Forbidden Fields', () => {
      it('should NOT update is_archived via PUT', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-4000-8000-000000000001'

        mockSupabase.single
          .mockResolvedValueOnce({ data: { id: bookmarkId }, error: null })
          .mockResolvedValueOnce({
            data: createTestBookmark(bookmarkId, user.id),
            error: null,
          })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PUT' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          params: { id: bookmarkId },
          body: { title: 'Test', is_archived: true },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).not.toHaveBeenCalledWith(
          expect.objectContaining({
            is_archived: expect.anything(),
          })
        )
      })
    })

    describe('Error Cases', () => {
      it('should return 404 when bookmark not found', async () => {
        mockSupabase.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PUT' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          params: { id: '00000000-0000-4000-8000-000000000001' },
          body: { title: 'Test' },
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(404)
        expect(response.data.error).toBe('Bookmark not found')
      })

      it('should return 404 for other users bookmark', async () => {
        const userA = createTestUser('user-a')

        mockSupabase.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PUT' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          params: { id: '00000000-0000-4000-8000-000000000001' },
          body: { title: 'Test' },
          user: userA,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(404)
      })

      it('should handle database update error', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-4000-8000-000000000001'

        mockSupabase.single
          .mockResolvedValueOnce({ data: { id: bookmarkId }, error: null })
          .mockResolvedValueOnce({
            data: null,
            error: { message: 'Database error' },
          })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PUT' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          params: { id: bookmarkId },
          body: { title: 'Test' },
          user,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(500)
        expect(response.data.error).toBe('Failed to update bookmark')
      })
    })

    describe('Edge Cases', () => {
      it('should handle empty update object (only updated_at changes)', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-4000-8000-000000000001'

        mockSupabase.single
          .mockResolvedValueOnce({ data: { id: bookmarkId }, error: null })
          .mockResolvedValueOnce({
            data: createTestBookmark(bookmarkId, user.id),
            error: null,
          })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PUT' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          params: { id: bookmarkId },
          body: {},
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            updated_at: expect.any(String),
          })
        )
      })

      it('should ignore extra unknown fields', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-4000-8000-000000000001'

        mockSupabase.single
          .mockResolvedValueOnce({ data: { id: bookmarkId }, error: null })
          .mockResolvedValueOnce({
            data: createTestBookmark(bookmarkId, user.id),
            error: null,
          })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PUT' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          params: { id: bookmarkId },
          body: {
            title: 'Valid',
            malicious: 'data',
            user_id: 'hacker',
          },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).not.toHaveBeenCalledWith(
          expect.objectContaining({
            malicious: expect.anything(),
            user_id: expect.anything(),
          })
        )
      })
    })
  })

  // ============================================================
  // PATCH /:id - Update Bookmark (Partial)
  // ============================================================
  describe('PATCH /:id - Update Bookmark (Partial)', () => {
    it('should update is_archived to true', async () => {
      const user = createTestUser()
      const bookmarkId = '00000000-0000-4000-8000-000000000001'

      mockSupabase.single
        .mockResolvedValueOnce({ data: { id: bookmarkId }, error: null })
        .mockResolvedValueOnce({
          data: createTestBookmark(bookmarkId, user.id, { is_archived: true }),
          error: null,
        })

      const handler = bookmarksRoutes.routes.find(
        (r) => r.method === 'PATCH' && r.path === '/:id'
      )?.handler

      const ctx = createMockContext({
        method: 'PATCH',
        params: { id: bookmarkId },
        body: { is_archived: true },
        user,
      })
      await handler?.(ctx, async () => {})

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_archived: true,
        })
      )
    })

    it('should update is_archived to false', async () => {
      const user = createTestUser()
      const bookmarkId = '00000000-0000-4000-8000-000000000001'

      mockSupabase.single
        .mockResolvedValueOnce({ data: { id: bookmarkId }, error: null })
        .mockResolvedValueOnce({
          data: createTestBookmark(bookmarkId, user.id, { is_archived: false }),
          error: null,
        })

      const handler = bookmarksRoutes.routes.find(
        (r) => r.method === 'PATCH' && r.path === '/:id'
      )?.handler

      const ctx = createMockContext({
        method: 'PATCH',
        params: { id: bookmarkId },
        body: { is_archived: false },
        user,
      })
      await handler?.(ctx, async () => {})

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_archived: false,
        })
      )
    })

    it('should update both is_archived and other fields', async () => {
      const user = createTestUser()
      const bookmarkId = '00000000-0000-4000-8000-000000000001'

      mockSupabase.single
        .mockResolvedValueOnce({ data: { id: bookmarkId }, error: null })
        .mockResolvedValueOnce({
          data: createTestBookmark(bookmarkId, user.id),
          error: null,
        })

      const handler = bookmarksRoutes.routes.find(
        (r) => r.method === 'PATCH' && r.path === '/:id'
      )?.handler

      const ctx = createMockContext({
        method: 'PATCH',
        params: { id: bookmarkId },
        body: {
          is_archived: true,
          title: 'Updated Title',
          category: 'ai',
        },
        user,
      })
      await handler?.(ctx, async () => {})

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_archived: true,
          title: 'Updated Title',
          category: 'ai',
        })
      )
    })

    it('should ignore non-boolean is_archived value', async () => {
      const user = createTestUser()
      const bookmarkId = '00000000-0000-4000-8000-000000000001'

      mockSupabase.single
        .mockResolvedValueOnce({ data: { id: bookmarkId }, error: null })
        .mockResolvedValueOnce({
          data: createTestBookmark(bookmarkId, user.id),
          error: null,
        })

      const handler = bookmarksRoutes.routes.find(
        (r) => r.method === 'PATCH' && r.path === '/:id'
      )?.handler

      const ctx = createMockContext({
        method: 'PATCH',
        params: { id: bookmarkId },
        body: {
          is_archived: 'true', // String instead of boolean
          title: 'Test',
        },
        user,
      })
      await handler?.(ctx, async () => {})

      expect(mockSupabase.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          is_archived: 'true',
        })
      )
    })
  })

  // ============================================================
  // PATCH /bulk-archive - Bulk Operations
  // ============================================================
  describe('PATCH /bulk-archive - Bulk Operations', () => {
    describe('Happy Path', () => {
      it('should archive multiple bookmarks', async () => {
        const user = createTestUser()
        const ids = [
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000002',
          '00000000-0000-4000-8000-000000000003',
        ]

        mockSupabase.select.mockResolvedValue({
          data: ids.map((id) =>
            createTestBookmark(id, user.id, { is_archived: true })
          ),
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PATCH' && r.path === '/bulk-archive'
        )?.handler

        const ctx = createMockContext({
          method: 'PATCH',
          path: '/bulk-archive',
          body: { ids, archived: true },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            is_archived: true,
          })
        )
        expect(mockSupabase.in).toHaveBeenCalledWith('id', ids)

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data).toMatchObject({
          success: true,
          updated: 3,
          archived: true,
        })
      })

      it('should unarchive multiple bookmarks', async () => {
        const user = createTestUser()
        const ids = [
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000002',
        ]

        mockSupabase.select.mockResolvedValue({
          data: ids.map((id) =>
            createTestBookmark(id, user.id, { is_archived: false })
          ),
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PATCH' && r.path === '/bulk-archive'
        )?.handler

        const ctx = createMockContext({
          method: 'PATCH',
          path: '/bulk-archive',
          body: { ids, archived: false },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            is_archived: false,
          })
        )

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data).toMatchObject({
          success: true,
          updated: 2,
          archived: false,
        })
      })

      it('should archive single bookmark', async () => {
        const user = createTestUser()
        const ids = ['00000000-0000-4000-8000-000000000001']

        mockSupabase.select.mockResolvedValue({
          data: [createTestBookmark(ids[0], user.id, { is_archived: true })],
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PATCH' && r.path === '/bulk-archive'
        )?.handler

        const ctx = createMockContext({
          method: 'PATCH',
          path: '/bulk-archive',
          body: { ids, archived: true },
          user,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data.updated).toBe(1)
      })
    })

    describe('Validation', () => {
      it('should reject empty ids array', async () => {
        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PATCH' && r.path === '/bulk-archive'
        )?.handler

        const ctx = createMockContext({
          method: 'PATCH',
          path: '/bulk-archive',
          body: { ids: [], archived: true },
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(400)
        expect(response.data.error).toContain('At least one bookmark ID required')
      })

      it('should reject invalid UUID in array', async () => {
        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PATCH' && r.path === '/bulk-archive'
        )?.handler

        const ctx = createMockContext({
          method: 'PATCH',
          path: '/bulk-archive',
          body: {
            ids: ['00000000-0000-4000-8000-000000000001', 'invalid-uuid'],
            archived: true,
          },
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(400)
      })

      it('should reject non-boolean archived', async () => {
        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PATCH' && r.path === '/bulk-archive'
        )?.handler

        const ctx = createMockContext({
          method: 'PATCH',
          path: '/bulk-archive',
          body: {
            ids: ['00000000-0000-4000-8000-000000000001'],
            archived: 'true',
          },
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(400)
      })
    })

    describe('User Isolation', () => {
      it('should only update user own bookmarks (partial match)', async () => {
        const userA = createTestUser('user-a')
        const userAIds = [
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000002',
        ]
        const userBIds = [
          '00000000-0000-4000-8000-000000000003',
          '00000000-0000-4000-8000-000000000004',
        ]

        // Mock only updating userA's bookmarks
        mockSupabase.select.mockResolvedValue({
          data: userAIds.map((id) =>
            createTestBookmark(id, userA.id, { is_archived: true })
          ),
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PATCH' && r.path === '/bulk-archive'
        )?.handler

        const ctx = createMockContext({
          method: 'PATCH',
          path: '/bulk-archive',
          body: { ids: [...userAIds, ...userBIds], archived: true },
          user: userA,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data.updated).toBe(2) // Only userA's bookmarks
        expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', userA.id)
      })

      it('should return updated: 0 when no ids match user', async () => {
        const userA = createTestUser('user-a')
        const userBIds = [
          '00000000-0000-4000-8000-000000000003',
          '00000000-0000-4000-8000-000000000004',
        ]

        mockSupabase.select.mockResolvedValue({
          data: [],
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PATCH' && r.path === '/bulk-archive'
        )?.handler

        const ctx = createMockContext({
          method: 'PATCH',
          path: '/bulk-archive',
          body: { ids: userBIds, archived: true },
          user: userA,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data.updated).toBe(0)
      })
    })

    describe('Edge Cases', () => {
      it('should handle duplicate ids in array', async () => {
        const user = createTestUser()
        const id = '00000000-0000-4000-8000-000000000001'
        const duplicateIds = [id, id, id]

        mockSupabase.select.mockResolvedValue({
          data: [createTestBookmark(id, user.id, { is_archived: true })],
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PATCH' && r.path === '/bulk-archive'
        )?.handler

        const ctx = createMockContext({
          method: 'PATCH',
          path: '/bulk-archive',
          body: { ids: duplicateIds, archived: true },
          user,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data.updated).toBe(1) // Database handles duplicates
      })

      it('should handle large array (100+ ids)', async () => {
        const user = createTestUser()
        const ids = Array.from({ length: 150 }, (_, i) =>
          `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
        )

        mockSupabase.select.mockResolvedValue({
          data: ids.map((id) =>
            createTestBookmark(id, user.id, { is_archived: true })
          ),
          error: null,
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PATCH' && r.path === '/bulk-archive'
        )?.handler

        const ctx = createMockContext({
          method: 'PATCH',
          path: '/bulk-archive',
          body: { ids, archived: true },
          user,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data.updated).toBe(150)
      })
    })

    describe('Error Cases', () => {
      it('should handle database error', async () => {
        mockSupabase.select.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'PATCH' && r.path === '/bulk-archive'
        )?.handler

        const ctx = createMockContext({
          method: 'PATCH',
          path: '/bulk-archive',
          body: {
            ids: ['00000000-0000-4000-8000-000000000001'],
            archived: true,
          },
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(500)
        expect(response.data.error).toBe('Failed to update bookmarks')
      })
    })
  })

  // ============================================================
  // DELETE /:id - Delete Bookmark
  // ============================================================
  describe('DELETE /:id - Delete Bookmark', () => {
    describe('Happy Path', () => {
      it('should delete existing bookmark', async () => {
        const user = createTestUser()
        const bookmarkId = '00000000-0000-4000-8000-000000000001'

        // Chain is thenable and resolves with default { data: null, error: null }

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'DELETE' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'DELETE',
          params: { id: bookmarkId },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.delete).toHaveBeenCalled()
        expect(mockSupabase.eq).toHaveBeenCalledWith('id', bookmarkId)
        expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', user.id)

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data).toEqual({ success: true })
      })
    })

    describe('Validation', () => {
      it('should reject invalid UUID', async () => {
        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'DELETE' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'DELETE',
          params: { id: 'invalid-uuid' },
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(400)
        expect(response.data.error).toBe('Invalid bookmark ID')
      })
    })

    describe('No-op Cases', () => {
      it('should return success for non-existent bookmark (idempotent)', async () => {
        // Chain is thenable and resolves with default { data: null, error: null }

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'DELETE' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'DELETE',
          params: { id: '00000000-0000-4000-8000-000000000099' },
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data).toEqual({ success: true })
      })

      it('should return success for other users bookmark (RLS filters it out)', async () => {
        const userA = createTestUser('user-a')

        // Chain is thenable and resolves with default { data: null, error: null }

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'DELETE' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'DELETE',
          params: { id: '00000000-0000-4000-8000-000000000001' },
          user: userA,
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.data).toEqual({ success: true })
        expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', userA.id)
      })
    })

    describe('Error Cases', () => {
      it('should handle database error', async () => {
        // Set error response for delete chain
        mockSupabase._setResponse({
          data: null,
          error: { message: 'Database error' },
        })

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'DELETE' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'DELETE',
          params: { id: '00000000-0000-4000-8000-000000000001' },
        })
        await handler?.(ctx, async () => {})

        const response = (ctx as any)._jsonResponses[0]
        expect(response.status).toBe(500)
        expect(response.data.error).toBe('Failed to delete bookmark')
      })
    })

    describe('Verification', () => {
      it('should verify user_id filter is applied', async () => {
        const user = createTestUser('user-123')

        // Chain is thenable and resolves with default { data: null, error: null }

        const handler = bookmarksRoutes.routes.find(
          (r) => r.method === 'DELETE' && r.path === '/:id'
        )?.handler

        const ctx = createMockContext({
          method: 'DELETE',
          params: { id: '00000000-0000-4000-8000-000000000001' },
          user,
        })
        await handler?.(ctx, async () => {})

        expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-123')
      })
    })
  })
})
