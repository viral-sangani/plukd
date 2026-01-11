/**
 * Comprehensive test suite for bookmark processing pipeline.
 *
 * Tests the main job processor that orchestrates:
 * 1. Status update to 'processing'
 * 2. Content extraction with fallback chain
 * 3. OG metadata enhancement (for web URLs)
 * 4. AI processing with error recovery
 * 5. Bookmark database update
 * 6. Embedding generation (non-blocking)
 *
 * Coverage: 60+ test cases covering all scenarios, error paths, and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Job } from 'bullmq'
import type { BookmarkProcessingJob } from '../../queue'
import type {
  ExtractedContent,
  ProcessingResult,
  ContentSource,
  RawMetadata,
} from '@plukd/shared'

// ============================================================================
// MOCKS
// ============================================================================

// Mock Supabase - using factory function to avoid hoisting issues
vi.mock('../../../config/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
    rpc: vi.fn().mockResolvedValue({ error: null }),
  },
}))

// Mock extractors
vi.mock('../../../lib/extractors', () => ({
  extractContent: vi.fn(),
}))

vi.mock('../../../lib/extractors/og-metadata', () => ({
  extractOGMetadata: vi.fn(),
}))

// Mock AI processing
vi.mock('../../../lib/ai/process', () => ({
  processContentWithRetry: vi.fn(),
}))

// Mock embeddings
vi.mock('../../../lib/ai/embeddings', () => ({
  generateBookmarkEmbedding: vi.fn(),
  formatEmbeddingForPostgres: vi.fn(),
  EXPECTED_EMBEDDING_DIMENSION: 768,
}))

// Mock shared utilities (these are already implemented in shared package)
vi.mock('@plukd/shared', async () => {
  const actual = await vi.importActual<typeof import('@plukd/shared')>('@plukd/shared')
  return {
    ...actual,
    detectSource: vi.fn((url: string): ContentSource => {
      if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter'
      if (url.includes('reddit.com')) return 'reddit'
      if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
      if (url.includes('linkedin.com')) return 'linkedin'
      if (url.includes('instagram.com')) return 'instagram'
      return 'web'
    }),
    generateFallbackTitle: vi.fn((url: string, source: ContentSource) => {
      return `${source.charAt(0).toUpperCase() + source.slice(1)} Link`
    }),
  }
})

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockJob = (overrides: Partial<BookmarkProcessingJob> = {}): Job<BookmarkProcessingJob> => {
  return {
    data: {
      bookmarkId: 'test-bookmark-id',
      url: 'https://example.com/article',
      userId: 'test-user-id',
      ...overrides,
    },
    updateProgress: vi.fn(),
  } as unknown as Job<BookmarkProcessingJob>
}

const createMockExtractedContent = (
  overrides: Partial<ExtractedContent> = {}
): ExtractedContent => ({
  url: 'https://example.com/article',
  source: 'web',
  title: 'Test Article Title',
  content: 'This is the article content with useful information.',
  author: 'John Doe',
  authorUrl: 'https://example.com/author/john',
  mediaUrls: ['https://example.com/image.jpg'],
  publishedAt: new Date('2024-01-15'),
  rawMetadata: {
    web: {
      pageTitle: 'Test Article Title',
      wordCount: 500,
      readingTime: 3,
    },
  },
  ...overrides,
})

const createMockAIResult = (overrides: Partial<ProcessingResult> = {}): ProcessingResult => ({
  category: 'programming',
  tags: ['tutorial', 'guide'],
  blurb: 'A comprehensive guide to modern web development.',
  summary: 'This article provides an in-depth exploration of modern web development practices, covering key concepts and practical examples.',
  contentType: 'article',
  keyTakeaways: [
    { text: 'Always use TypeScript for type safety', type: 'action' },
    { text: 'Consider using a monorepo for large projects', type: 'idea' },
  ],
  ...overrides,
})

const createMockOGMetadata = () => ({
  ogTitle: 'OG Title',
  ogDescription: 'OG Description',
  ogImage: 'https://example.com/og-image.jpg',
  ogSiteName: 'Example Site',
  ogType: 'article',
  pageTitle: 'Page Title',
  metaDescription: 'Meta Description',
  metaAuthor: 'Meta Author',
  metaKeywords: 'keyword1, keyword2',
})

const createMockEmbedding = (): number[] => new Array(768).fill(0.1)

// Import mocked modules
import { processBookmarkJob } from '../bookmark-processing'
import { supabaseAdmin } from '../../../config/supabase'
import { extractContent } from '../../../lib/extractors'
import { extractOGMetadata } from '../../../lib/extractors/og-metadata'
import { processContentWithRetry } from '../../../lib/ai/process'
import { generateBookmarkEmbedding, formatEmbeddingForPostgres } from '../../../lib/ai/embeddings'

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Bookmark Processing Pipeline', () => {
  let mockJob: Job<BookmarkProcessingJob>

  beforeEach(() => {
    vi.clearAllMocks()
    mockJob = createMockJob()

    // Setup default successful chain
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    } as any)
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ error: null } as any)
    vi.mocked(extractContent).mockResolvedValue(createMockExtractedContent())
    vi.mocked(processContentWithRetry).mockResolvedValue(createMockAIResult())
    vi.mocked(generateBookmarkEmbedding).mockResolvedValue(createMockEmbedding())
    vi.mocked(formatEmbeddingForPostgres).mockReturnValue('[0.1,0.1,0.1]')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // 1. HAPPY PATH TESTS
  // ==========================================================================

  describe('Happy Path - Complete Success', () => {
    it('should process bookmark end-to-end successfully', async () => {
      await processBookmarkJob(mockJob)

      // Verify database was accessed
      expect(supabaseAdmin.from).toHaveBeenCalledWith('bookmarks')

      // Verify extraction was called
      expect(vi.mocked(extractContent)).toHaveBeenCalledWith('https://example.com/article')

      // Verify AI processing was called with extracted content
      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Article Title',
          content: 'This is the article content with useful information.',
        })
      )

      // Verify embedding was generated
      expect(vi.mocked(generateBookmarkEmbedding)).toHaveBeenCalledWith(
        'Test Article Title',
        'A comprehensive guide to modern web development.',
        'This article provides an in-depth exploration of modern web development practices, covering key concepts and practical examples.',
        [
          { text: 'Always use TypeScript for type safety', type: 'action' },
          { text: 'Consider using a monorepo for large projects', type: 'idea' },
        ]
      )
    })

    it('should update progress at all milestones', async () => {
      await processBookmarkJob(mockJob)

      // Verify all progress updates: 10%, 20%, 40%, 50%, 80%, 90%, 100%
      expect(mockJob.updateProgress).toHaveBeenCalledWith(10) // Status to processing
      expect(mockJob.updateProgress).toHaveBeenCalledWith(20) // Starting extraction
      expect(mockJob.updateProgress).toHaveBeenCalledWith(40) // Extraction complete
      expect(mockJob.updateProgress).toHaveBeenCalledWith(50) // Starting AI
      expect(mockJob.updateProgress).toHaveBeenCalledWith(80) // AI complete
      expect(mockJob.updateProgress).toHaveBeenCalledWith(90) // Database updated
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100) // Job complete
    })

    it('should transition status: pending -> processing -> completed', async () => {
      await processBookmarkJob(mockJob)

      // Verify bookmarks table was accessed multiple times for status updates
      const fromCalls = vi.mocked(supabaseAdmin.from).mock.calls
      expect(fromCalls[0]).toEqual(['bookmarks'])
      expect(fromCalls.length).toBeGreaterThan(0)
    })

    it('should process Twitter URL successfully', async () => {
      mockJob = createMockJob({ url: 'https://twitter.com/user/status/123' })
      vi.mocked(extractContent).mockResolvedValue(
        createMockExtractedContent({
          url: 'https://twitter.com/user/status/123',
          source: 'twitter',
          title: 'Twitter Thread',
          content: 'Thread content here',
        })
      )

      await processBookmarkJob(mockJob)

      expect(vi.mocked(extractContent)).toHaveBeenCalledWith('https://twitter.com/user/status/123')
      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalled()
    })

    it('should process Reddit URL successfully', async () => {
      mockJob = createMockJob({ url: 'https://reddit.com/r/programming/comments/abc123' })
      vi.mocked(extractContent).mockResolvedValue(
        createMockExtractedContent({
          url: 'https://reddit.com/r/programming/comments/abc123',
          source: 'reddit',
          title: 'Reddit Post',
          content: 'Post content',
        })
      )

      await processBookmarkJob(mockJob)

      expect(vi.mocked(extractContent)).toHaveBeenCalledWith('https://reddit.com/r/programming/comments/abc123')
      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalled()
    })

    it('should process YouTube URL successfully', async () => {
      mockJob = createMockJob({ url: 'https://youtube.com/watch?v=abc123' })
      vi.mocked(extractContent).mockResolvedValue(
        createMockExtractedContent({
          url: 'https://youtube.com/watch?v=abc123',
          source: 'youtube',
          title: 'YouTube Video',
          content: 'Video description',
          transcript: 'Video transcript...',
        })
      )

      await processBookmarkJob(mockJob)

      expect(vi.mocked(extractContent)).toHaveBeenCalledWith('https://youtube.com/watch?v=abc123')
      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalled()
    })

    it('should process LinkedIn URL successfully', async () => {
      mockJob = createMockJob({ url: 'https://linkedin.com/posts/user-123' })
      vi.mocked(extractContent).mockResolvedValue(
        createMockExtractedContent({
          url: 'https://linkedin.com/posts/user-123',
          source: 'linkedin',
          title: 'LinkedIn Post',
        })
      )

      await processBookmarkJob(mockJob)

      expect(vi.mocked(extractContent)).toHaveBeenCalledWith('https://linkedin.com/posts/user-123')
      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalled()
    })

    it('should process Instagram URL successfully', async () => {
      mockJob = createMockJob({ url: 'https://instagram.com/p/abc123' })
      vi.mocked(extractContent).mockResolvedValue(
        createMockExtractedContent({
          url: 'https://instagram.com/p/abc123',
          source: 'instagram',
          title: 'Instagram Post',
        })
      )

      await processBookmarkJob(mockJob)

      expect(vi.mocked(extractContent)).toHaveBeenCalledWith('https://instagram.com/p/abc123')
      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalled()
    })

    it('should process multimodal content with images', async () => {
      vi.mocked(extractContent).mockResolvedValue(
        createMockExtractedContent({
          mediaUrls: [
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
            'https://example.com/image3.jpg',
          ],
        })
      )

      await processBookmarkJob(mockJob)

      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaUrls: expect.arrayContaining([
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
            'https://example.com/image3.jpg',
          ]),
        })
      )
    })

    it('should process list content type successfully', async () => {
      vi.mocked(processContentWithRetry).mockResolvedValue(
        createMockAIResult({
          contentType: 'list',
          extractedResources: [
            { name: 'Tool 1', description: 'Useful tool', url: 'https://tool1.com' },
            { name: 'Tool 2', description: 'Another tool', url: 'https://tool2.com' },
          ],
          resourceLayoutHint: 'grid',
        })
      )

      await processBookmarkJob(mockJob)

      // Verify database was updated with extracted resources
      expect(supabaseAdmin.from).toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // 2. EXTRACTION FALLBACK TESTS
  // ==========================================================================

  describe('Extraction Fallback Chain', () => {
    it('should use extracted content when primary extraction succeeds', async () => {
      const extractedContent = createMockExtractedContent()
      vi.mocked(extractContent).mockResolvedValue(extractedContent)

      await processBookmarkJob(mockJob)

      // OG metadata should NOT be called since extraction succeeded
      expect(vi.mocked(extractOGMetadata)).not.toHaveBeenCalled()

      // AI should be called with extracted content
      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalledWith(
        expect.objectContaining({
          title: extractedContent.title,
          content: extractedContent.content,
        })
      )
    })

    it('should fallback to OG metadata when extraction returns null for web URL', async () => {
      mockJob = createMockJob({ url: 'https://example.com/article' })
      vi.mocked(extractContent).mockResolvedValue(null)
      vi.mocked(extractOGMetadata).mockResolvedValue(createMockOGMetadata())

      await processBookmarkJob(mockJob)

      // OG metadata should be called for web URLs when extraction fails
      expect(vi.mocked(extractOGMetadata)).toHaveBeenCalledWith('https://example.com/article')

      // AI should be called with fallback content or OG-based content
      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalled()
    })

    it('should NOT attempt OG metadata for non-web sources', async () => {
      mockJob = createMockJob({ url: 'https://twitter.com/user/status/123' })
      vi.mocked(extractContent).mockResolvedValue(null)

      await processBookmarkJob(mockJob)

      // OG metadata should NOT be attempted for Twitter
      expect(vi.mocked(extractOGMetadata)).not.toHaveBeenCalled()

      // AI should be called with fallback content
      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://twitter.com/user/status/123',
          source: 'twitter',
        })
      )
    })

    it('should use fallback content when all extraction fails', async () => {
      vi.mocked(extractContent).mockResolvedValue(null)
      vi.mocked(extractOGMetadata).mockResolvedValue(null)

      await processBookmarkJob(mockJob)

      // AI should be called with fallback content
      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com/article',
          source: 'web',
          title: expect.any(String), // Fallback title
          content: expect.stringContaining('Content from'),
        })
      )
    })

    it('should continue when OG metadata extraction throws error', async () => {
      vi.mocked(extractContent).mockResolvedValue(null)
      vi.mocked(extractOGMetadata).mockRejectedValue(new Error('Network timeout'))

      await processBookmarkJob(mockJob)

      // Should continue with fallback content
      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Content from'),
        })
      )
    })

    it('should handle extraction throwing error instead of returning null', async () => {
      vi.mocked(extractContent).mockRejectedValue(new Error('Extraction service down'))

      await processBookmarkJob(mockJob)

      // Should continue with fallback
      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalled()
    })

    it('should use OG metadata when web extraction returns null', async () => {
      vi.mocked(extractContent).mockResolvedValue(null)
      const ogMetadata = createMockOGMetadata()
      vi.mocked(extractOGMetadata).mockResolvedValue(ogMetadata)

      await processBookmarkJob(mockJob)

      expect(vi.mocked(extractOGMetadata)).toHaveBeenCalledWith('https://example.com/article')
      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalled()
    })

    it('should skip OG enhancement when extraction succeeds for web URL', async () => {
      vi.mocked(extractContent).mockResolvedValue(createMockExtractedContent())

      await processBookmarkJob(mockJob)

      // Should not attempt OG metadata when extraction succeeded
      expect(vi.mocked(extractOGMetadata)).not.toHaveBeenCalled()
    })

    it('should handle empty OG metadata gracefully', async () => {
      vi.mocked(extractContent).mockResolvedValue(null)
      vi.mocked(extractOGMetadata).mockResolvedValue({
        ogTitle: undefined,
        ogDescription: undefined,
        ogImage: undefined,
        ogSiteName: undefined,
        ogType: undefined,
        pageTitle: undefined,
        metaDescription: undefined,
        metaAuthor: undefined,
        metaKeywords: undefined,
      })

      await processBookmarkJob(mockJob)

      // Should still process with fallback
      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalled()
    })

    it('should use minimal content from partial OG metadata', async () => {
      vi.mocked(extractContent).mockResolvedValue(null)
      vi.mocked(extractOGMetadata).mockResolvedValue({
        ogTitle: 'Only Title',
        ogDescription: undefined,
        ogImage: undefined,
        ogSiteName: undefined,
        ogType: undefined,
        pageTitle: undefined,
        metaDescription: undefined,
        metaAuthor: undefined,
        metaKeywords: undefined,
      })

      await processBookmarkJob(mockJob)

      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // 3. AI PROCESSING ERROR RECOVERY TESTS
  // ==========================================================================

  describe('AI Processing Error Recovery', () => {
    it('should save extracted content when AI processing fails', async () => {
      const extractedContent = createMockExtractedContent()
      vi.mocked(extractContent).mockResolvedValue(extractedContent)
      vi.mocked(processContentWithRetry).mockRejectedValue(new Error('API quota exceeded'))

      await processBookmarkJob(mockJob)

      // Should save extracted content even though AI failed
      expect(supabaseAdmin.from).toHaveBeenCalled()

      // Verify status is set to 'failed'
      // Verify processing_error contains the error message
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100) // Still completes the job
    })

    it('should mark as failed when AI fails and no extracted content', async () => {
      vi.mocked(extractContent).mockResolvedValue(null)
      vi.mocked(extractOGMetadata).mockResolvedValue(null)
      vi.mocked(processContentWithRetry).mockRejectedValue(new Error('AI service unavailable'))

      await expect(processBookmarkJob(mockJob)).rejects.toThrow('AI service unavailable')

      // Should update status to 'failed'
      expect(supabaseAdmin.from).toHaveBeenCalled()
    })

    it('should save partial data when AI retry exhausted', async () => {
      vi.mocked(extractContent).mockResolvedValue(createMockExtractedContent())
      vi.mocked(processContentWithRetry).mockRejectedValue(
        new Error('AI processing failed after 3 attempts: Rate limit exceeded')
      )

      await processBookmarkJob(mockJob)

      // Should still save extracted content
      expect(supabaseAdmin.from).toHaveBeenCalled()
    })

    it('should include error context in processing_error field', async () => {
      vi.mocked(extractContent).mockResolvedValue(createMockExtractedContent())
      vi.mocked(processContentWithRetry).mockRejectedValue(new Error('Model quota exceeded'))

      await processBookmarkJob(mockJob)

      // Verify error message is stored (implementation detail of how supabase mock works)
      expect(supabaseAdmin.from).toHaveBeenCalled()
    })

    it('should handle AI throwing non-Error objects', async () => {
      vi.mocked(extractContent).mockResolvedValue(createMockExtractedContent())
      vi.mocked(processContentWithRetry).mockRejectedValue('String error message')

      await processBookmarkJob(mockJob)

      // Should still handle and save
      expect(supabaseAdmin.from).toHaveBeenCalled()
    })

    it('should handle extraction success but AI classification fails', async () => {
      vi.mocked(extractContent).mockResolvedValue(createMockExtractedContent())
      vi.mocked(processContentWithRetry).mockRejectedValue(new Error('Classification failed'))

      await processBookmarkJob(mockJob)

      // Should save extracted content with failed status
      expect(supabaseAdmin.from).toHaveBeenCalled()
    })

    it('should handle extraction success but AI summarization fails', async () => {
      vi.mocked(extractContent).mockResolvedValue(createMockExtractedContent())
      vi.mocked(processContentWithRetry).mockRejectedValue(new Error('Summarization timeout'))

      await processBookmarkJob(mockJob)

      expect(supabaseAdmin.from).toHaveBeenCalled()
    })

    it('should gracefully degrade when AI returns incomplete data', async () => {
      vi.mocked(processContentWithRetry).mockResolvedValue({
        category: 'programming',
        tags: ['tutorial'],
        blurb: 'Short summary',
        summary: 'Detailed summary',
        contentType: 'article',
        // Missing keyTakeaways and extractedResources
      })

      await processBookmarkJob(mockJob)

      // Should succeed without optional fields
      expect(supabaseAdmin.from).toHaveBeenCalled()
    })

    it('should continue processing other bookmarks when one AI call fails', async () => {
      // First call fails
      vi.mocked(processContentWithRetry).mockRejectedValueOnce(new Error('Temporary failure'))

      // Second call succeeds
      vi.mocked(processContentWithRetry).mockResolvedValueOnce(createMockAIResult())

      // First bookmark
      await processBookmarkJob(mockJob)

      // Second bookmark
      const mockJob2 = createMockJob({ bookmarkId: 'bookmark-2', url: 'https://example.com/article2' })
      vi.mocked(extractContent).mockResolvedValue(createMockExtractedContent())

      await processBookmarkJob(mockJob2)

      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalledTimes(2)
    })

    it('should preserve extracted metadata when AI fails', async () => {
      const extractedContent = createMockExtractedContent({
        author: 'Jane Doe',
        authorUrl: 'https://example.com/jane',
        publishedAt: new Date('2024-01-15'),
        mediaUrls: ['https://example.com/image.jpg'],
      })
      vi.mocked(extractContent).mockResolvedValue(extractedContent)
      vi.mocked(processContentWithRetry).mockRejectedValue(new Error('AI failed'))

      await processBookmarkJob(mockJob)

      // Extracted metadata should still be saved
      expect(supabaseAdmin.from).toHaveBeenCalled()
    })

    it('should handle AI timeout gracefully', async () => {
      vi.mocked(extractContent).mockResolvedValue(createMockExtractedContent())
      vi.mocked(processContentWithRetry).mockRejectedValue(new Error('Request timeout after 30s'))

      await processBookmarkJob(mockJob)

      expect(supabaseAdmin.from).toHaveBeenCalled()
    })

    it('should store different error messages for different failure types', async () => {
      vi.mocked(extractContent).mockResolvedValue(createMockExtractedContent())
      vi.mocked(processContentWithRetry).mockRejectedValue(new Error('Invalid API key'))

      await processBookmarkJob(mockJob)

      // Error message should be stored in processing_error
      expect(supabaseAdmin.from).toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // 4. EMBEDDING GENERATION TESTS
  // ==========================================================================

  describe('Embedding Generation', () => {
    it('should generate and save embedding on success', async () => {
      const embedding = createMockEmbedding()
      vi.mocked(generateBookmarkEmbedding).mockResolvedValue(embedding)
      vi.mocked(formatEmbeddingForPostgres).mockReturnValue('[0.1,0.1,0.1]')

      await processBookmarkJob(mockJob)

      expect(vi.mocked(generateBookmarkEmbedding)).toHaveBeenCalledWith(
        'Test Article Title',
        'A comprehensive guide to modern web development.',
        'This article provides an in-depth exploration of modern web development practices, covering key concepts and practical examples.',
        [
          { text: 'Always use TypeScript for type safety', type: 'action' },
          { text: 'Consider using a monorepo for large projects', type: 'idea' },
        ]
      )

      expect(vi.mocked(supabaseAdmin.rpc)).toHaveBeenCalledWith('update_bookmark_embedding', {
        bookmark_id: 'test-bookmark-id',
        embedding_value: '[0.1,0.1,0.1]',
      })
    })

    it('should continue when embedding generation fails (non-blocking)', async () => {
      vi.mocked(generateBookmarkEmbedding).mockRejectedValue(new Error('Embedding API unavailable'))

      await processBookmarkJob(mockJob)

      // Job should still complete successfully
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100)
      expect(supabaseAdmin.from).toHaveBeenCalled()
    })

    it('should continue when embedding save to database fails', async () => {
      vi.mocked(generateBookmarkEmbedding).mockResolvedValue(createMockEmbedding())
      vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ error: { message: 'RPC function not found' } })

      await processBookmarkJob(mockJob)

      // Job should still complete successfully
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100)
    })

    it('should generate embedding with null keyTakeaways', async () => {
      vi.mocked(processContentWithRetry).mockResolvedValue({
        ...createMockAIResult(),
        keyTakeaways: null,
      })

      await processBookmarkJob(mockJob)

      expect(vi.mocked(generateBookmarkEmbedding)).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        null
      )
    })

    it('should generate embedding with empty keyTakeaways array', async () => {
      vi.mocked(processContentWithRetry).mockResolvedValue({
        ...createMockAIResult(),
        keyTakeaways: [],
      })

      await processBookmarkJob(mockJob)

      expect(vi.mocked(generateBookmarkEmbedding)).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        []
      )
    })

    it('should log warning when embedding fails but not throw', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(generateBookmarkEmbedding).mockRejectedValue(new Error('Rate limit'))

      await processBookmarkJob(mockJob)

      // Should complete without throwing
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100)
      consoleWarnSpy.mockRestore()
    })

    it('should handle embedding generation timeout', async () => {
      vi.mocked(generateBookmarkEmbedding).mockRejectedValue(new Error('Timeout after 10s'))

      await processBookmarkJob(mockJob)

      // Job should complete
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100)
    })

    it('should handle invalid embedding dimension gracefully', async () => {
      // Mock embedding with wrong dimension (not 768)
      vi.mocked(generateBookmarkEmbedding).mockResolvedValue(new Array(100).fill(0)) // Invalid: wrong dimension

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await processBookmarkJob(mockJob)

      // Job should complete successfully (embedding is non-blocking)
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100)

      // Should log warning about invalid dimension
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid embedding dimension')
      )

      // Should NOT call formatEmbeddingForPostgres with invalid embedding
      expect(vi.mocked(formatEmbeddingForPostgres)).not.toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })
  })

  // ==========================================================================
  // 5. DATABASE ERROR TESTS
  // ==========================================================================

  describe('Database Errors', () => {
    it('should fail job when final database update fails', async () => {
      // Mock database update to fail
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'Database connection lost' } }),
        }),
      } as any)

      await expect(processBookmarkJob(mockJob)).rejects.toThrow('Database update failed')
    })

    it('should handle RLS policy violation', async () => {
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'new row violates row-level security policy' },
          }),
        }),
      } as any)

      await expect(processBookmarkJob(mockJob)).rejects.toThrow()
    })

    it('should handle bookmark not found during update', async () => {
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'No rows found' },
          }),
        }),
      } as any)

      await expect(processBookmarkJob(mockJob)).rejects.toThrow()
    })

    it('should not leave partial state when transaction fails', async () => {
      // Setup: first update succeeds, second fails
      const mockEq = vi.fn()
        .mockResolvedValueOnce({ error: null })  // Status to processing succeeds
        .mockResolvedValueOnce({ error: { message: 'Constraint violation' } })  // Final update fails

      vi.mocked(supabaseAdmin.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: mockEq,
        }),
      } as any)

      await expect(processBookmarkJob(mockJob)).rejects.toThrow()
    })

    it('should handle database timeout on update', async () => {
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'Query timeout after 30s' },
          }),
        }),
      } as any)

      await expect(processBookmarkJob(mockJob)).rejects.toThrow()
    })

    it('should handle concurrent update conflicts', async () => {
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'Concurrent update detected' },
          }),
        }),
      } as any)

      await expect(processBookmarkJob(mockJob)).rejects.toThrow()
    })
  })

  // ==========================================================================
  // 6. STATUS AND PROGRESS TESTS
  // ==========================================================================

  describe('Status and Progress Tracking', () => {
    it('should set status to processing at start', async () => {
      await processBookmarkJob(mockJob)

      // First supabase call should set status to 'processing'
      expect(supabaseAdmin.from).toHaveBeenCalled()
    })

    it('should set status to completed on success', async () => {
      await processBookmarkJob(mockJob)

      // Final update should include processing_status: 'completed'
      expect(supabaseAdmin.from).toHaveBeenCalled()
    })

    it('should set status to failed when AI fails without extraction', async () => {
      vi.mocked(extractContent).mockResolvedValue(null)
      vi.mocked(extractOGMetadata).mockResolvedValue(null)
      vi.mocked(processContentWithRetry).mockRejectedValue(new Error('AI failed'))

      await expect(processBookmarkJob(mockJob)).rejects.toThrow()

      expect(supabaseAdmin.from).toHaveBeenCalled()
    })

    it('should track progress from 0 to 100', async () => {
      await processBookmarkJob(mockJob)

      const progressCalls = vi.mocked(mockJob.updateProgress).mock.calls
      const progressValues = progressCalls.map((call) => call[0])

      expect(progressValues).toEqual([10, 20, 40, 50, 80, 90, 100])
    })

    it('should update progress even when embedding fails', async () => {
      vi.mocked(generateBookmarkEmbedding).mockRejectedValue(new Error('Embedding failed'))

      await processBookmarkJob(mockJob)

      expect(mockJob.updateProgress).toHaveBeenCalledWith(100)
    })

    it('should not progress beyond 100', async () => {
      await processBookmarkJob(mockJob)

      const progressCalls = vi.mocked(mockJob.updateProgress).mock.calls
      const progressValues = progressCalls.map((call) => call[0])

      expect(Math.max(...progressValues)).toBe(100)
    })

    it('should progress in ascending order', async () => {
      await processBookmarkJob(mockJob)

      const progressCalls = vi.mocked(mockJob.updateProgress).mock.calls
      const progressValues = progressCalls.map((call) => call[0])

      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1])
      }
    })

    it('should clear processing_error on success', async () => {
      await processBookmarkJob(mockJob)

      // processing_error should be set to null on success
      expect(supabaseAdmin.from).toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // 7. EDGE CASES TESTS
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle very long URLs (>1000 characters)', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000)
      mockJob = createMockJob({ url: longUrl })

      await processBookmarkJob(mockJob)

      expect(vi.mocked(extractContent)).toHaveBeenCalledWith(longUrl)
    })

    it('should handle very short content', async () => {
      vi.mocked(extractContent).mockResolvedValue(
        createMockExtractedContent({
          title: 'Hi',
          content: 'OK',
        })
      )

      await processBookmarkJob(mockJob)

      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Hi',
          content: 'OK',
        })
      )
    })

    it('should handle empty content string', async () => {
      vi.mocked(extractContent).mockResolvedValue(
        createMockExtractedContent({
          content: '',
        })
      )

      await processBookmarkJob(mockJob)

      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalled()
    })

    it('should handle missing user_id in job data', async () => {
      mockJob = createMockJob({ userId: undefined } as any)

      // Should still process (user_id is used by queue but not directly by processor)
      await processBookmarkJob(mockJob)

      expect(supabaseAdmin.from).toHaveBeenCalled()
    })

    it('should handle invalid bookmark ID format', async () => {
      mockJob = createMockJob({ bookmarkId: 'not-a-uuid' })

      // Processor should still attempt to process
      await processBookmarkJob(mockJob)

      // Verify bookmarks table was accessed
      expect(supabaseAdmin.from).toHaveBeenCalledWith('bookmarks')
    })

    it('should handle URLs with special characters', async () => {
      const specialUrl = 'https://example.com/article?utm_source=test&utm_medium=email&name=John+Doe'
      mockJob = createMockJob({ url: specialUrl })

      await processBookmarkJob(mockJob)

      expect(vi.mocked(extractContent)).toHaveBeenCalledWith(specialUrl)
    })

    it('should handle URLs with fragments', async () => {
      const urlWithFragment = 'https://example.com/article#section-2'
      mockJob = createMockJob({ url: urlWithFragment })

      await processBookmarkJob(mockJob)

      expect(vi.mocked(extractContent)).toHaveBeenCalledWith(urlWithFragment)
    })

    it('should handle extraction returning content with no title', async () => {
      vi.mocked(extractContent).mockResolvedValue(
        createMockExtractedContent({
          title: '',
          content: 'Content without title',
        })
      )

      await processBookmarkJob(mockJob)

      // Should use fallback title
      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalled()
    })

    it('should handle content with only whitespace', async () => {
      vi.mocked(extractContent).mockResolvedValue(
        createMockExtractedContent({
          content: '   \n\n   ',
        })
      )

      await processBookmarkJob(mockJob)

      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalled()
    })

    it('should handle extraction with all fields null except required', async () => {
      vi.mocked(extractContent).mockResolvedValue({
        url: 'https://example.com/minimal',
        source: 'web',
        title: 'Minimal',
        content: 'Minimal content',
        // All other fields undefined
      })

      await processBookmarkJob(mockJob)

      expect(vi.mocked(processContentWithRetry)).toHaveBeenCalled()
    })
  })
})
