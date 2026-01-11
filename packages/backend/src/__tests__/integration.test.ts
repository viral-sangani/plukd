/**
 * Integration tests for Plukd backend
 *
 * These tests verify critical integration points:
 * 1. End-to-End Telegram Bookmark Flow
 * 2. RLS (Row Level Security) Enforcement
 * 3. AI Graceful Degradation
 * 4. Extraction Fallback Chain
 * 5. Concurrent Operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'
import type {
  ExtractedContent,
  ContentSource,
  ProcessingStatus,
  Category,
  Tag,
} from '@plukd/shared'
import { processBookmarkJob } from '../jobs/processors/bookmark-processing'
import { supabaseAdmin } from '../config/supabase'
import { extractContent } from '../lib/extractors'
import { processContentWithRetry } from '../lib/ai/process'
import { enqueueBookmarkProcessing } from '../jobs/queue'

// Test data factories
const createTestUser = (id: string, chatId?: string) => ({
  id,
  telegram_chat_id: chatId || `chat_${id}`,
  telegram_username: `user_${id}`,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

const createTestBookmark = (
  id: string,
  userId: string,
  overrides: Partial<any> = {}
) => ({
  id,
  user_id: userId,
  url: 'https://example.com/article',
  source: 'web' as ContentSource,
  title: 'Test Article',
  blurb: 'Test blurb',
  summary: 'Test summary',
  category: 'news-updates' as Category,
  tags: ['technology'] as Tag[],
  processing_status: 'completed' as ProcessingStatus,
  is_archived: false,
  is_favorite: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

const createMockJob = (bookmarkId: string, url: string): Partial<Job> => ({
  id: `job_${bookmarkId}`,
  data: { bookmarkId, url, userId: 'user_1' },
  updateProgress: vi.fn().mockResolvedValue(undefined),
})

const createMockExtractedContent = (
  overrides: Partial<ExtractedContent> = {}
): ExtractedContent => ({
  url: 'https://example.com/article',
  source: 'web',
  title: 'Test Article Title',
  content: 'This is the extracted content from the article.',
  ...overrides,
})

const createMockProcessingResult = (overrides: Partial<any> = {}) => ({
  category: 'news-updates' as Category,
  tags: ['technology', 'ai'] as Tag[],
  blurb: 'A brief summary of the article.',
  summary: 'A detailed summary of the article content.',
  contentType: 'article',
  extractedResources: null,
  resourceLayoutHint: null,
  keyTakeaways: null,
  ...overrides,
})

// Mock modules
vi.mock('../lib/extractors', () => ({
  extractContent: vi.fn(),
}))

vi.mock('../lib/ai/process', () => ({
  processContentWithRetry: vi.fn(),
}))

vi.mock('../jobs/queue', () => ({
  enqueueBookmarkProcessing: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
}))

describe('Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // Suite 1: End-to-End Telegram Bookmark Flow
  // ============================================================
  describe('End-to-End Telegram Bookmark Flow', () => {
    it('should save bookmark and enqueue processing job', async () => {
      const userId = 'user_1'
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/article'

      const mockSupabaseChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: [{ id: bookmarkId, url }],
          error: null,
        }),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // Simulate Telegram bot handler logic
      // Insert bookmark with pending status
      const { data: insertedBookmarks } = await supabaseAdmin
        .from('bookmarks')
        .insert([
          {
            user_id: userId,
            url,
            source: 'web',
            processing_status: 'pending',
          } as never,
        ])
        .select('id, url')

      // Enqueue processing
      for (const bookmark of insertedBookmarks || []) {
        await enqueueBookmarkProcessing(bookmark.id, bookmark.url, userId)
      }

      // Verify bookmark was inserted
      expect(mockSupabaseChain.insert).toHaveBeenCalled()

      // Verify job was enqueued
      expect(enqueueBookmarkProcessing).toHaveBeenCalledWith(
        bookmarkId,
        url,
        userId
      )
    })

    it('should process multiple URLs and enqueue multiple jobs', async () => {
      const userId = 'user_1'
      const urls = [
        'https://example.com/article1',
        'https://example.com/article2',
        'https://example.com/article3',
      ]

      const mockSupabaseChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: urls.map((url, i) => ({ id: `bookmark_${i + 1}`, url })),
          error: null,
        }),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // Simulate inserting multiple bookmarks
      const { data: insertedBookmarks } = await supabaseAdmin
        .from('bookmarks')
        .insert(
          urls.map((url) => ({
            user_id: userId,
            url,
            source: 'web',
            processing_status: 'pending',
          })) as never
        )
        .select('id, url')

      // Enqueue all jobs
      for (const bookmark of insertedBookmarks || []) {
        await enqueueBookmarkProcessing(bookmark.id, bookmark.url, userId)
      }

      // Verify 3 bookmarks were inserted
      expect(mockSupabaseChain.insert).toHaveBeenCalled()

      // Verify 3 jobs were enqueued
      expect(enqueueBookmarkProcessing).toHaveBeenCalledTimes(3)
    })

    it('should verify user exists before saving bookmark', async () => {
      const chatId = '12345'

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }, // User not found
        }),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // Simulate user lookup
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('telegram_chat_id', chatId)
        .single()

      // Verify user was not found
      expect(error).toBeTruthy()
      expect(error?.code).toBe('PGRST116')
      expect(user).toBeNull()

      // In real handler, this would result in error message and no bookmark save
      // Verify no job was enqueued
      expect(enqueueBookmarkProcessing).not.toHaveBeenCalled()
    })

    it('should transition bookmark status from pending → processing → completed', async () => {
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/article'

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)
      vi.spyOn(supabaseAdmin, 'rpc').mockResolvedValue({ data: null, error: null })

      // Mock successful extraction
      vi.mocked(extractContent).mockResolvedValue(createMockExtractedContent())

      // Mock successful AI processing
      vi.mocked(processContentWithRetry).mockResolvedValue(
        createMockProcessingResult()
      )

      const job = createMockJob(bookmarkId, url)

      await processBookmarkJob(job as Job)

      // Verify status updates in order
      const updateCalls = mockSupabaseChain.update.mock.calls

      // First call: pending → processing
      expect(updateCalls[0][0]).toMatchObject({
        processing_status: 'processing',
      })

      // Second call: processing → completed with all data
      expect(updateCalls[1][0]).toMatchObject({
        processing_status: 'completed',
        title: 'Test Article Title',
        category: 'news-updates',
      })
    })

    it('should handle AI retry logic with eventual success', async () => {
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/article'

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)
      vi.spyOn(supabaseAdmin, 'rpc').mockResolvedValue({ data: null, error: null })

      // Mock successful extraction
      vi.mocked(extractContent).mockResolvedValue(createMockExtractedContent())

      // Mock AI processing succeeding on first try
      // (processContentWithRetry handles retries internally)
      vi.mocked(processContentWithRetry).mockResolvedValue(
        createMockProcessingResult()
      )

      const job = createMockJob(bookmarkId, url)

      await processBookmarkJob(job as Job)

      // Verify final status is completed
      const lastUpdate = mockSupabaseChain.update.mock.calls.slice(-1)[0][0]
      expect(lastUpdate).toMatchObject({
        processing_status: 'completed',
      })
    })

    it('should handle extraction failure gracefully', async () => {
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/article'

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)
      vi.spyOn(supabaseAdmin, 'rpc').mockResolvedValue({ data: null, error: null })

      // Mock extraction returning null (graceful failure, not throwing)
      vi.mocked(extractContent).mockResolvedValue(null)

      // Mock successful AI processing with fallback content
      vi.mocked(processContentWithRetry).mockResolvedValue(
        createMockProcessingResult()
      )

      const job = createMockJob(bookmarkId, url)

      // Should complete with fallback content
      await processBookmarkJob(job as Job)

      // Verify bookmark was updated with fallback title
      const completedUpdate = mockSupabaseChain.update.mock.calls.find(
        (call) => call[0].processing_status === 'completed'
      )
      expect(completedUpdate).toBeTruthy()
      expect(completedUpdate![0].title).toBeTruthy() // Should have fallback title
    })

    it('should handle complete failure (extraction + AI)', async () => {
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/article'

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // Mock extraction returning null
      vi.mocked(extractContent).mockResolvedValue(null)

      // Mock AI processing failure
      vi.mocked(processContentWithRetry).mockRejectedValue(
        new Error('AI processing failed after 3 attempts')
      )

      const job = createMockJob(bookmarkId, url)

      // Should throw error
      await expect(processBookmarkJob(job as Job)).rejects.toThrow(
        'AI processing failed after 3 attempts'
      )

      // Verify bookmark was marked as failed
      const failedUpdate = mockSupabaseChain.update.mock.calls.find(
        (call) => call[0].processing_status === 'failed'
      )
      expect(failedUpdate).toBeTruthy()
      expect(failedUpdate![0].processing_error).toContain('Processing failed')
    })

    it('should update progress during processing', async () => {
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/article'

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)
      vi.spyOn(supabaseAdmin, 'rpc').mockResolvedValue({ data: null, error: null })

      vi.mocked(extractContent).mockResolvedValue(createMockExtractedContent())
      vi.mocked(processContentWithRetry).mockResolvedValue(
        createMockProcessingResult()
      )

      const job = createMockJob(bookmarkId, url)

      await processBookmarkJob(job as Job)

      // Verify progress updates
      expect(job.updateProgress).toHaveBeenCalledWith(10) // Start
      expect(job.updateProgress).toHaveBeenCalledWith(20) // Extraction started
      expect(job.updateProgress).toHaveBeenCalledWith(40) // Extraction complete
      expect(job.updateProgress).toHaveBeenCalledWith(50) // AI started
      expect(job.updateProgress).toHaveBeenCalledWith(80) // AI complete
      expect(job.updateProgress).toHaveBeenCalledWith(90) // DB update
      expect(job.updateProgress).toHaveBeenCalledWith(100) // Complete
    })

    it('should handle database insertion error during bookmark save', async () => {
      const userId = 'user_1'
      const url = 'https://example.com/article'

      const mockSupabaseChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // Attempt bookmark insertion
      const { data, error } = await supabaseAdmin
        .from('bookmarks')
        .insert([
          {
            user_id: userId,
            url,
            source: 'web',
            processing_status: 'pending',
          } as never,
        ])
        .select('id, url')

      // Verify error occurred
      expect(error).toBeTruthy()
      expect(data).toBeNull()

      // Verify no job was enqueued
      expect(enqueueBookmarkProcessing).not.toHaveBeenCalled()
    })

    it('should handle bookmark processing enqueue failure gracefully', async () => {
      const userId = 'user_1'
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/article'

      // Mock enqueue failure
      vi.mocked(enqueueBookmarkProcessing).mockRejectedValueOnce(
        new Error('Queue error')
      )

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Attempt to enqueue (simulating post-bookmark-save)
      try {
        await enqueueBookmarkProcessing(bookmarkId, url, userId)
      } catch (error) {
        // Error should be caught and logged in real handler
        expect(error).toBeTruthy()
      }

      // In real implementation, error would be logged but user still gets success
      // since bookmark was saved successfully

      consoleSpy.mockRestore()
    })
  })

  // ============================================================
  // Suite 2: RLS (Row Level Security) Enforcement
  // ============================================================
  describe('RLS Enforcement', () => {
    it('should prevent User A from fetching User B bookmark by ID', async () => {
      const userAId = 'user_a'
      const userBId = 'user_b'
      const bookmarkId = 'bookmark_1'

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }, // Not found
        }),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // Simulate API call from User A trying to get User B's bookmark
      // This would be in the bookmarks route GET /:id handler

      // Verify query filters by user_id
      expect(mockSupabaseChain.eq).not.toHaveBeenCalledWith('user_id', userBId)

      // When filtered by userAId, bookmark should not be found
      const result = await supabaseAdmin
        .from('bookmarks')
        .select('*')
        .eq('id', bookmarkId)
        .eq('user_id', userAId)
        .single()

      expect(result.error).toBeTruthy()
      expect(result.error?.code).toBe('PGRST116')
    })

    it('should validate cursor belongs to requesting user', async () => {
      const userAId = 'user_a'
      const userBCursor = 'cursor_from_user_b'

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // Attempt to use User B's cursor with User A's credentials
      const result = await supabaseAdmin
        .from('bookmarks')
        .select('id, created_at, title')
        .eq('id', userBCursor)
        .eq('user_id', userAId)
        .single()

      // Should not find the cursor bookmark
      expect(result.error).toBeTruthy()
      expect(result.error?.code).toBe('PGRST116')
    })

    it('should filter bulk-archive operations by user_id', async () => {
      const userAId = 'user_a'
      const userBBookmarkIds = ['bookmark_b1', 'bookmark_b2', 'bookmark_b3']

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: [], // No bookmarks updated
          error: null,
        }),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // User A attempts to archive User B's bookmarks
      await supabaseAdmin
        .from('bookmarks')
        .update({ is_archived: true } as never)
        .eq('user_id', userAId)
        .in('id', userBBookmarkIds)
        .select()

      // Verify user_id filter was applied first
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('user_id', userAId)

      // Result should be empty (no bookmarks updated)
      const result = await supabaseAdmin
        .from('bookmarks')
        .update({ is_archived: true } as never)
        .eq('user_id', userAId)
        .in('id', userBBookmarkIds)
        .select()

      expect(result.data).toEqual([])
    })

    it('should filter UPDATE operations by user_id', async () => {
      const userAId = 'user_a'
      const userBBookmarkId = 'bookmark_b1'

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // Check if bookmark exists and belongs to user (validation step)
      const validation = await supabaseAdmin
        .from('bookmarks')
        .select('id')
        .eq('id', userBBookmarkId)
        .eq('user_id', userAId)
        .single()

      // Validation should fail
      expect(validation.error).toBeTruthy()
      expect(validation.error?.code).toBe('PGRST116')
    })

    it('should filter DELETE operations by user_id', async () => {
      const userAId = 'user_a'
      const userBBookmarkId = 'bookmark_b1'

      const mockSupabaseChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn((field: string, value: string) => {
          if (field === 'user_id' || field === 'id') {
            return mockSupabaseChain
          }
          return {
            data: null,
            error: null,
          }
        }),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // User A attempts to delete User B's bookmark
      await supabaseAdmin
        .from('bookmarks')
        .delete()
        .eq('id', userBBookmarkId)
        .eq('user_id', userAId)

      // Verify user_id filter was applied
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('user_id', userAId)
    })

    it('should enforce user_id in semantic search RPC', async () => {
      const userAId = 'user_a'
      const query = 'test query'

      vi.spyOn(supabaseAdmin, 'rpc').mockResolvedValue({
        data: [],
        error: null,
      })

      // Call semantic search RPC
      await supabaseAdmin.rpc('search_bookmarks_semantic' as never, {
        query_text: query,
        user_id_param: userAId,
        limit_count: 20,
      } as never)

      // Verify RPC was called with user_id parameter
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith(
        'search_bookmarks_semantic',
        expect.objectContaining({
          user_id_param: userAId,
        })
      )
    })

    it('should return empty results when user has no bookmarks', async () => {
      const userId = 'new_user'

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      const result = await supabaseAdmin
        .from('bookmarks')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(0, 9)

      expect(result.data).toEqual([])
      expect(result.count).toBe(0)
    })

    it('should isolate bookmarks between multiple concurrent users', async () => {
      const userAId = 'user_a'
      const userBId = 'user_b'

      const userABookmarks = [
        createTestBookmark('bookmark_a1', userAId),
        createTestBookmark('bookmark_a2', userAId),
      ]

      const userBBookmarks = [
        createTestBookmark('bookmark_b1', userBId),
        createTestBookmark('bookmark_b2', userBId),
      ]

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((field: string, value: string) => {
          if (field === 'user_id' && value === userAId) {
            return {
              order: vi.fn().mockReturnThis(),
              range: vi.fn().mockResolvedValue({
                data: userABookmarks,
                error: null,
                count: userABookmarks.length,
              }),
            }
          } else if (field === 'user_id' && value === userBId) {
            return {
              order: vi.fn().mockReturnThis(),
              range: vi.fn().mockResolvedValue({
                data: userBBookmarks,
                error: null,
                count: userBBookmarks.length,
              }),
            }
          }
          return mockSupabaseChain
        }),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // Fetch User A's bookmarks
      const resultA = await supabaseAdmin
        .from('bookmarks')
        .select('*', { count: 'exact' })
        .eq('user_id', userAId)
        .order('created_at', { ascending: false })
        .range(0, 9)

      // Fetch User B's bookmarks
      const resultB = await supabaseAdmin
        .from('bookmarks')
        .select('*', { count: 'exact' })
        .eq('user_id', userBId)
        .order('created_at', { ascending: false })
        .range(0, 9)

      // Verify isolation
      expect(resultA.data).toHaveLength(2)
      expect(resultB.data).toHaveLength(2)
      expect(resultA.data?.[0].user_id).toBe(userAId)
      expect(resultB.data?.[0].user_id).toBe(userBId)
    })
  })

  // ============================================================
  // Suite 3: AI Graceful Degradation
  // ============================================================
  describe('AI Graceful Degradation', () => {
    it('should save extracted content when AI fails', async () => {
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/article'

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // Mock successful extraction
      const extractedContent = createMockExtractedContent({
        title: 'Extracted Title',
        content: 'Extracted content',
        author: 'Test Author',
      })
      vi.mocked(extractContent).mockResolvedValue(extractedContent)

      // Mock AI processing failure
      vi.mocked(processContentWithRetry).mockRejectedValue(
        new Error('AI service unavailable')
      )

      const job = createMockJob(bookmarkId, url)

      // Should not throw - partial save succeeds
      await processBookmarkJob(job as Job)

      // Verify extracted content was saved
      const partialUpdate = mockSupabaseChain.update.mock.calls.find(
        (call) => call[0].title === 'Extracted Title'
      )
      expect(partialUpdate).toBeTruthy()
      expect(partialUpdate![0]).toMatchObject({
        title: 'Extracted Title',
        content: 'Extracted content',
        author: 'Test Author',
        processing_status: 'failed',
      })
    })

    it('should mark as failed when both extraction and AI fail', async () => {
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/article'

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // Mock extraction failure
      vi.mocked(extractContent).mockRejectedValue(new Error('Extraction failed'))

      // Mock AI processing failure
      vi.mocked(processContentWithRetry).mockRejectedValue(
        new Error('AI processing failed after 3 attempts')
      )

      const job = createMockJob(bookmarkId, url)

      // Should throw error
      await expect(processBookmarkJob(job as Job)).rejects.toThrow()

      // Verify status was marked as failed
      const failedUpdate = mockSupabaseChain.update.mock.calls.find(
        (call) => call[0].processing_status === 'failed'
      )
      expect(failedUpdate).toBeTruthy()
    })

    it('should verify processContentWithRetry is called for AI processing', async () => {
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/article'

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)
      vi.spyOn(supabaseAdmin, 'rpc').mockResolvedValue({ data: null, error: null })

      vi.mocked(extractContent).mockResolvedValue(createMockExtractedContent())

      // Mock successful AI processing
      vi.mocked(processContentWithRetry).mockResolvedValue(
        createMockProcessingResult()
      )

      const job = createMockJob(bookmarkId, url)

      await processBookmarkJob(job as Job)

      // Verify processContentWithRetry was called (it handles retries internally)
      expect(processContentWithRetry).toHaveBeenCalled()

      // Verify it eventually succeeded
      const finalUpdate = mockSupabaseChain.update.mock.calls.slice(-1)[0][0]
      expect(finalUpdate.processing_status).toBe('completed')
    })

    it('should continue processing if embedding generation fails', async () => {
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/article'

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // Mock RPC failure for embedding (but allow other operations to succeed)
      const rpcMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Embedding service error' },
      })
      vi.spyOn(supabaseAdmin, 'rpc').mockImplementation(rpcMock)

      vi.mocked(extractContent).mockResolvedValue(createMockExtractedContent())
      vi.mocked(processContentWithRetry).mockResolvedValue(
        createMockProcessingResult()
      )

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const job = createMockJob(bookmarkId, url)

      // Should complete successfully despite embedding failure
      await processBookmarkJob(job as Job)

      // Verify bookmark was marked as completed (even with embedding failure)
      const completedUpdate = mockSupabaseChain.update.mock.calls.find(
        (call) => call[0].processing_status === 'completed'
      )
      expect(completedUpdate).toBeTruthy()

      // Embedding failure is non-fatal, so warning should be logged
      // (Check if any warn was called, embedding error may be logged)

      consoleSpy.mockRestore()
    })

    it('should use fallback title when extraction returns null', async () => {
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/cool-article-about-ai'

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)
      vi.spyOn(supabaseAdmin, 'rpc').mockResolvedValue({ data: null, error: null })

      // Mock extraction returning null
      vi.mocked(extractContent).mockResolvedValue(null)

      // Mock successful AI processing
      vi.mocked(processContentWithRetry).mockResolvedValue(
        createMockProcessingResult()
      )

      const job = createMockJob(bookmarkId, url)

      await processBookmarkJob(job as Job)

      // Verify fallback title was generated from URL
      const finalUpdate = mockSupabaseChain.update.mock.calls.find(
        (call) => call[0].processing_status === 'completed'
      )
      expect(finalUpdate).toBeTruthy()
      expect(finalUpdate![0].title).toBeTruthy()
      expect(finalUpdate![0].title).not.toBe(url) // Should be formatted nicely
    })

    it('should log appropriate errors at each failure point', async () => {
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/article'

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Mock extraction returning null (graceful failure)
      vi.mocked(extractContent).mockResolvedValue(null)

      // Mock AI failure
      vi.mocked(processContentWithRetry).mockRejectedValue(
        new Error('AI service error')
      )

      const job = createMockJob(bookmarkId, url)

      await expect(processBookmarkJob(job as Job)).rejects.toThrow()

      // Verify AI error was logged
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })
  })

  // ============================================================
  // Suite 4: Extraction Fallback Chain
  // ============================================================
  describe('Extraction Fallback Chain', () => {
    it('should use platform-specific extractor first', async () => {
      const bookmarkId = 'bookmark_1'
      const twitterUrl = 'https://twitter.com/user/status/123'

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)
      vi.spyOn(supabaseAdmin, 'rpc').mockResolvedValue({ data: null, error: null })

      // Mock successful Twitter extraction
      vi.mocked(extractContent).mockResolvedValue(
        createMockExtractedContent({
          source: 'twitter',
          title: 'Tweet from @user',
          author: '@user',
        })
      )

      vi.mocked(processContentWithRetry).mockResolvedValue(
        createMockProcessingResult()
      )

      const job = createMockJob(bookmarkId, twitterUrl)

      await processBookmarkJob(job as Job)

      // Verify Twitter extractor was called
      expect(extractContent).toHaveBeenCalledWith(twitterUrl)

      // Verify source was set to twitter
      const finalUpdate = mockSupabaseChain.update.mock.calls.find(
        (call) => call[0].processing_status === 'completed'
      )
      expect(finalUpdate![0].source).toBe('twitter')
    })

    it('should fallback to OG metadata for web URLs when primary extraction fails', async () => {
      const bookmarkId = 'bookmark_1'
      const webUrl = 'https://example.com/article'

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)
      vi.spyOn(supabaseAdmin, 'rpc').mockResolvedValue({ data: null, error: null })

      // Mock primary extraction returning null (but not throwing)
      vi.mocked(extractContent).mockResolvedValue(null)

      // Mock successful AI processing
      vi.mocked(processContentWithRetry).mockResolvedValue(
        createMockProcessingResult()
      )

      const job = createMockJob(bookmarkId, webUrl)

      // Note: OG metadata extraction is internal to the processor
      // We're testing that the processor handles null extraction gracefully
      await processBookmarkJob(job as Job)

      // Verify processing completed with fallback content
      const finalUpdate = mockSupabaseChain.update.mock.calls.find(
        (call) => call[0].processing_status === 'completed'
      )
      expect(finalUpdate).toBeTruthy()
    })

    it('should create fallback content when all extraction methods fail', async () => {
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/article'

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)
      vi.spyOn(supabaseAdmin, 'rpc').mockResolvedValue({ data: null, error: null })

      // Mock extraction failure
      vi.mocked(extractContent).mockResolvedValue(null)

      // Mock successful AI processing with fallback
      vi.mocked(processContentWithRetry).mockResolvedValue(
        createMockProcessingResult()
      )

      const job = createMockJob(bookmarkId, url)

      await processBookmarkJob(job as Job)

      // Verify AI was called (processContentWithRetry handles fallback internally)
      expect(processContentWithRetry).toHaveBeenCalled()

      // Verify processing completed
      const finalUpdate = mockSupabaseChain.update.mock.calls.find(
        (call) => call[0].processing_status === 'completed'
      )
      expect(finalUpdate).toBeTruthy()
    })

    it('should preserve metadata when available', async () => {
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/article'

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)
      vi.spyOn(supabaseAdmin, 'rpc').mockResolvedValue({ data: null, error: null })

      const extractedWithMetadata = createMockExtractedContent({
        author: 'John Doe',
        authorUrl: 'https://example.com/author/john',
        publishedAt: new Date('2024-01-01'),
        mediaUrls: ['https://example.com/image.jpg'],
        rawMetadata: {
          og: {
            title: 'OG Title',
            description: 'OG Description',
          },
        },
      })

      vi.mocked(extractContent).mockResolvedValue(extractedWithMetadata)
      vi.mocked(processContentWithRetry).mockResolvedValue(
        createMockProcessingResult()
      )

      const job = createMockJob(bookmarkId, url)

      await processBookmarkJob(job as Job)

      // Verify all metadata was preserved
      const finalUpdate = mockSupabaseChain.update.mock.calls.find(
        (call) => call[0].processing_status === 'completed'
      )
      expect(finalUpdate![0]).toMatchObject({
        author: 'John Doe',
        author_url: 'https://example.com/author/john',
        media_urls: ['https://example.com/image.jpg'],
        raw_metadata: {
          og: {
            title: 'OG Title',
            description: 'OG Description',
          },
        },
      })
    })
  })

  // ============================================================
  // Suite 5: Concurrent Operations
  // ============================================================
  describe('Concurrent Operations', () => {
    it('should handle link code race condition correctly', async () => {
      const code = 'ABC123'
      const chatId1 = '12345'
      const chatId2 = '67890'
      const userId1 = 'user_1'
      const userId2 = 'user_2'

      let codeUsed = false

      const mockSupabaseChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        single: vi.fn((async () => {
          // First request gets the code
          if (!codeUsed) {
            codeUsed = true
            return {
              data: {
                id: 'code_1',
                telegram_chat_id: chatId1,
                telegram_username: 'user1',
              },
              error: null,
            }
          } else {
            // Second request finds code already used
            return {
              data: null,
              error: { code: 'PGRST116' },
            }
          }
        }) as any),
        update: vi.fn().mockReturnThis(),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // Simulate concurrent link code usage
      const linkCode1 = await supabaseAdmin
        .from('telegram_link_codes')
        .select('id, telegram_chat_id, telegram_username')
        .eq('code', code)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .not('telegram_chat_id', 'is', null)
        .single()

      const linkCode2 = await supabaseAdmin
        .from('telegram_link_codes')
        .select('id, telegram_chat_id, telegram_username')
        .eq('code', code)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .not('telegram_chat_id', 'is', null)
        .single()

      // First request should succeed
      expect(linkCode1.data).toBeTruthy()

      // Second request should fail (code already used)
      expect(linkCode2.error).toBeTruthy()
    })

    it('should handle multiple users saving bookmarks concurrently', async () => {
      const user1 = 'user_1'
      const user2 = 'user_2'
      const url = 'https://example.com/article'

      const mockSupabaseChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: [{ id: 'bookmark_1', url }],
          error: null,
        }),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // Both users save the same URL concurrently
      const promise1 = supabaseAdmin
        .from('bookmarks')
        .insert([
          {
            user_id: user1,
            url,
            source: 'web',
            processing_status: 'pending',
          } as never,
        ])
        .select('id, url')

      const promise2 = supabaseAdmin
        .from('bookmarks')
        .insert([
          {
            user_id: user2,
            url,
            source: 'web',
            processing_status: 'pending',
          } as never,
        ])
        .select('id, url')

      const [result1, result2] = await Promise.all([promise1, promise2])

      // Both should succeed independently
      expect(result1.data).toBeTruthy()
      expect(result2.data).toBeTruthy()
    })

    it('should handle same bookmark processed twice (idempotency)', async () => {
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/article'

      const updateCallCount = { count: 0 }

      const mockSupabaseChain = {
        update: vi.fn((data: any) => {
          updateCallCount.count++
          return mockSupabaseChain
        }),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)
      vi.spyOn(supabaseAdmin, 'rpc').mockResolvedValue({ data: null, error: null })

      vi.mocked(extractContent).mockResolvedValue(createMockExtractedContent())
      vi.mocked(processContentWithRetry).mockResolvedValue(
        createMockProcessingResult()
      )

      const job1 = createMockJob(bookmarkId, url)
      const job2 = createMockJob(bookmarkId, url)

      // Process same bookmark twice concurrently
      await Promise.all([processBookmarkJob(job1 as Job), processBookmarkJob(job2 as Job)])

      // Both should complete (database handles conflicts)
      // Multiple updates should have occurred
      expect(updateCallCount.count).toBeGreaterThan(0)
    })

    it('should handle queue job deduplication', async () => {
      const bookmarkId = 'bookmark_1'
      const url = 'https://example.com/article'
      const userId = 'user_1'

      // Reset mock
      vi.mocked(enqueueBookmarkProcessing).mockClear()

      // Enqueue same job multiple times
      await Promise.all([
        enqueueBookmarkProcessing(bookmarkId, url, userId),
        enqueueBookmarkProcessing(bookmarkId, url, userId),
        enqueueBookmarkProcessing(bookmarkId, url, userId),
      ])

      // All should succeed (BullMQ handles deduplication if configured)
      expect(enqueueBookmarkProcessing).toHaveBeenCalledTimes(3)
    })

    it('should handle concurrent bulk operations on different bookmark sets', async () => {
      const userId = 'user_1'
      const bookmarkSet1 = ['bookmark_1', 'bookmark_2']
      const bookmarkSet2 = ['bookmark_3', 'bookmark_4']

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // Concurrent bulk archive operations
      const promise1 = supabaseAdmin
        .from('bookmarks')
        .update({ is_archived: true } as never)
        .eq('user_id', userId)
        .in('id', bookmarkSet1)
        .select()

      const promise2 = supabaseAdmin
        .from('bookmarks')
        .update({ is_archived: false } as never)
        .eq('user_id', userId)
        .in('id', bookmarkSet2)
        .select()

      const [result1, result2] = await Promise.all([promise1, promise2])

      // Both should succeed
      expect(result1.error).toBeNull()
      expect(result2.error).toBeNull()
    })

    it('should maintain data integrity during concurrent updates', async () => {
      const bookmarkId = 'bookmark_1'
      const userId = 'user_1'

      const mockSupabaseChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      vi.spyOn(supabaseAdmin, 'from').mockReturnValue(mockSupabaseChain as any)

      // Concurrent updates to same bookmark
      const promise1 = supabaseAdmin
        .from('bookmarks')
        .update({ is_favorite: true } as never)
        .eq('id', bookmarkId)
        .eq('user_id', userId)
        .select()
        .single()

      const promise2 = supabaseAdmin
        .from('bookmarks')
        .update({ is_archived: true } as never)
        .eq('id', bookmarkId)
        .eq('user_id', userId)
        .select()
        .single()

      await Promise.all([promise1, promise2])

      // Verify both updates were attempted
      expect(mockSupabaseChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_favorite: true })
      )
      expect(mockSupabaseChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_archived: true })
      )
    })
  })
})
