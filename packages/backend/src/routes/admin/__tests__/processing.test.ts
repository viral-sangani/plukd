/**
 * Comprehensive test suite for Admin Processing Routes.
 *
 * Tests cover:
 * - GET / - List bookmarks by processing status
 * - GET /stats - Get processing statistics
 * - POST /:bookmarkId/reprocess - Requeue single bookmark
 * - POST /bulk-reprocess - Bulk requeue bookmarks
 *
 * All endpoints require admin authentication (mocked).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import { processingRoutes } from '../processing'

// Mock data
const TEST_USER_ID = 'user-123'
const TEST_BOOKMARK_ID = '550e8400-e29b-41d4-a716-446655440000'
const TEST_BOOKMARK_ID_2 = '550e8400-e29b-41d4-a716-446655440001'
const TEST_URL = 'https://example.com/article'

// Store mock functions for assertions
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
}

const mockQueue = {
  add: vi.fn(),
  getJob: vi.fn(),
  getWaitingCount: vi.fn(),
  getActiveCount: vi.fn(),
  getCompletedCount: vi.fn(),
  getFailedCount: vi.fn(),
}

// Mock Supabase
vi.mock('../../../config/supabase', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockSupabase.from(...args),
    rpc: (...args: unknown[]) => mockSupabase.rpc(...args),
  },
}))

// Mock BullMQ queue
vi.mock('../../../jobs/queue', () => ({
  bookmarkQueue: {
    getWaitingCount: () => mockQueue.getWaitingCount(),
    getActiveCount: () => mockQueue.getActiveCount(),
    getCompletedCount: () => mockQueue.getCompletedCount(),
    getFailedCount: () => mockQueue.getFailedCount(),
    add: (...args: unknown[]) => mockQueue.add(...args),
    getJob: (...args: unknown[]) => mockQueue.getJob(...args),
  },
  enqueueBookmarkProcessing: vi.fn().mockResolvedValue(undefined),
}))

// Create test app
function createTestApp() {
  const app = new Hono()
  app.route('/processing', processingRoutes)
  return app
}

// Helper to create mock select chain
function createMockSelectChain(data: unknown, error: unknown = null, count: number | null = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    then: vi.fn((resolve: (value: { data: unknown; error: unknown; count: number | null }) => void) =>
      resolve({ data, error, count })
    ),
  }
  // Make the chain itself thenable
  return Object.assign(chain, {
    then: (resolve: (value: { data: unknown; error: unknown; count: number | null }) => void) =>
      Promise.resolve({ data, error, count }).then(resolve),
  })
}

// Helper to create mock update chain
function createMockUpdateChain(data: unknown = null, error: unknown = null) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) =>
      Promise.resolve({ data, error }).then(resolve),
  }
}

describe('Admin Processing Routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    app = createTestApp()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET / - List bookmarks by processing status', () => {
    it('should return paginated list of bookmarks', async () => {
      const mockBookmarks = [
        {
          id: TEST_BOOKMARK_ID,
          url: TEST_URL,
          title: 'Test Article',
          source: 'web',
          processing_status: 'completed',
          processing_error: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ]

      const selectChain = createMockSelectChain(mockBookmarks, null, 1)
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request('/processing')
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.bookmarks).toHaveLength(1)
      expect(body.pagination).toEqual({
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      })
    })

    it('should filter by processing status', async () => {
      const selectChain = createMockSelectChain([], null, 0)
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request('/processing?status=failed')

      expect(res.status).toBe(200)
      expect(selectChain.eq).toHaveBeenCalledWith('processing_status', 'failed')
    })

    it('should support custom pagination', async () => {
      const selectChain = createMockSelectChain([], null, 100)
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request('/processing?page=2&limit=50')
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.pagination.page).toBe(2)
      expect(body.pagination.limit).toBe(50)
      expect(selectChain.range).toHaveBeenCalledWith(50, 99)
    })

    it('should reject invalid status parameter', async () => {
      const res = await app.request('/processing?status=invalid')
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toBe('Invalid query parameters')
    })

    it('should handle database errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const selectChain = createMockSelectChain(null, { message: 'Database error' })
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request('/processing')
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error).toBe('Failed to fetch bookmarks')
      consoleSpy.mockRestore()
    })

    it('should limit max items per page to 100', async () => {
      const res = await app.request('/processing?limit=200')
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toBe('Invalid query parameters')
    })
  })

  describe('GET /stats - Get processing statistics', () => {
    it('should return database and queue statistics', async () => {
      // Mock database counts
      const countChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          then: (resolve: (value: { count: number; error: null }) => void) =>
            Promise.resolve({ count: 10, error: null }).then(resolve),
        }),
      }
      mockSupabase.from.mockReturnValue(countChain)

      // Mock queue counts
      mockQueue.getWaitingCount.mockResolvedValue(5)
      mockQueue.getActiveCount.mockResolvedValue(2)
      mockQueue.getCompletedCount.mockResolvedValue(100)
      mockQueue.getFailedCount.mockResolvedValue(3)

      const res = await app.request('/processing/stats')
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.database).toBeDefined()
      expect(body.queue).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
      })
    })

    it('should handle queue errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockQueue.getWaitingCount.mockRejectedValue(new Error('Redis error'))

      const res = await app.request('/processing/stats')
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error).toBe('Failed to get processing stats')
      consoleSpy.mockRestore()
    })
  })

  describe('POST /:bookmarkId/reprocess - Requeue single bookmark', () => {
    it('should requeue bookmark for processing', async () => {
      const mockBookmark = {
        id: TEST_BOOKMARK_ID,
        url: TEST_URL,
        user_id: TEST_USER_ID,
        processing_status: 'failed',
      }

      // Mock select chain for fetching bookmark
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockBookmark, error: null }),
      }

      // Mock update chain
      const updateChain = createMockUpdateChain()

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'bookmarks') {
          return {
            select: selectChain.select,
            eq: selectChain.eq,
            single: selectChain.single,
            update: updateChain.update,
          }
        }
        return selectChain
      })

      const { enqueueBookmarkProcessing } = await import('../../../jobs/queue')

      const res = await app.request(`/processing/${TEST_BOOKMARK_ID}/reprocess`, {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.message).toBe('Bookmark requeued for processing')
      expect(body.bookmarkId).toBe(TEST_BOOKMARK_ID)
      expect(enqueueBookmarkProcessing).toHaveBeenCalledWith(
        TEST_BOOKMARK_ID,
        TEST_URL,
        TEST_USER_ID
      )
    })

    it('should return 404 for non-existent bookmark', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request(`/processing/${TEST_BOOKMARK_ID}/reprocess`, {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error).toBe('Bookmark not found')
    })

    it('should reject invalid bookmark ID format', async () => {
      const res = await app.request('/processing/invalid-id/reprocess', {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toBe('Invalid bookmark ID')
    })

    it('should handle database update errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockBookmark = {
        id: TEST_BOOKMARK_ID,
        url: TEST_URL,
        user_id: TEST_USER_ID,
        processing_status: 'failed',
      }

      let callCount = 0
      mockSupabase.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First call: select for fetching bookmark
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockBookmark, error: null }),
              }),
            }),
          }
        } else {
          // Second call: update that fails
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: { message: 'Update failed' } }),
            }),
          }
        }
      })

      const res = await app.request(`/processing/${TEST_BOOKMARK_ID}/reprocess`, {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error).toBe('Failed to reset bookmark status')
      consoleSpy.mockRestore()
    })
  })

  describe('POST /bulk-reprocess - Bulk requeue bookmarks', () => {
    it('should requeue multiple bookmarks', async () => {
      const mockBookmarks = [
        { id: TEST_BOOKMARK_ID, url: TEST_URL, user_id: TEST_USER_ID },
        { id: TEST_BOOKMARK_ID_2, url: 'https://example.com/2', user_id: TEST_USER_ID },
      ]

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnValue({
          then: (resolve: (value: { data: typeof mockBookmarks; error: null }) => void) =>
            Promise.resolve({ data: mockBookmarks, error: null }).then(resolve),
        }),
      }

      const updateChain = {
        update: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnValue({
          then: (resolve: (value: { error: null }) => void) =>
            Promise.resolve({ error: null }).then(resolve),
        }),
      }

      mockSupabase.from.mockReturnValue({
        select: selectChain.select,
        in: selectChain.in,
        update: updateChain.update,
      })

      const res = await app.request('/processing/bulk-reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookmarkIds: [TEST_BOOKMARK_ID, TEST_BOOKMARK_ID_2],
        }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.processed).toBe(2)
      expect(body.failed).toBe(0)
    })

    it('should handle partially found bookmarks', async () => {
      const mockBookmarks = [
        { id: TEST_BOOKMARK_ID, url: TEST_URL, user_id: TEST_USER_ID },
      ]

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnValue({
          then: (resolve: (value: { data: typeof mockBookmarks; error: null }) => void) =>
            Promise.resolve({ data: mockBookmarks, error: null }).then(resolve),
        }),
      }

      const updateChain = {
        update: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnValue({
          then: (resolve: (value: { error: null }) => void) =>
            Promise.resolve({ error: null }).then(resolve),
        }),
      }

      mockSupabase.from.mockReturnValue({
        select: selectChain.select,
        in: selectChain.in,
        update: updateChain.update,
      })

      const res = await app.request('/processing/bulk-reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookmarkIds: [TEST_BOOKMARK_ID, TEST_BOOKMARK_ID_2],
        }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.processed).toBe(1)
      expect(body.failed).toBe(1)
      expect(body.errors).toContainEqual({
        bookmarkId: TEST_BOOKMARK_ID_2,
        error: 'Bookmark not found',
      })
    })

    it('should reject empty bookmark list', async () => {
      const res = await app.request('/processing/bulk-reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmarkIds: [] }),
      })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toBe('Invalid request')
    })

    it('should reject more than 100 bookmarks', async () => {
      const manyIds = Array.from({ length: 101 }, (_, i) =>
        `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, '0')}`
      )

      const res = await app.request('/processing/bulk-reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmarkIds: manyIds }),
      })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toBe('Invalid request')
    })

    it('should return failure when no bookmarks found', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnValue({
          then: (resolve: (value: { data: never[]; error: null }) => void) =>
            Promise.resolve({ data: [], error: null }).then(resolve),
        }),
      }

      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request('/processing/bulk-reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmarkIds: [TEST_BOOKMARK_ID] }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(false)
      expect(body.processed).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should return 500 for unexpected errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const res = await app.request('/processing')
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error).toBe('Internal server error')
      consoleSpy.mockRestore()
    })
  })
})
