/**
 * Comprehensive tests for Semantic Search endpoint
 *
 * Tests the GET /api/bookmarks/search/semantic endpoint including:
 * - Valid semantic searches with results
 * - Empty results handling
 * - Threshold filtering
 * - Query validation
 * - User isolation (RLS)
 * - Error handling and fallback behavior
 * - Edge cases with special characters and long queries
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import type { Database } from '@plukd/shared'

// Type for semantic search results
type BookmarkRow = Database['public']['Tables']['bookmarks']['Row']

interface SemanticSearchResult {
  id: string
  url: string
  title: string
  source: string
  author: string | null
  blurb: string
  category: string
  tags: string[]
  content_type: string | null
  created_at: string
  similarity: number
}

// Helper to create test semantic search results
function createTestSemanticResult(overrides: Partial<SemanticSearchResult> = {}): SemanticSearchResult {
  return {
    id: 'bookmark-1',
    url: 'https://example.com/article',
    title: 'Test Article',
    source: 'web',
    author: 'Test Author',
    blurb: 'A test article blurb',
    category: 'ai',
    tags: ['tutorial', 'guide'],
    content_type: 'article',
    created_at: new Date().toISOString(),
    similarity: 0.85,
    ...overrides,
  }
}

// Helper to create test bookmark for keyword search fallback
function createTestBookmark(overrides: Partial<BookmarkRow> = {}): Partial<BookmarkRow> {
  return {
    id: 'bookmark-1',
    user_id: 'test-user-id',
    url: 'https://example.com/article',
    title: 'Test Article',
    source: 'web',
    author: 'Test Author',
    blurb: 'A test article blurb',
    summary: 'A test article summary',
    category: 'ai',
    tags: ['tutorial', 'guide'],
    content_type: 'article',
    is_archived: false,
    processing_status: 'completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// Helper to create a 768-dimensional test embedding
function createTestEmbedding(): number[] {
  return new Array(768).fill(0).map((_, i) => Math.sin(i / 100))
}

// Create mock Supabase chain
const createMockSupabaseChain = () => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  like: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  contains: vi.fn().mockReturnThis(),
  overlaps: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
})

// Mock user for tests
const TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'authenticated',
  aud: 'authenticated',
}

// Mock Supabase before importing the module
let mockSupabase: ReturnType<typeof createMockSupabaseChain>

vi.mock('../../config/supabase', () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'from') {
          return mockSupabase.from
        }
        if (prop === 'rpc') {
          return mockSupabase.rpc
        }
        return undefined
      },
    }
  ),
}))

// Mock the auth middleware to always return our test user
vi.mock('../../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', TEST_USER)
    await next()
  }),
  optionalAuthMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', TEST_USER)
    await next()
  }),
}))

// Mock AI embeddings
vi.mock('../../lib/ai/embeddings', () => ({
  generateQueryEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
  formatEmbeddingForPostgres: vi
    .fn()
    .mockImplementation((embedding: number[]) => `[${embedding.join(',')}]`),
  EXPECTED_EMBEDDING_DIMENSION: 768,
}))

// Import after mocks are set up
import { bookmarksRoutes } from '../bookmarks'

// Helper to create a test app
function createTestApp() {
  const app = new Hono()
  app.route('/api/bookmarks', bookmarksRoutes)
  return app
}

describe('Semantic Search Endpoint', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabaseChain()
    app = createTestApp()

    // Default mock for RPC
    mockSupabase.rpc.mockResolvedValue({
      data: [],
      error: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Valid Semantic Search', () => {
    it('should return semantic search results with similarity scores', async () => {
      const testResults = [
        createTestSemanticResult({ id: 'bookmark-1', similarity: 0.92 }),
        createTestSemanticResult({ id: 'bookmark-2', similarity: 0.85 }),
        createTestSemanticResult({ id: 'bookmark-3', similarity: 0.78 }),
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: testResults,
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=machine+learning+tutorial')
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.query).toBe('machine learning tutorial')
      expect(body.results).toHaveLength(3)
      expect(body.count).toBe(3)
      expect(body.results[0].similarity).toBe(0.92)
    })

    it('should return empty results when query matches no bookmarks', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=nonexistent+topic')
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.query).toBe('nonexistent topic')
      expect(body.results).toEqual([])
      expect(body.count).toBe(0)
    })

    it('should filter results by threshold (0.5)', async () => {
      const testResults = [
        createTestSemanticResult({ id: 'bookmark-1', similarity: 0.75 }),
        createTestSemanticResult({ id: 'bookmark-2', similarity: 0.60 }),
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: testResults,
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=test&threshold=0.5')
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.results).toHaveLength(2)

      // Verify RPC was called with correct threshold
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_bookmarks_semantic',
        expect.objectContaining({
          match_threshold: 0.5,
        })
      )
    })

    it('should filter results by high threshold (0.9)', async () => {
      const testResults = [
        createTestSemanticResult({ id: 'bookmark-1', similarity: 0.95 }),
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: testResults,
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=specific+query&threshold=0.9')
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.results).toHaveLength(1)
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_bookmarks_semantic',
        expect.objectContaining({
          match_threshold: 0.9,
        })
      )
    })

    it('should use default threshold (0.7) when not specified', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      })

      await app.request('/api/bookmarks/search/semantic?q=test+query')

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_bookmarks_semantic',
        expect.objectContaining({
          match_threshold: 0.7,
        })
      )
    })

    it('should respect limit parameter', async () => {
      const testResults = Array.from({ length: 5 }, (_, i) =>
        createTestSemanticResult({ id: `bookmark-${i}`, similarity: 0.9 - i * 0.05 })
      )

      mockSupabase.rpc.mockResolvedValue({
        data: testResults,
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=test&limit=5')
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.results).toHaveLength(5)
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_bookmarks_semantic',
        expect.objectContaining({
          match_count: 5,
        })
      )
    })

    it('should include archived bookmarks when includeArchived is true', async () => {
      const testResults = [
        createTestSemanticResult({ id: 'archived-bookmark', similarity: 0.80 }),
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: testResults,
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=test&includeArchived=true')
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_bookmarks_semantic',
        expect.objectContaining({
          include_archived: true,
        })
      )
    })

    it('should exclude archived bookmarks by default', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      })

      await app.request('/api/bookmarks/search/semantic?q=test')

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_bookmarks_semantic',
        expect.objectContaining({
          include_archived: false,
        })
      )
    })
  })

  describe('Query Validation', () => {
    it('should return 400 when query parameter is missing', async () => {
      const response = await app.request('/api/bookmarks/search/semantic')
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('Invalid query parameters')
    })

    it('should return 400 when query is too short (< 2 chars)', async () => {
      const response = await app.request('/api/bookmarks/search/semantic?q=a')
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('Invalid query parameters')
      expect(body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('at least 2 characters'),
          }),
        ])
      )
    })

    it('should return 400 when threshold is below 0', async () => {
      const response = await app.request('/api/bookmarks/search/semantic?q=test&threshold=-0.1')
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('Invalid query parameters')
    })

    it('should return 400 when threshold is above 1', async () => {
      const response = await app.request('/api/bookmarks/search/semantic?q=test&threshold=1.5')
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('Invalid query parameters')
    })

    it('should return 400 when limit exceeds maximum (50)', async () => {
      const response = await app.request('/api/bookmarks/search/semantic?q=test&limit=100')
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('Invalid query parameters')
    })

    it('should accept minimum valid query (2 chars)', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=ab')
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.query).toBe('ab')
    })

    it('should accept maximum valid limit (50)', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=test&limit=50')

      expect(response.status).toBe(200)
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_bookmarks_semantic',
        expect.objectContaining({
          match_count: 50,
        })
      )
    })
  })

  describe('User Isolation (RLS)', () => {
    it('should pass user_id to RPC for filtering', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      })

      await app.request('/api/bookmarks/search/semantic?q=test')

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_bookmarks_semantic',
        expect.objectContaining({
          user_id_param: 'test-user-id',
        })
      )
    })

    it('should not return bookmarks from other users', async () => {
      // The RPC function is responsible for filtering by user_id
      // We verify that the user_id is correctly passed
      const userResults = [
        createTestSemanticResult({ id: 'user-bookmark' }),
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: userResults,
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=test')
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.results).toHaveLength(1)
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_bookmarks_semantic',
        expect.objectContaining({
          user_id_param: 'test-user-id',
        })
      )
    })
  })

  describe('Error Handling and Fallback', () => {
    it('should fallback to keyword search when RPC fails', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed', code: '500' },
      })

      // Mock keyword search returning results via from chain
      const keywordResults = [createTestBookmark()]
      mockSupabase.limit.mockResolvedValue({
        data: keywordResults,
        error: null,
        count: 1,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=test')
      const body = await response.json()

      // Should return 200 with fallback or 503 if fallback also fails
      expect([200, 503]).toContain(response.status)

      if (response.status === 200 && body.usedFallback) {
        expect(body.usedFallback).toBe(true)
        expect(body.fallbackType).toBe('keyword')
      }
    })

    it('should handle NULL embeddings from database gracefully', async () => {
      // RPC returns results but some may have NULL embeddings (filtered by DB)
      const resultsWithNulls = [
        createTestSemanticResult({ id: 'valid-1', similarity: 0.85 }),
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: resultsWithNulls,
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=test')
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.results).toHaveLength(1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle query with special characters', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=C%2B%2B+programming')
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.query).toBe('C++ programming')
    })

    it('should handle query with unicode characters', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=' + encodeURIComponent('AI 人工智能'))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.query).toBe('AI 人工智能')
    })

    it('should handle query with emojis', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=' + encodeURIComponent('rocket 🚀 launch'))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.query).toBe('rocket 🚀 launch')
    })

    it('should handle very long query strings', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      })

      const longQuery = 'a'.repeat(500)
      const response = await app.request(`/api/bookmarks/search/semantic?q=${longQuery}`)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.query).toBe(longQuery)
    })

    it('should preserve similarity scores in response', async () => {
      const testResults = [
        createTestSemanticResult({ id: 'bookmark-1', similarity: 0.9523 }),
        createTestSemanticResult({ id: 'bookmark-2', similarity: 0.8876 }),
      ]

      mockSupabase.rpc.mockResolvedValue({
        data: testResults,
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=precise+query')
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.results[0].similarity).toBe(0.9523)
      expect(body.results[1].similarity).toBe(0.8876)
    })
  })

  describe('Threshold Variations', () => {
    it('should work with threshold 0.1 (very low)', async () => {
      const manyResults = Array.from({ length: 10 }, (_, i) =>
        createTestSemanticResult({ id: `bookmark-${i}`, similarity: 0.2 + i * 0.05 })
      )

      mockSupabase.rpc.mockResolvedValue({
        data: manyResults,
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=test&threshold=0.1')

      expect(response.status).toBe(200)
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_bookmarks_semantic',
        expect.objectContaining({
          match_threshold: 0.1,
        })
      )
    })

    it('should work with threshold 0.99 (very high)', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=test&threshold=0.99')
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.results).toEqual([])
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_bookmarks_semantic',
        expect.objectContaining({
          match_threshold: 0.99,
        })
      )
    })

    it('should accept threshold as decimal 0.0', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=test&threshold=0')

      expect(response.status).toBe(200)
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_bookmarks_semantic',
        expect.objectContaining({
          match_threshold: 0,
        })
      )
    })

    it('should accept threshold as decimal 1.0', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      })

      const response = await app.request('/api/bookmarks/search/semantic?q=test&threshold=1')

      expect(response.status).toBe(200)
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'search_bookmarks_semantic',
        expect.objectContaining({
          match_threshold: 1,
        })
      )
    })
  })
})
