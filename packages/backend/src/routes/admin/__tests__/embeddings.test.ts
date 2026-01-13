/**
 * Comprehensive test suite for Admin Embeddings Routes.
 *
 * Tests cover:
 * - GET /missing - List bookmarks missing embeddings
 * - GET /stats - Get embedding statistics
 * - POST /:bookmarkId/regenerate - Regenerate single embedding
 * - POST /bulk-regenerate - Bulk regenerate embeddings
 * - POST /bulk-regenerate-queue - Enqueue bookmarks for background processing
 *
 * All endpoints require admin authentication (mocked).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import { embeddingsRoutes } from '../embeddings'

// Mock data
const TEST_USER_ID = 'user-123'
const TEST_BOOKMARK_ID = '550e8400-e29b-41d4-a716-446655440000'
const TEST_BOOKMARK_ID_2 = '550e8400-e29b-41d4-a716-446655440001'
const TEST_URL = 'https://example.com/article'
const TEST_URL_2 = 'https://example.com/article2'

// Store mock functions for assertions
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
}

// Mock embedding generation
const mockGenerateBookmarkEmbedding = vi.fn()
const mockFormatEmbeddingForPostgres = vi.fn()

// Mock queue function
const mockEnqueueBookmarkProcessing = vi.fn()

// Mock Supabase
vi.mock('../../../config/supabase', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockSupabase.from(...args),
    rpc: (...args: unknown[]) => mockSupabase.rpc(...args),
  },
}))

// Mock embeddings module
vi.mock('../../../lib/ai/embeddings', () => ({
  generateBookmarkEmbedding: (...args: unknown[]) => mockGenerateBookmarkEmbedding(...args),
  formatEmbeddingForPostgres: (...args: unknown[]) => mockFormatEmbeddingForPostgres(...args),
  EXPECTED_EMBEDDING_DIMENSION: 768,
}))

// Mock queue module
vi.mock('../../../jobs/queue', () => ({
  enqueueBookmarkProcessing: (...args: unknown[]) => mockEnqueueBookmarkProcessing(...args),
}))

// Create test app
function createTestApp() {
  const app = new Hono()
  app.route('/embeddings', embeddingsRoutes)
  return app
}

// Helper to create mock select chain
function createMockSelectChain(data: unknown, error: unknown = null, count: number | null = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    then: (resolve: (value: { data: unknown; error: unknown; count: number | null }) => void) =>
      Promise.resolve({ data, error, count }).then(resolve),
  }
  return chain
}

describe('Admin Embeddings Routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    app = createTestApp()
    // Default mock for embedding generation
    mockGenerateBookmarkEmbedding.mockResolvedValue(Array(768).fill(0.1))
    mockFormatEmbeddingForPostgres.mockReturnValue('[0.1,0.1,...]')
    mockSupabase.rpc.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /missing - List bookmarks missing embeddings', () => {
    it('should return paginated list of bookmarks without embeddings', async () => {
      const mockBookmarks = [
        {
          id: TEST_BOOKMARK_ID,
          url: TEST_URL,
          title: 'Test Article',
          source: 'web',
          processing_status: 'completed',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ]

      // Mock returns different counts based on call order:
      // 1st call: missing bookmarks query (returns mockBookmarks, count: 1)
      // 2nd call: total bookmarks count (returns count: 10)
      // 3rd call: with embeddings count (returns count: 9)
      let callCount = 0
      mockSupabase.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // Missing bookmarks query
          return createMockSelectChain(mockBookmarks, null, 1)
        }
        if (callCount === 2) {
          // Total bookmarks count
          return createMockSelectChain(null, null, 10)
        }
        // With embeddings count
        return createMockSelectChain(null, null, 9)
      })

      const res = await app.request('/embeddings/missing')
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.bookmarks).toHaveLength(1)
      expect(body.stats).toEqual({
        total: 10,
        with_embeddings: 9,
        missing: 1,
        coverage_percent: 90,
      })
      expect(body.pagination).toEqual({
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      })
    })

    it('should filter by source', async () => {
      const selectChain = createMockSelectChain([], null, 0)
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request('/embeddings/missing?source=twitter')

      expect(res.status).toBe(200)
      expect(selectChain.eq).toHaveBeenCalledWith('source', 'twitter')
    })

    it('should support custom pagination', async () => {
      const selectChain = createMockSelectChain([], null, 100)
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request('/embeddings/missing?page=3&limit=50')
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.pagination.page).toBe(3)
      expect(body.pagination.limit).toBe(50)
      expect(selectChain.range).toHaveBeenCalledWith(100, 149)
    })

    it('should handle database errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const selectChain = createMockSelectChain(null, { message: 'Database error' })
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request('/embeddings/missing')
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error).toBe('Failed to fetch bookmarks')
      consoleSpy.mockRestore()
    })

    it('should limit max items per page to 100', async () => {
      const res = await app.request('/embeddings/missing?limit=200')
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toBe('Invalid query parameters')
    })
  })

  describe('GET /stats - Get embedding statistics', () => {
    it('should return embedding statistics', async () => {
      const countChain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            then: (resolve: (value: { count: number; error: null }) => void) =>
              Promise.resolve({ count: 5, error: null }).then(resolve),
          }),
          then: (resolve: (value: { count: number; error: null }) => void) =>
            Promise.resolve({ count: 5, error: null }).then(resolve),
        }),
        then: (resolve: (value: { count: number; error: null }) => void) =>
          Promise.resolve({ count: 100, error: null }).then(resolve),
      }
      mockSupabase.from.mockReturnValue(countChain)

      const res = await app.request('/embeddings/stats')
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toHaveProperty('total')
      expect(body).toHaveProperty('withEmbedding')
      expect(body).toHaveProperty('missing')
      expect(body).toHaveProperty('coverage')
      expect(body).toHaveProperty('missingBySource')
    })

    it('should handle database errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          then: (resolve: (value: { count: null; error: { message: string } }) => void) =>
            Promise.resolve({ count: null, error: { message: 'Database error' } }).then(resolve),
        }),
      })

      const res = await app.request('/embeddings/stats')
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error).toBe('Failed to fetch statistics')
      consoleSpy.mockRestore()
    })
  })

  describe('POST /:bookmarkId/regenerate - Regenerate single embedding', () => {
    it('should regenerate embedding for a bookmark', async () => {
      const mockBookmark = {
        id: TEST_BOOKMARK_ID,
        title: 'Test Article',
        blurb: 'A short summary',
        summary: 'A detailed summary',
        key_takeaways: [{ text: 'Takeaway 1' }],
        processing_status: 'completed',
      }

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockBookmark, error: null }),
      }
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request(`/embeddings/${TEST_BOOKMARK_ID}/regenerate`, {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.message).toBe('Embedding regenerated successfully')
      expect(body.bookmarkId).toBe(TEST_BOOKMARK_ID)
      expect(mockGenerateBookmarkEmbedding).toHaveBeenCalledWith(
        'Test Article',
        'A short summary',
        'A detailed summary',
        [{ text: 'Takeaway 1' }]
      )
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'update_bookmark_embedding',
        {
          bookmark_id: TEST_BOOKMARK_ID,
          embedding_value: '[0.1,0.1,...]',
        }
      )
    })

    it('should return 404 for non-existent bookmark', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request(`/embeddings/${TEST_BOOKMARK_ID}/regenerate`, {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error).toBe('Bookmark not found')
    })

    it('should reject unprocessed bookmarks', async () => {
      const mockBookmark = {
        id: TEST_BOOKMARK_ID,
        title: 'Test Article',
        blurb: null,
        summary: null,
        key_takeaways: null,
        processing_status: 'pending',
      }

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockBookmark, error: null }),
      }
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request(`/embeddings/${TEST_BOOKMARK_ID}/regenerate`, {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toBe('Bookmark has not been processed')
      expect(body.processingStatus).toBe('pending')
    })

    it('should reject invalid bookmark ID format', async () => {
      const res = await app.request('/embeddings/invalid-id/regenerate', {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toBe('Invalid bookmark ID')
    })

    it('should handle invalid embedding dimension', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockBookmark = {
        id: TEST_BOOKMARK_ID,
        title: 'Test Article',
        blurb: 'Summary',
        summary: 'Details',
        key_takeaways: null,
        processing_status: 'completed',
      }

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockBookmark, error: null }),
      }
      mockSupabase.from.mockReturnValue(selectChain)

      // Return wrong dimension
      mockGenerateBookmarkEmbedding.mockResolvedValue(Array(512).fill(0.1))

      const res = await app.request(`/embeddings/${TEST_BOOKMARK_ID}/regenerate`, {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error).toBe('Invalid embedding dimension')
      expect(body.expected).toBe(768)
      expect(body.actual).toBe(512)
      consoleSpy.mockRestore()
    })

    it('should handle RPC errors when saving embedding', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockBookmark = {
        id: TEST_BOOKMARK_ID,
        title: 'Test Article',
        blurb: 'Summary',
        summary: 'Details',
        key_takeaways: null,
        processing_status: 'completed',
      }

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockBookmark, error: null }),
      }
      mockSupabase.from.mockReturnValue(selectChain)
      mockSupabase.rpc.mockResolvedValue({ error: { message: 'RPC failed' } })

      const res = await app.request(`/embeddings/${TEST_BOOKMARK_ID}/regenerate`, {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error).toBe('Failed to save embedding')
      consoleSpy.mockRestore()
    })

    it('should handle embedding generation errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockBookmark = {
        id: TEST_BOOKMARK_ID,
        title: 'Test Article',
        blurb: 'Summary',
        summary: 'Details',
        key_takeaways: null,
        processing_status: 'completed',
      }

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockBookmark, error: null }),
      }
      mockSupabase.from.mockReturnValue(selectChain)
      mockGenerateBookmarkEmbedding.mockRejectedValue(new Error('AI API error'))

      const res = await app.request(`/embeddings/${TEST_BOOKMARK_ID}/regenerate`, {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error).toBe('Internal server error')
      consoleSpy.mockRestore()
    })
  })

  describe('POST /bulk-regenerate - Bulk regenerate embeddings', () => {
    it('should regenerate embeddings for specific bookmarks', async () => {
      const mockBookmarks = [
        { id: TEST_BOOKMARK_ID, title: 'Article 1', blurb: 'Blurb 1', summary: 'Summary 1', key_takeaways: null },
        { id: TEST_BOOKMARK_ID_2, title: 'Article 2', blurb: 'Blurb 2', summary: 'Summary 2', key_takeaways: null },
      ]

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue({
          then: (resolve: (value: { data: typeof mockBookmarks; error: null }) => void) =>
            Promise.resolve({ data: mockBookmarks, error: null }).then(resolve),
        }),
      }
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request('/embeddings/bulk-regenerate', {
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

    it('should regenerate embeddings for missing by source', async () => {
      const mockBookmarks = [
        { id: TEST_BOOKMARK_ID, title: 'Tweet 1', blurb: 'Blurb', summary: 'Summary', key_takeaways: null },
      ]

      // Build a chain where limit returns an object that also has eq method for the source filter
      const limitResult = {
        eq: vi.fn().mockResolvedValue({ data: mockBookmarks, error: null }),
        then: (resolve: (value: { data: typeof mockBookmarks; error: null }) => void) =>
          Promise.resolve({ data: mockBookmarks, error: null }).then(resolve),
      }

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue(limitResult),
      }
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request('/embeddings/bulk-regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'twitter', limit: 10 }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.processed).toBe(1)
      expect(limitResult.eq).toHaveBeenCalledWith('source', 'twitter')
    })

    it('should return success when no bookmarks to process', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue({
          then: (resolve: (value: { data: never[]; error: null }) => void) =>
            Promise.resolve({ data: [], error: null }).then(resolve),
        }),
      }
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request('/embeddings/bulk-regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.message).toBe('No bookmarks found to process')
      expect(body.processed).toBe(0)
    })

    it('should handle partial failures', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const mockBookmarks = [
        { id: TEST_BOOKMARK_ID, title: 'Article 1', blurb: 'Blurb', summary: 'Summary', key_takeaways: null },
        { id: TEST_BOOKMARK_ID_2, title: 'Article 2', blurb: 'Blurb', summary: 'Summary', key_takeaways: null },
      ]

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue({
          then: (resolve: (value: { data: typeof mockBookmarks; error: null }) => void) =>
            Promise.resolve({ data: mockBookmarks, error: null }).then(resolve),
        }),
      }
      mockSupabase.from.mockReturnValue(selectChain)

      // First embedding succeeds, second fails
      mockGenerateBookmarkEmbedding
        .mockResolvedValueOnce(Array(768).fill(0.1))
        .mockRejectedValueOnce(new Error('API rate limit'))

      const res = await app.request('/embeddings/bulk-regenerate', {
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
        error: 'API rate limit',
      })
      consoleSpy.mockRestore()
    })

    it('should respect limit parameter', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue({
          then: (resolve: (value: { data: never[]; error: null }) => void) =>
            Promise.resolve({ data: [], error: null }).then(resolve),
        }),
      }
      mockSupabase.from.mockReturnValue(selectChain)

      await app.request('/embeddings/bulk-regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 25 }),
      })

      expect(selectChain.limit).toHaveBeenCalledWith(25)
    })

    it('should reject limit over 100', async () => {
      const res = await app.request('/embeddings/bulk-regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 150 }),
      })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toBe('Invalid request')
    })

    it('should handle database errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue({
          then: (resolve: (value: { data: null; error: { message: string } }) => void) =>
            Promise.resolve({ data: null, error: { message: 'Database error' } }).then(resolve),
        }),
      })

      const res = await app.request('/embeddings/bulk-regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error).toBe('Failed to fetch bookmarks')
      consoleSpy.mockRestore()
    })
  })

  describe('POST /bulk-regenerate-queue - Enqueue bookmarks for background processing', () => {
    it('should enqueue all bookmarks missing embeddings', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const mockBookmarks = [
        { id: TEST_BOOKMARK_ID, url: TEST_URL, user_id: TEST_USER_ID },
        { id: TEST_BOOKMARK_ID_2, url: TEST_URL_2, user_id: TEST_USER_ID },
      ]

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          then: (resolve: (value: { data: typeof mockBookmarks; error: null }) => void) =>
            Promise.resolve({ data: mockBookmarks, error: null }).then(resolve),
        }),
      }
      mockSupabase.from.mockReturnValue(selectChain)
      mockEnqueueBookmarkProcessing.mockResolvedValue(undefined)

      const res = await app.request('/embeddings/bulk-regenerate-queue', {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.count).toBe(2)
      expect(body.message).toContain('Enqueued 2 bookmarks')
      expect(body.message).toContain('Worker concurrency: 5')
      expect(mockEnqueueBookmarkProcessing).toHaveBeenCalledTimes(2)
      expect(mockEnqueueBookmarkProcessing).toHaveBeenCalledWith(TEST_BOOKMARK_ID, TEST_URL, TEST_USER_ID)
      expect(mockEnqueueBookmarkProcessing).toHaveBeenCalledWith(TEST_BOOKMARK_ID_2, TEST_URL_2, TEST_USER_ID)
      consoleSpy.mockRestore()
    })

    it('should return success with zero count when no bookmarks to enqueue', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          then: (resolve: (value: { data: never[]; error: null }) => void) =>
            Promise.resolve({ data: [], error: null }).then(resolve),
        }),
      }
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request('/embeddings/bulk-regenerate-queue', {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.count).toBe(0)
      expect(body.message).toBe('No bookmarks found missing embeddings')
      expect(mockEnqueueBookmarkProcessing).not.toHaveBeenCalled()
    })

    it('should handle null bookmarks response', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          then: (resolve: (value: { data: null; error: null }) => void) =>
            Promise.resolve({ data: null, error: null }).then(resolve),
        }),
      }
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request('/embeddings/bulk-regenerate-queue', {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.count).toBe(0)
      expect(body.message).toBe('No bookmarks found missing embeddings')
    })

    it('should handle database errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          then: (resolve: (value: { data: null; error: { message: string } }) => void) =>
            Promise.resolve({ data: null, error: { message: 'Database error' } }).then(resolve),
        }),
      }
      mockSupabase.from.mockReturnValue(selectChain)

      const res = await app.request('/embeddings/bulk-regenerate-queue', {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error).toBe('Failed to fetch bookmarks')
      consoleSpy.mockRestore()
    })

    it('should handle partial enqueue failures', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockBookmarks = [
        { id: TEST_BOOKMARK_ID, url: TEST_URL, user_id: TEST_USER_ID },
        { id: TEST_BOOKMARK_ID_2, url: TEST_URL_2, user_id: TEST_USER_ID },
      ]

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          then: (resolve: (value: { data: typeof mockBookmarks; error: null }) => void) =>
            Promise.resolve({ data: mockBookmarks, error: null }).then(resolve),
        }),
      }
      mockSupabase.from.mockReturnValue(selectChain)

      // First succeeds, second fails
      mockEnqueueBookmarkProcessing
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Redis connection failed'))

      const res = await app.request('/embeddings/bulk-regenerate-queue', {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.count).toBe(1)
      expect(body.failedToEnqueue).toBe(1)
      expect(body.errors).toHaveLength(1)
      expect(body.errors[0]).toEqual({
        bookmarkId: TEST_BOOKMARK_ID_2,
        error: 'Redis connection failed',
      })
      consoleSpy.mockRestore()
      consoleWarnSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })

    it('should query only completed bookmarks with null embeddings', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          then: (resolve: (value: { data: never[]; error: null }) => void) =>
            Promise.resolve({ data: [], error: null }).then(resolve),
        }),
      }
      mockSupabase.from.mockReturnValue(selectChain)

      await app.request('/embeddings/bulk-regenerate-queue', {
        method: 'POST',
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('bookmarks')
      expect(selectChain.select).toHaveBeenCalledWith('id, url, user_id')
      expect(selectChain.is).toHaveBeenCalledWith('embedding', null)
      expect(selectChain.eq).toHaveBeenCalledWith('processing_status', 'completed')
    })

    it('should handle unexpected errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const res = await app.request('/embeddings/bulk-regenerate-queue', {
        method: 'POST',
      })
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error).toBe('Internal server error')
      consoleSpy.mockRestore()
    })
  })

  describe('Error Handling', () => {
    it('should return 500 for unexpected errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const res = await app.request('/embeddings/missing')
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error).toBe('Internal server error')
      consoleSpy.mockRestore()
    })
  })
})
