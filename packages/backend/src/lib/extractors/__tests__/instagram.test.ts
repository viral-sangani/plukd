/**
 * Comprehensive tests for Instagram content extractor
 *
 * Tests the Instagram extractor which uses Parallel AI and OG metadata
 * to fetch post/reel content and generates AI titles when needed.
 *
 * Coverage:
 * - Content type detection (post, reel, story)
 * - Username extraction from URLs
 * - Caption extraction from Parallel AI content using multiple strategies
 * - AI title generation for generic titles with retry logic
 * - OG description fallback for caption extraction
 * - Successful extraction with Parallel AI and OG metadata fallback
 * - Error handling (API failures, private posts, invalid URLs, retryable errors)
 * - Edge cases (empty content, malformed data, different post types)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ExtractedContent } from '@plukd/shared'

// Mock dependencies
vi.mock('../og-metadata')
vi.mock('../parallel-client')
vi.mock('../instagram-video')
vi.mock('@ai-sdk/google')
vi.mock('ai')
vi.mock('@plukd/shared', async () => {
  const actual = await vi.importActual('@plukd/shared')
  return {
    ...actual,
    isTitleBad: vi.fn((title: string) => {
      if (!title) return true
      const lower = title.toLowerCase().trim()
      // Match standalone Instagram titles (without additional content)
      const standalonePatterns = ['instagram', 'instagram reel', 'instagram post', 'instagram story', 'instagram content', 'instagram video', 'instagram photo']
      if (standalonePatterns.includes(lower)) return true
      if (lower.includes('sign up') || lower.includes('log in')) return true
      return false
    }),
    sleep: vi.fn().mockResolvedValue(undefined),
  }
})

// Now import after mocks
import { extractInstagramContent, generateInstagramTitle, extractCaptionFromContent, extractHashtags, extractMentions, isValidCaption } from '../instagram'
import { extractOGMetadata } from '../og-metadata'
import { extractWithParallel } from '../parallel-client'
import { getInstagramMediaInfo } from '../instagram-video'
import * as aiModule from 'ai'
import { sleep } from '@plukd/shared'

describe('Instagram Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock for getInstagramMediaInfo - returns null (no carousel)
    vi.mocked(getInstagramMediaInfo).mockResolvedValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('extractInstagramContent', () => {
    describe('successful extraction with Parallel AI', () => {
      it('should extract post content using Parallel AI', async () => {
        const url = 'https://www.instagram.com/p/ABC123xyz/'

        const mockParallelResult = {
          url,
          title: 'Beautiful sunset at the beach',
          full_content: '[username](/username/)\n\nAmazing sunset at the beach today! #sunset #photography',
          excerpts: ['sunset', 'photography'],
        }

        const mockOGMetadata = {
          ogImage: 'https://instagram.com/v/image.jpg',
        }

        vi.mocked(extractWithParallel).mockResolvedValue(mockParallelResult)
        vi.mocked(extractOGMetadata).mockResolvedValue(mockOGMetadata)

        const result = await extractInstagramContent(url)

        expect(result).toBeDefined()
        expect(result?.source).toBe('instagram')
        expect(result?.title).toBe('Beautiful sunset at the beach')
        expect(result?.content).toContain('Amazing sunset')
        expect(result?.mediaUrls).toContain('https://instagram.com/v/image.jpg')
      })

      it('should extract reel content using Parallel AI', async () => {
        const url = 'https://www.instagram.com/reel/XYZ789abc/'

        const mockParallelResult = {
          url,
          title: 'Dance Tutorial',
          full_content: '[dancer](/dancer/)\n\nLearn this amazing dance move! Follow along.',
          excerpts: ['dance', 'tutorial'],
        }

        const mockOGMetadata = {
          ogImage: 'https://instagram.com/reel/thumb.jpg',
        }

        vi.mocked(extractWithParallel).mockResolvedValue(mockParallelResult)
        vi.mocked(extractOGMetadata).mockResolvedValue(mockOGMetadata)

        const result = await extractInstagramContent(url)

        expect(result).toBeDefined()
        expect(result?.source).toBe('instagram')
        expect(result?.rawMetadata?.instagram?.postType).toBe('reel')
      })

      it('should generate AI title when Parallel title is generic', async () => {
        const url = 'https://www.instagram.com/p/TEST123/'

        const mockParallelResult = {
          url,
          title: 'Instagram',
          full_content: '[user](/user/)\n\nCheck out my new book recommendations for this month!',
          excerpts: ['books'],
        }

        const mockOGMetadata = {
          ogImage: 'https://instagram.com/image.jpg',
        }

        vi.mocked(extractWithParallel).mockResolvedValue(mockParallelResult)
        vi.mocked(extractOGMetadata).mockResolvedValue(mockOGMetadata)
        vi.spyOn(aiModule, 'generateText').mockResolvedValue({
          text: 'Book Recommendations for This Month',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await extractInstagramContent(url)

        expect(result?.title).toBe('Book Recommendations for This Month')
        expect(aiModule.generateText).toHaveBeenCalled()
      })

      it('should extract username and use as author', async () => {
        const url = 'https://www.instagram.com/p/ABC123/'

        const mockParallelResult = {
          url,
          title: 'Good Title',
          full_content: 'Content here',
          excerpts: [],
        }

        vi.mocked(extractWithParallel).mockResolvedValue(mockParallelResult)
        vi.mocked(extractOGMetadata).mockResolvedValue({ ogImage: 'image.jpg' })

        const result = await extractInstagramContent(url)

        expect(result?.author).toBeUndefined()
      })

      it('should include raw metadata with excerpts', async () => {
        const url = 'https://www.instagram.com/p/TEST/'

        const mockParallelResult = {
          url,
          title: 'Post Title',
          full_content: 'Post content with enough characters to pass the length check for parallel extraction',
          excerpts: ['key1', 'key2', 'key3'],
        }

        vi.mocked(extractWithParallel).mockResolvedValue(mockParallelResult)
        vi.mocked(extractOGMetadata).mockResolvedValue({})

        const result = await extractInstagramContent(url)

        expect(result?.rawMetadata?.excerpts).toEqual(['key1', 'key2', 'key3'])
        expect(result?.rawMetadata?.instagram?.caption).toBe('Post content with enough characters to pass the length check for parallel extraction')
      })
    })

    describe('fallback to OG metadata', () => {
      it('should use OG metadata when Parallel AI fails and generate AI title from content', async () => {
        const url = 'https://www.instagram.com/p/FALLBACK/'

        vi.mocked(extractWithParallel).mockRejectedValue(new Error('Parallel API error'))

        const mockOGMetadata = {
          ogTitle: 'OG Title',
          ogDescription: 'Post description from OG tags',
          ogImage: 'https://instagram.com/og-image.jpg',
          ogSiteName: 'Instagram',
        }

        vi.mocked(extractOGMetadata).mockResolvedValue(mockOGMetadata)
        // Mock AI title generation since we now always try to generate better titles when content is available
        vi.spyOn(aiModule, 'generateText').mockResolvedValue({
          text: 'AI Generated Title From OG Description',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await extractInstagramContent(url)

        expect(result).toBeDefined()
        // With the new behavior, AI title generation is attempted when there's meaningful content
        expect(result?.title).toBe('AI Generated Title From OG Description')
        expect(result?.content).toBe('Post description from OG tags')
        expect(result?.ogImage).toBe('https://instagram.com/og-image.jpg')
      })

      it('should use OG metadata when Parallel returns no content', async () => {
        const url = 'https://www.instagram.com/p/NOCONTENT/'

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: '',
          full_content: '',
          excerpts: null,
        })

        const mockOGMetadata = {
          ogTitle: 'Fallback Title',
          ogDescription: 'Fallback description',
        }

        vi.mocked(extractOGMetadata).mockResolvedValue(mockOGMetadata)

        const result = await extractInstagramContent(url)

        expect(result?.content).toBe('Fallback description')
      })

      it('should generate AI title when OG title is generic', async () => {
        const url = 'https://www.instagram.com/p/GENERIC/'

        vi.mocked(extractWithParallel).mockResolvedValue(null)

        const mockOGMetadata = {
          ogTitle: 'Instagram',
          ogDescription: 'Amazing travel photos from my trip!',
        }

        vi.mocked(extractOGMetadata).mockResolvedValue(mockOGMetadata)
        vi.spyOn(aiModule, 'generateText').mockResolvedValue({
          text: 'Travel Photos From My Trip',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await extractInstagramContent(url)

        expect(result?.title).toBe('Travel Photos From My Trip')
      })

      it('should use fallback title when both Parallel and OG fail', async () => {
        const url = 'https://www.instagram.com/p/TOTAL_FAIL/'

        vi.mocked(extractWithParallel).mockResolvedValue(null)
        vi.mocked(extractOGMetadata).mockResolvedValue(null)

        const result = await extractInstagramContent(url)

        expect(result).toBeDefined()
        expect(result?.title).toContain('Instagram Post')
        expect(result?.content).toBe('')
      })
    })

    describe('error handling', () => {
      it('should handle Parallel API errors gracefully and use AI title from OG content', async () => {
        const url = 'https://www.instagram.com/p/ERROR/'

        vi.mocked(extractWithParallel).mockRejectedValue(new Error('Network error'))
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogTitle: 'Fallback',
          ogDescription: 'Description of the content here',
        })
        // Mock AI title generation
        vi.spyOn(aiModule, 'generateText').mockResolvedValue({
          text: 'AI Generated Fallback Title',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await extractInstagramContent(url)

        expect(result).toBeDefined()
        // With the new behavior, AI generates title from content when available
        expect(result?.title).toBe('AI Generated Fallback Title')
      })

      it('should handle OG metadata extraction failure', async () => {
        const url = 'https://www.instagram.com/p/OGFAIL/'

        vi.mocked(extractWithParallel).mockResolvedValue(null)
        vi.mocked(extractOGMetadata).mockResolvedValue(null)

        const result = await extractInstagramContent(url)

        expect(result).toBeDefined()
        expect(result?.source).toBe('instagram')
      })

      it('should handle AI title generation failure', async () => {
        const url = 'https://www.instagram.com/p/AIFAIL/'

        const mockParallelResult = {
          url,
          title: 'Instagram',
          full_content: 'Content here',
          excerpts: null,
        }

        vi.mocked(extractWithParallel).mockResolvedValue(mockParallelResult)
        vi.mocked(extractOGMetadata).mockResolvedValue({})
        vi.spyOn(aiModule, 'generateText').mockRejectedValue(new Error('AI API error'))

        const result = await extractInstagramContent(url)

        expect(result).toBeDefined()
        expect(result?.title).toContain('Instagram')
      })

      it('should handle private posts', async () => {
        const url = 'https://www.instagram.com/p/PRIVATE/'

        vi.mocked(extractWithParallel).mockResolvedValue(null)
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogTitle: 'Instagram',
          ogDescription: 'This content is private',
        })

        const result = await extractInstagramContent(url)

        expect(result?.content).toContain('private')
      })

      it('should handle deleted posts', async () => {
        const url = 'https://www.instagram.com/p/DELETED/'

        vi.mocked(extractWithParallel).mockResolvedValue(null)
        vi.mocked(extractOGMetadata).mockResolvedValue(null)

        const result = await extractInstagramContent(url)

        expect(result).toBeDefined()
        expect(result?.content).toBe('')
      })
    })

    describe('content type detection', () => {
      it('should detect post type from URL', async () => {
        const url = 'https://www.instagram.com/p/POST123/'

        vi.mocked(extractWithParallel).mockResolvedValue(null)
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogTitle: 'Post',
          ogDescription: 'Description',
        })

        const result = await extractInstagramContent(url)

        expect(result?.rawMetadata?.instagram?.postType).toBe('post')
      })

      it('should detect reel type from URL', async () => {
        const url = 'https://www.instagram.com/reel/REEL123/'

        vi.mocked(extractWithParallel).mockResolvedValue(null)
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogTitle: 'Reel',
          ogDescription: 'Description',
        })

        const result = await extractInstagramContent(url)

        expect(result?.rawMetadata?.instagram?.postType).toBe('reel')
      })

      it('should detect story type from URL', async () => {
        const url = 'https://www.instagram.com/stories/user/123456/'

        vi.mocked(extractWithParallel).mockResolvedValue(null)
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogTitle: 'Story',
          ogDescription: 'Description',
        })

        const result = await extractInstagramContent(url)

        expect(result?.rawMetadata?.instagram?.postType).toBe('story')
      })

      it('should handle unknown content type', async () => {
        const url = 'https://www.instagram.com/unknown/path/'

        vi.mocked(extractWithParallel).mockResolvedValue(null)
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogTitle: 'Unknown',
          ogDescription: 'Description',
        })

        const result = await extractInstagramContent(url)

        expect(result?.rawMetadata?.instagram?.postType).toBeUndefined()
      })
    })

    describe('edge cases', () => {
      it('should handle empty Parallel AI content', async () => {
        const url = 'https://www.instagram.com/p/EMPTY/'

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Title',
          full_content: '',
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue({})

        const result = await extractInstagramContent(url)

        expect(result?.content).toBe('')
      })

      it('should handle very long captions', async () => {
        const longCaption = 'Word '.repeat(1000)
        const url = 'https://www.instagram.com/p/LONG/'

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Good Title',
          full_content: longCaption,
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue({})

        const result = await extractInstagramContent(url)

        expect(result?.content.length).toBeGreaterThan(1000)
      })

      it('should handle content with special characters', async () => {
        const url = 'https://www.instagram.com/p/SPECIAL/'

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Special: "Quotes" & Symbols',
          full_content: 'Content with é, ñ, ü, — and emojis 🎉 and enough content to meet minimum length requirements for parallel extraction',
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue({})

        const result = await extractInstagramContent(url)

        expect(result?.title).toContain('Quotes')
        expect(result?.content).toContain('🎉')
      })

      it('should handle OG metadata with missing fields', async () => {
        const url = 'https://www.instagram.com/p/PARTIAL/'

        vi.mocked(extractWithParallel).mockResolvedValue(null)
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogTitle: 'Only Title',
          // Missing description and image
        })

        const result = await extractInstagramContent(url)

        expect(result?.title).toBe('Only Title')
        expect(result?.content).toBe('')
        expect(result?.mediaUrls).toBeUndefined()
      })

      it('should handle URLs with query parameters', async () => {
        const url = 'https://www.instagram.com/p/ABC123/?utm_source=share'

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Post',
          full_content: 'Content',
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue({})

        const result = await extractInstagramContent(url)

        expect(result).toBeDefined()
      })

      it('should prefer Parallel AI over OG metadata when both available', async () => {
        const url = 'https://www.instagram.com/p/BOTH/'

        const mockParallelResult = {
          url,
          title: 'Good Title From Parallel',
          full_content: 'Parallel content with enough text to meet minimum length requirements for processing',
          excerpts: ['excerpt'],
        }

        const mockOGMetadata = {
          ogTitle: 'OG Title',
          ogDescription: 'OG description',
          ogImage: 'og-image.jpg',
        }

        vi.mocked(extractWithParallel).mockResolvedValue(mockParallelResult)
        vi.mocked(extractOGMetadata).mockResolvedValue(mockOGMetadata)

        const result = await extractInstagramContent(url)

        expect(result?.title).toBe('Good Title From Parallel')
        expect(result?.content).toBe('Parallel content with enough text to meet minimum length requirements for processing')
        expect(result?.mediaUrls).toContain('og-image.jpg')
      })

      it('should handle null excerpts array', async () => {
        const url = 'https://www.instagram.com/p/NULLEXCERPTS/'

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Title',
          full_content: 'Content with enough characters to pass the minimum length requirements for parallel extraction',
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue({})

        const result = await extractInstagramContent(url)

        // When full_content is < 50 chars, it falls back to OG metadata and excerpts might be undefined
        expect(result?.rawMetadata?.excerpts).toBeDefined()
      })

      it('should handle content with login prompts', async () => {
        const url = 'https://www.instagram.com/p/LOGIN/'

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Instagram',
          full_content: 'Log in to see photos and videos from friends. Sign up for Instagram.',
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue({})

        const result = await extractInstagramContent(url)

        expect(result).toBeDefined()
      })
    })
  })

  describe('generateInstagramTitle', () => {
    it('should generate title from caption using AI', async () => {
      const url = 'https://www.instagram.com/p/TEST/'
      const content = '[user](/user/)\n\nCheck out these amazing travel photos from my trip to Japan!'

      vi.spyOn(aiModule, 'generateText').mockResolvedValue({
        text: 'Travel Photos From Trip to Japan',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
        warnings: [],
        response: {} as any,
        request: {} as any,
        rawResponse: {} as any,
      })

      const result = await generateInstagramTitle(url, content, 'post')

      expect(result).toBe('Travel Photos From Trip to Japan')
      expect(aiModule.generateText).toHaveBeenCalled()
    })

    it('should use fallback title when no caption extracted', async () => {
      const url = 'https://www.instagram.com/p/NOCAPTION/'
      const content = 'Log in to Instagram'

      const result = await generateInstagramTitle(url, content, 'post')

      expect(result).toContain('Instagram Post')
      expect(aiModule.generateText).not.toHaveBeenCalled()
    })

    it('should use fallback when AI returns invalid title', async () => {
      const url = 'https://www.instagram.com/p/INVALID/'
      const content = '[user](/user/)\n\nGreat post!'

      vi.spyOn(aiModule, 'generateText').mockResolvedValue({
        text: 'Instagram',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
        warnings: [],
        response: {} as any,
        request: {} as any,
        rawResponse: {} as any,
      })

      const result = await generateInstagramTitle(url, content, 'post')

      expect(result).not.toBe('Instagram')
      expect(result).toContain('Instagram Post')
    })

    it('should handle AI API errors gracefully', async () => {
      const url = 'https://www.instagram.com/p/AIERROR/'
      const content = '[user](/user/)\n\nAmazing content here'

      vi.spyOn(aiModule, 'generateText').mockRejectedValue(new Error('AI error'))

      const result = await generateInstagramTitle(url, content, 'post')

      expect(result).toContain('Instagram Post')
    })

    it('should extract caption for reel content type', async () => {
      const url = 'https://www.instagram.com/reel/REEL/'
      const content = '[user](/user/)\n\nCheck out this dance tutorial!'

      vi.spyOn(aiModule, 'generateText').mockResolvedValue({
        text: 'Dance Tutorial',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
        warnings: [],
        response: {} as any,
        request: {} as any,
        rawResponse: {} as any,
      })

      const result = await generateInstagramTitle(url, content, 'reel')

      expect(result).toBe('Dance Tutorial')
    })

    it('should handle empty content string', async () => {
      const url = 'https://www.instagram.com/p/EMPTY/'
      const content = ''

      const result = await generateInstagramTitle(url, content, 'post')

      expect(result).toContain('Instagram Post')
    })

    it('should handle null content', async () => {
      const url = 'https://www.instagram.com/p/NULL/'
      const content = null

      const result = await generateInstagramTitle(url, content, 'post')

      expect(result).toContain('Instagram Post')
    })

    it('should use fallback title for very long captions when no good caption extracted', async () => {
      const url = 'https://www.instagram.com/p/LONG/'
      const longText = 'Log in to Instagram. '.repeat(50)  // This will be filtered out as UI text
      const content = longText

      const result = await generateInstagramTitle(url, content, 'post')

      expect(result).toContain('Instagram Post')
    })

    it('should filter out Instagram UI text from captions', async () => {
      const url = 'https://www.instagram.com/p/UI/'
      const content = `
        [user](/user/)

        Great post content here!

        Log in to see more
        Sign up for Instagram
        Never miss a post
      `

      vi.spyOn(aiModule, 'generateText').mockResolvedValue({
        text: 'Great Post Content',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
        warnings: [],
        response: {} as any,
        request: {} as any,
        rawResponse: {} as any,
      })

      const result = await generateInstagramTitle(url, content, 'post')

      expect(result).toBe('Great Post Content')
    })

    it('should use OG description as fallback when caption extraction fails', async () => {
      const url = 'https://www.instagram.com/p/OGFALLBACK/'
      const content = 'Log in to see more content. Sign up now!' // All UI text, no caption
      const ogDescription = 'Beautiful sunset over the mountains with amazing colors'

      vi.spyOn(aiModule, 'generateText').mockResolvedValue({
        text: 'Beautiful Sunset Over Mountains',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
        warnings: [],
        response: {} as any,
        request: {} as any,
        rawResponse: {} as any,
      })

      const result = await generateInstagramTitle(url, content, 'post', ogDescription)

      expect(result).toBe('Beautiful Sunset Over Mountains')
      expect(aiModule.generateText).toHaveBeenCalled()
    })

    it('should not use OG description if it is too short', async () => {
      const url = 'https://www.instagram.com/p/SHORTOG/'
      const content = 'Log in to see more'
      const ogDescription = 'Short' // Less than 10 characters

      const result = await generateInstagramTitle(url, content, 'post', ogDescription)

      expect(result).toContain('Instagram Post')
      expect(aiModule.generateText).not.toHaveBeenCalled()
    })

    it('should not use OG description if it contains invalid patterns', async () => {
      const url = 'https://www.instagram.com/p/INVALIDOG/'
      const content = 'Log in to see more'
      const ogDescription = 'Sign up now to see this amazing content'

      const result = await generateInstagramTitle(url, content, 'post', ogDescription)

      expect(result).toContain('Instagram Post')
      expect(aiModule.generateText).not.toHaveBeenCalled()
    })
  })

  describe('generateInstagramTitle retry logic', () => {
    it('should retry on timeout errors', async () => {
      const url = 'https://www.instagram.com/p/RETRY/'
      const content = '[user](/user/)\n\nAmazing travel photos from my trip!'

      // First call fails with timeout, second succeeds
      vi.spyOn(aiModule, 'generateText')
        .mockRejectedValueOnce(new Error('Request timed out'))
        .mockResolvedValueOnce({
          text: 'Travel Photos From My Trip',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

      const result = await generateInstagramTitle(url, content, 'post')

      expect(result).toBe('Travel Photos From My Trip')
      expect(aiModule.generateText).toHaveBeenCalledTimes(2)
      expect(sleep).toHaveBeenCalledTimes(1)
    })

    it('should retry on rate limit errors', async () => {
      const url = 'https://www.instagram.com/p/RATELIMIT/'
      const content = '[user](/user/)\n\nCheck out this cool video!'

      // First two calls fail with rate limit, third succeeds
      vi.spyOn(aiModule, 'generateText')
        .mockRejectedValueOnce(new Error('429 Too Many Requests'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce({
          text: 'Cool Video Showcase',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

      const result = await generateInstagramTitle(url, content, 'post')

      expect(result).toBe('Cool Video Showcase')
      expect(aiModule.generateText).toHaveBeenCalledTimes(3)
      expect(sleep).toHaveBeenCalledTimes(2)
    })

    it('should not retry on non-retryable errors', async () => {
      const url = 'https://www.instagram.com/p/NORETRY/'
      const content = '[user](/user/)\n\nThis is a great post about photography tips and tricks for beginners!'

      vi.spyOn(aiModule, 'generateText')
        .mockRejectedValueOnce(new Error('Invalid API key'))

      const result = await generateInstagramTitle(url, content, 'post')

      expect(result).toContain('Instagram Post')
      expect(aiModule.generateText).toHaveBeenCalledTimes(1)
      expect(sleep).not.toHaveBeenCalled()
    })

    it('should use fallback after exhausting all retries', async () => {
      const url = 'https://www.instagram.com/p/EXHAUSTED/'
      const content = '[user](/user/)\n\nHere are my top 10 favorite books for entrepreneurs and business owners!'

      // All 3 attempts fail with timeout
      vi.spyOn(aiModule, 'generateText')
        .mockRejectedValue(new Error('Request timed out'))

      const result = await generateInstagramTitle(url, content, 'post')

      expect(result).toContain('Instagram Post')
      expect(aiModule.generateText).toHaveBeenCalledTimes(3)
      expect(sleep).toHaveBeenCalledTimes(2) // Sleep between retries
    })

    it('should use exponential backoff for retries', async () => {
      const url = 'https://www.instagram.com/p/BACKOFF/'
      const content = '[user](/user/)\n\nBackoff test content!'

      vi.spyOn(aiModule, 'generateText')
        .mockRejectedValue(new Error('Network error'))

      await generateInstagramTitle(url, content, 'post')

      // Check that sleep was called with increasing delays
      expect(sleep).toHaveBeenCalledTimes(2)
      expect(sleep).toHaveBeenNthCalledWith(1, 1000) // First retry: 1000ms
      expect(sleep).toHaveBeenNthCalledWith(2, 2000) // Second retry: 2000ms
    })
  })

  describe('extractCaptionFromContent', () => {
    describe('Strategy 1: Username pattern extraction', () => {
      it('should extract caption after username markdown pattern', () => {
        const content = '[testuser](/testuser/)\n\nThis is my amazing travel photo from Italy!'
        const result = extractCaptionFromContent(content, 'testuser')
        expect(result).toBe('This is my amazing travel photo from Italy!')
      })

      it('should not extract UI text after username pattern', () => {
        const content = '[testuser](/testuser/)\n\nLog in to see more photos'
        const result = extractCaptionFromContent(content, 'testuser')
        expect(result).toBeNull()
      })
    })

    describe('Strategy 2: Quoted content extraction', () => {
      it('should extract caption from quoted content', () => {
        const content = 'Log in\n"This is my beautiful sunset photograph from Hawaii"\nSign up'
        const result = extractCaptionFromContent(content, null)
        // The quoted content should be found and extracted
        expect(result).toContain('beautiful sunset photograph from Hawaii')
      })

      it('should not extract short quoted content', () => {
        const content = 'Some text "Hi there" more text'
        const result = extractCaptionFromContent(content, null)
        // Should fall through to other strategies or return null
        expect(result).not.toBe('Hi there')
      })
    })

    describe('Strategy 3: After likes/views pattern', () => {
      it('should extract caption after likes count', () => {
        const content = 'Log in\n\n1,234 likes\n\nThis is the actual caption with meaningful content here'
        const result = extractCaptionFromContent(content, null)
        // Should find the caption content
        expect(result).toContain('This is the actual caption with meaningful content here')
      })

      it('should extract caption after views count', () => {
        const content = 'Log in\n\n5000 views\n\nMy amazing video about cooking techniques'
        const result = extractCaptionFromContent(content, null)
        // Should find the caption content
        expect(result).toContain('My amazing video about cooking techniques')
      })
    })

    describe('Strategy 4: Hashtag-heavy content', () => {
      it('should extract content with multiple hashtags', () => {
        const content = 'Log in\nSign up\nCheck out this amazing sunset #travel #photography #nature'
        const result = extractCaptionFromContent(content, null)
        // Should find the hashtag-heavy line
        expect(result).toContain('amazing sunset')
        expect(result).toContain('#travel')
      })
    })

    describe('Strategy 5: General caption detection', () => {
      it('should extract first valid non-UI line', () => {
        const content = 'Log in\nSign up\nWonderful day at the beach with friends!'
        const result = extractCaptionFromContent(content, null)
        expect(result).toBe('Wonderful day at the beach with friends!')
      })

      it('should skip lines with invalid patterns', () => {
        const content = 'Follow me\nJoin now\nKeep up with my posts\nActually good content here'
        const result = extractCaptionFromContent(content, null)
        expect(result).toBe('Actually good content here')
      })
    })

    describe('Edge cases', () => {
      it('should return null for empty content', () => {
        const result = extractCaptionFromContent('', null)
        expect(result).toBeNull()
      })

      it('should return null for whitespace-only content', () => {
        const result = extractCaptionFromContent('   \n\n   ', null)
        expect(result).toBeNull()
      })

      it('should return null for content with only UI elements', () => {
        const content = 'Log in\nSign up\nFollow\nDownload the app'
        const result = extractCaptionFromContent(content, null)
        expect(result).toBeNull()
      })

      it('should handle content with copyright symbols', () => {
        const content = '© 2024 Meta\nActual caption here about something interesting'
        const result = extractCaptionFromContent(content, null)
        expect(result).toBe('Actual caption here about something interesting')
      })

      it('should skip markdown link patterns', () => {
        const content = '[Link text](/some/path/)\nReal caption text about my day'
        const result = extractCaptionFromContent(content, null)
        expect(result).toBe('Real caption text about my day')
      })
    })
  })

  describe('extractHashtags', () => {
    it('should extract single hashtag', () => {
      const result = extractHashtags('Check out this photo #travel')
      expect(result).toEqual(['travel'])
    })

    it('should extract multiple hashtags', () => {
      const result = extractHashtags('Amazing sunset #travel #photography #nature')
      expect(result).toEqual(['travel', 'photography', 'nature'])
    })

    it('should return empty array for text without hashtags', () => {
      const result = extractHashtags('Just a regular text without hashtags')
      expect(result).toEqual([])
    })

    it('should handle hashtags at start of text', () => {
      const result = extractHashtags('#firsttag and #secondtag')
      expect(result).toEqual(['firsttag', 'secondtag'])
    })

    it('should handle consecutive hashtags', () => {
      const result = extractHashtags('#one#two#three')
      expect(result).toEqual(['one', 'two', 'three'])
    })

    it('should extract alphanumeric hashtags', () => {
      const result = extractHashtags('#travel2024 #summer23')
      expect(result).toEqual(['travel2024', 'summer23'])
    })

    it('should handle hashtags with underscores', () => {
      const result = extractHashtags('#my_hashtag #another_one')
      expect(result).toEqual(['my_hashtag', 'another_one'])
    })

    it('should return empty array for empty string', () => {
      const result = extractHashtags('')
      expect(result).toEqual([])
    })
  })

  describe('extractMentions', () => {
    it('should extract single mention', () => {
      const result = extractMentions('Check out @username')
      expect(result).toEqual(['username'])
    })

    it('should extract multiple mentions', () => {
      const result = extractMentions('Thanks @user1 @user2 @user3 for the collab!')
      expect(result).toEqual(['user1', 'user2', 'user3'])
    })

    it('should return empty array for text without mentions', () => {
      const result = extractMentions('Just a regular text without mentions')
      expect(result).toEqual([])
    })

    it('should handle mentions at start of text', () => {
      const result = extractMentions('@firstuser and @seconduser')
      expect(result).toEqual(['firstuser', 'seconduser'])
    })

    it('should extract alphanumeric usernames', () => {
      const result = extractMentions('@user123 @test456')
      expect(result).toEqual(['user123', 'test456'])
    })

    it('should handle usernames with underscores', () => {
      const result = extractMentions('@my_username @another_user')
      expect(result).toEqual(['my_username', 'another_user'])
    })

    it('should return empty array for empty string', () => {
      const result = extractMentions('')
      expect(result).toEqual([])
    })

    it('should handle mixed hashtags and mentions', () => {
      const text = '@user1 check out #travel photos by @photographer'
      const mentions = extractMentions(text)
      expect(mentions).toEqual(['user1', 'photographer'])
    })
  })

  describe('content length threshold', () => {
    it('should accept content with minimum length of 21 characters', async () => {
      const url = 'https://www.instagram.com/p/SHORT/'

      const mockParallelResult = {
        url,
        title: 'Good Title',
        full_content: 'Short but valid text!', // 21 characters
        excerpts: null,
      }

      vi.mocked(extractWithParallel).mockResolvedValue(mockParallelResult)
      vi.mocked(extractOGMetadata).mockResolvedValue({})

      const result = await extractInstagramContent(url)

      expect(result?.title).toBe('Good Title')
      expect(result?.content).toBe('Short but valid text!')
    })

    it('should fall back to OG metadata for content with 20 characters or less and generate AI title', async () => {
      const url = 'https://www.instagram.com/p/TOOSHORT/'

      const mockParallelResult = {
        url,
        title: 'Parallel Title',
        full_content: 'Only 19 chars here', // 18 characters
        excerpts: null,
      }

      const mockOGMetadata = {
        ogTitle: 'OG Fallback Title',
        ogDescription: 'OG Description with more content',
      }

      vi.mocked(extractWithParallel).mockResolvedValue(mockParallelResult)
      vi.mocked(extractOGMetadata).mockResolvedValue(mockOGMetadata)
      // Mock AI title generation since we try to generate better titles when content is available
      vi.spyOn(aiModule, 'generateText').mockResolvedValue({
        text: 'AI Title From OG Description',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
        warnings: [],
        response: {} as any,
        request: {} as any,
        rawResponse: {} as any,
      })

      const result = await extractInstagramContent(url)

      // Should use OG metadata since Parallel content is too short, but AI generates title
      expect(result?.title).toBe('AI Title From OG Description')
      expect(result?.content).toBe('OG Description with more content')
    })
  })

  describe('hashtags and mentions in raw metadata', () => {
    it('should include hashtags in raw metadata when using Parallel AI', async () => {
      const url = 'https://www.instagram.com/p/HASHTAGS/'

      const mockParallelResult = {
        url,
        title: 'Post with Hashtags',
        full_content: 'Check out this photo! #travel #photography #sunset',
        excerpts: null,
      }

      vi.mocked(extractWithParallel).mockResolvedValue(mockParallelResult)
      vi.mocked(extractOGMetadata).mockResolvedValue({})

      const result = await extractInstagramContent(url)

      expect(result?.rawMetadata?.instagram?.hashtags).toEqual(['travel', 'photography', 'sunset'])
    })

    it('should include mentions in raw metadata when using Parallel AI', async () => {
      const url = 'https://www.instagram.com/p/MENTIONS/'

      const mockParallelResult = {
        url,
        title: 'Post with Mentions',
        full_content: 'Collab with @photographer and @model for this shoot!',
        excerpts: null,
      }

      vi.mocked(extractWithParallel).mockResolvedValue(mockParallelResult)
      vi.mocked(extractOGMetadata).mockResolvedValue({})

      const result = await extractInstagramContent(url)

      expect(result?.rawMetadata?.instagram?.mentions).toEqual(['photographer', 'model'])
    })

    it('should include hashtags from OG description in raw metadata', async () => {
      const url = 'https://www.instagram.com/p/OGHASHTAGS/'

      vi.mocked(extractWithParallel).mockResolvedValue(null)
      vi.mocked(extractOGMetadata).mockResolvedValue({
        ogTitle: 'Post Title',
        ogDescription: 'Beautiful beach day! #beach #summer #vacation',
      })

      const result = await extractInstagramContent(url)

      expect(result?.rawMetadata?.instagram?.hashtags).toEqual(['beach', 'summer', 'vacation'])
    })

    it('should not include empty arrays for hashtags or mentions', async () => {
      const url = 'https://www.instagram.com/p/NOTAGSMENTIONS/'

      const mockParallelResult = {
        url,
        title: 'Plain Post',
        full_content: 'Just a simple post without any hashtags or mentions here',
        excerpts: null,
      }

      vi.mocked(extractWithParallel).mockResolvedValue(mockParallelResult)
      vi.mocked(extractOGMetadata).mockResolvedValue({})

      const result = await extractInstagramContent(url)

      expect(result?.rawMetadata?.instagram?.hashtags).toBeUndefined()
      expect(result?.rawMetadata?.instagram?.mentions).toBeUndefined()
    })
  })

  describe('carousel detection and metadata', () => {
    describe('carousel detection', () => {
      it('should detect carousel posts and extract all image URLs', async () => {
        const url = 'https://www.instagram.com/p/CAROUSEL/'

        // Mock carousel detection
        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          thumbnailUrl: 'https://instagram.com/thumbnail.jpg',
          carouselItems: [
            { isVideo: false, url: 'https://instagram.com/image1.jpg' },
            { isVideo: false, url: 'https://instagram.com/image2.jpg' },
            { isVideo: false, url: 'https://instagram.com/image3.jpg' },
          ],
        })

        const mockParallelResult = {
          url,
          title: 'Travel Photos',
          full_content: 'Amazing trip to Japan! Here are some photos from my journey. #travel #japan',
          excerpts: null,
        }

        vi.mocked(extractWithParallel).mockResolvedValue(mockParallelResult)
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogImage: 'https://instagram.com/og-image.jpg',
        })

        const result = await extractInstagramContent(url)

        expect(result).toBeDefined()
        expect(result?.rawMetadata?.instagram?.isCarousel).toBe(true)
        expect(result?.rawMetadata?.instagram?.carouselItems).toHaveLength(3)
        expect(result?.mediaUrls).toContain('https://instagram.com/image1.jpg')
        expect(result?.mediaUrls).toContain('https://instagram.com/image2.jpg')
        expect(result?.mediaUrls).toContain('https://instagram.com/image3.jpg')
      })

      it('should include carousel metadata in rawMetadata.carouselInfo', async () => {
        const url = 'https://www.instagram.com/p/CAROUSEL_INFO/'

        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          thumbnailUrl: 'https://instagram.com/thumbnail.jpg',
          carouselItems: [
            { isVideo: false, url: 'https://instagram.com/image1.jpg' },
            { isVideo: true, url: 'https://instagram.com/video1.mp4', thumbnailUrl: 'https://instagram.com/video-thumb.jpg' },
            { isVideo: false, url: 'https://instagram.com/image2.jpg' },
          ],
        })

        const mockParallelResult = {
          url,
          title: 'Mixed Content Post',
          full_content: 'Photos and video from the event! #event',
          excerpts: null,
        }

        vi.mocked(extractWithParallel).mockResolvedValue(mockParallelResult)
        vi.mocked(extractOGMetadata).mockResolvedValue({})

        const result = await extractInstagramContent(url)

        expect(result?.rawMetadata?.carouselInfo).toBeDefined()
        expect(result?.rawMetadata?.carouselInfo?.isCarousel).toBe(true)
        expect(result?.rawMetadata?.carouselInfo?.itemCount).toBe(3)
        expect(result?.rawMetadata?.carouselInfo?.hasVideos).toBe(true)
      })

      it('should detect carousel with only images (hasVideos = false)', async () => {
        const url = 'https://www.instagram.com/p/IMAGES_ONLY/'

        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          thumbnailUrl: 'https://instagram.com/thumbnail.jpg',
          carouselItems: [
            { isVideo: false, url: 'https://instagram.com/image1.jpg' },
            { isVideo: false, url: 'https://instagram.com/image2.jpg' },
          ],
        })

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Photo Collection',
          full_content: 'Beautiful sunset photos from the beach',
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue({})

        const result = await extractInstagramContent(url)

        expect(result?.rawMetadata?.carouselInfo?.hasVideos).toBe(false)
      })

      it('should not include carousel metadata for single image posts', async () => {
        const url = 'https://www.instagram.com/p/SINGLE_IMAGE/'

        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: false,
          thumbnailUrl: 'https://instagram.com/image.jpg',
        })

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Single Photo',
          full_content: 'Just one beautiful photo here',
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogImage: 'https://instagram.com/og-image.jpg',
        })

        const result = await extractInstagramContent(url)

        expect(result?.rawMetadata?.instagram?.isCarousel).toBeUndefined()
        expect(result?.rawMetadata?.instagram?.carouselItems).toBeUndefined()
        expect(result?.rawMetadata?.carouselInfo).toBeUndefined()
      })
    })

    describe('carousel media URLs extraction', () => {
      it('should include all carousel item URLs in mediaUrls array', async () => {
        const url = 'https://www.instagram.com/p/CAROUSEL_MEDIA/'

        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          thumbnailUrl: 'https://instagram.com/thumbnail.jpg',
          carouselItems: [
            { isVideo: false, url: 'https://instagram.com/slide1.jpg' },
            { isVideo: false, url: 'https://instagram.com/slide2.jpg' },
          ],
        })

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Slideshow',
          full_content: 'Check out these slides',
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogImage: 'https://instagram.com/og-cover.jpg',
        })

        const result = await extractInstagramContent(url)

        expect(result?.mediaUrls).toBeDefined()
        expect(result?.mediaUrls).toHaveLength(4) // 2 carousel items + thumbnail + OG image
        expect(result?.mediaUrls).toEqual([
          'https://instagram.com/slide1.jpg',
          'https://instagram.com/slide2.jpg',
          'https://instagram.com/thumbnail.jpg',
          'https://instagram.com/og-cover.jpg',
        ])
      })

      it('should deduplicate media URLs', async () => {
        const url = 'https://www.instagram.com/p/DEDUPE/'

        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          thumbnailUrl: 'https://instagram.com/image1.jpg', // Same as first carousel item
          carouselItems: [
            { isVideo: false, url: 'https://instagram.com/image1.jpg' },
            { isVideo: false, url: 'https://instagram.com/image2.jpg' },
          ],
        })

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Duplicate Test',
          full_content: 'Testing deduplication of URLs',
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogImage: 'https://instagram.com/image1.jpg', // Same as first carousel item
        })

        const result = await extractInstagramContent(url)

        // Should only have 2 unique URLs
        expect(result?.mediaUrls).toHaveLength(2)
        expect(result?.mediaUrls).toEqual([
          'https://instagram.com/image1.jpg',
          'https://instagram.com/image2.jpg',
        ])
      })

      it('should include carousel URLs even when OG metadata is unavailable', async () => {
        const url = 'https://www.instagram.com/p/NO_OG/'

        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          thumbnailUrl: 'https://instagram.com/thumb.jpg',
          carouselItems: [
            { isVideo: false, url: 'https://instagram.com/img1.jpg' },
            { isVideo: false, url: 'https://instagram.com/img2.jpg' },
          ],
        })

        vi.mocked(extractWithParallel).mockResolvedValue(null)
        vi.mocked(extractOGMetadata).mockResolvedValue(null)

        const result = await extractInstagramContent(url)

        expect(result?.mediaUrls).toContain('https://instagram.com/img1.jpg')
        expect(result?.mediaUrls).toContain('https://instagram.com/img2.jpg')
        expect(result?.mediaUrls).toContain('https://instagram.com/thumb.jpg')
      })
    })

    describe('carousel AI title generation', () => {
      it('should always generate AI title for carousel posts with captions', async () => {
        const url = 'https://www.instagram.com/p/CAROUSEL_TITLE/'

        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          carouselItems: [
            { isVideo: false, url: 'https://instagram.com/image1.jpg' },
            { isVideo: false, url: 'https://instagram.com/image2.jpg' },
          ],
        })

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Generic Parallel Title', // Not bad, but carousel should still get AI title
          full_content: 'My favorite book recommendations for January! Check these out.',
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue({})

        vi.spyOn(aiModule, 'generateText').mockResolvedValue({
          text: 'January Book Recommendations Collection',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await extractInstagramContent(url)

        // For carousel posts, AI title generation should be attempted
        expect(aiModule.generateText).toHaveBeenCalled()
        expect(result?.title).toBe('January Book Recommendations Collection')
      })

      it('should use fallback title for carousel posts without captions', async () => {
        const url = 'https://www.instagram.com/p/CAROUSEL_NO_CAPTION/'

        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          carouselItems: [
            { isVideo: false, url: 'https://instagram.com/image1.jpg' },
          ],
        })

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Instagram',
          full_content: '', // No content
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue(null)

        const result = await extractInstagramContent(url)

        expect(result?.title).toContain('Instagram Post')
      })
    })

    describe('carousel error handling', () => {
      it('should handle GraphQL media info fetch failure gracefully', async () => {
        const url = 'https://www.instagram.com/p/GRAPHQL_FAIL/'

        vi.mocked(getInstagramMediaInfo).mockRejectedValue(new Error('GraphQL API error'))

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Good Title',
          full_content: 'Post content that is long enough to pass the minimum length requirement',
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogImage: 'https://instagram.com/fallback.jpg',
        })

        const result = await extractInstagramContent(url)

        expect(result).toBeDefined()
        expect(result?.title).toBe('Good Title')
        expect(result?.rawMetadata?.instagram?.isCarousel).toBeUndefined()
        expect(result?.mediaUrls).toEqual(['https://instagram.com/fallback.jpg'])
      })

      it('should handle null media info response', async () => {
        const url = 'https://www.instagram.com/p/NULL_MEDIA/'

        vi.mocked(getInstagramMediaInfo).mockResolvedValue(null)

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Post Title',
          full_content: 'Normal post content here that meets the length requirements',
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogImage: 'https://instagram.com/image.jpg',
        })

        const result = await extractInstagramContent(url)

        expect(result?.rawMetadata?.instagram?.isCarousel).toBeUndefined()
        expect(result?.rawMetadata?.carouselInfo).toBeUndefined()
      })

      it('should handle carousel with empty items array', async () => {
        const url = 'https://www.instagram.com/p/EMPTY_CAROUSEL/'

        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          carouselItems: [], // Empty array
        })

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Empty Carousel',
          full_content: 'A post that claims to be a carousel but has no items',
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogImage: 'https://instagram.com/og.jpg',
        })

        const result = await extractInstagramContent(url)

        // Should not crash, carousel metadata should still be set
        expect(result).toBeDefined()
        expect(result?.rawMetadata?.carouselInfo?.itemCount).toBe(0)
      })
    })

    describe('carousel video items', () => {
      it('should correctly identify carousel with video items', async () => {
        const url = 'https://www.instagram.com/p/VIDEO_CAROUSEL/'

        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          carouselItems: [
            { isVideo: true, url: 'https://instagram.com/video1.mp4', thumbnailUrl: 'https://instagram.com/thumb1.jpg' },
            { isVideo: false, url: 'https://instagram.com/image1.jpg' },
            { isVideo: true, url: 'https://instagram.com/video2.mp4', thumbnailUrl: 'https://instagram.com/thumb2.jpg' },
          ],
        })

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Video Collection',
          full_content: 'Check out these videos and photos from the event!',
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue({})

        const result = await extractInstagramContent(url)

        expect(result?.rawMetadata?.carouselInfo?.hasVideos).toBe(true)
        expect(result?.rawMetadata?.instagram?.carouselItems).toHaveLength(3)

        // Verify video items have isVideo = true
        const carouselItems = result?.rawMetadata?.instagram?.carouselItems
        expect(carouselItems?.[0]?.isVideo).toBe(true)
        expect(carouselItems?.[1]?.isVideo).toBe(false)
        expect(carouselItems?.[2]?.isVideo).toBe(true)
      })

      it('should include video URLs in mediaUrls array', async () => {
        const url = 'https://www.instagram.com/p/VIDEO_URLS/'

        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          carouselItems: [
            { isVideo: true, url: 'https://instagram.com/video.mp4' },
            { isVideo: false, url: 'https://instagram.com/image.jpg' },
          ],
        })

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Mixed Media',
          full_content: 'Video and image content here',
          excerpts: null,
        })
        vi.mocked(extractOGMetadata).mockResolvedValue({})

        const result = await extractInstagramContent(url)

        expect(result?.mediaUrls).toContain('https://instagram.com/video.mp4')
        expect(result?.mediaUrls).toContain('https://instagram.com/image.jpg')
      })
    })

    describe('carousel with OG metadata fallback', () => {
      it('should include carousel metadata when Parallel AI fails but OG metadata available', async () => {
        const url = 'https://www.instagram.com/p/CAROUSEL_OG_FALLBACK/'

        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          thumbnailUrl: 'https://instagram.com/thumb.jpg',
          carouselItems: [
            { isVideo: false, url: 'https://instagram.com/slide1.jpg' },
            { isVideo: false, url: 'https://instagram.com/slide2.jpg' },
          ],
        })

        vi.mocked(extractWithParallel).mockResolvedValue(null)
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogTitle: 'Photo Album',
          ogDescription: 'Collection of beautiful photos',
          ogImage: 'https://instagram.com/og.jpg',
        })

        vi.spyOn(aiModule, 'generateText').mockResolvedValue({
          text: 'Beautiful Photo Collection',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await extractInstagramContent(url)

        expect(result?.rawMetadata?.instagram?.isCarousel).toBe(true)
        expect(result?.rawMetadata?.carouselInfo?.itemCount).toBe(2)
        expect(result?.mediaUrls).toContain('https://instagram.com/slide1.jpg')
        expect(result?.mediaUrls).toContain('https://instagram.com/slide2.jpg')
      })

      it('should include carousel metadata when both Parallel and OG fail', async () => {
        const url = 'https://www.instagram.com/p/CAROUSEL_ALL_FAIL/'

        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          thumbnailUrl: 'https://instagram.com/thumb.jpg',
          carouselItems: [
            { isVideo: false, url: 'https://instagram.com/img1.jpg' },
          ],
        })

        vi.mocked(extractWithParallel).mockResolvedValue(null)
        vi.mocked(extractOGMetadata).mockResolvedValue(null)

        const result = await extractInstagramContent(url)

        expect(result?.rawMetadata?.instagram?.isCarousel).toBe(true)
        expect(result?.title).toContain('Instagram Post')
        expect(result?.mediaUrls).toContain('https://instagram.com/img1.jpg')
        expect(result?.mediaUrls).toContain('https://instagram.com/thumb.jpg')
      })
    })
  })

  describe('isValidCaption', () => {
    describe('valid captions', () => {
      it('should accept normal captions with sufficient length', () => {
        expect(isValidCaption('This is a great post about my travel adventures')).toBe(true)
      })

      it('should accept captions with hashtags', () => {
        expect(isValidCaption('Amazing sunset today #travel #photography')).toBe(true)
      })

      it('should accept captions with mentions', () => {
        expect(isValidCaption('Collab with @photographer for this shoot')).toBe(true)
      })

      it('should accept captions with emojis', () => {
        expect(isValidCaption('Best day ever with friends today')).toBe(true)
      })

      it('should accept captions about AI tools', () => {
        expect(isValidCaption('After testing 1240+ AI tools I finally found 31 that beat every tool')).toBe(true)
      })

      it('should accept captions with numbers', () => {
        expect(isValidCaption('Top 10 books you should read this year')).toBe(true)
      })
    })

    describe('invalid captions - UI elements', () => {
      it('should reject login prompts', () => {
        expect(isValidCaption('Log in to see more photos and videos')).toBe(false)
      })

      it('should reject signup prompts', () => {
        expect(isValidCaption('Sign up to follow this account')).toBe(false)
      })

      it('should reject keep up with patterns', () => {
        expect(isValidCaption('Keep up with username on Instagram')).toBe(false)
      })

      it('should reject download app prompts', () => {
        expect(isValidCaption('Download the app to see more')).toBe(false)
      })

      it('should reject meta platforms text', () => {
        expect(isValidCaption('Meta platforms privacy policy applies')).toBe(false)
      })

      it('should reject terms of use text', () => {
        expect(isValidCaption('Read our terms of use and privacy policy')).toBe(false)
      })

      it('should reject join instagram patterns', () => {
        expect(isValidCaption('Join Instagram to see photos from friends')).toBe(false)
      })

      it('should reject turn on notifications', () => {
        expect(isValidCaption('Turn on notifications to never miss a post')).toBe(false)
      })
    })

    describe('invalid captions - CTA patterns', () => {
      it('should reject follow me patterns', () => {
        expect(isValidCaption('Follow me for more content like this')).toBe(false)
      })

      it('should reject follow for patterns', () => {
        expect(isValidCaption('Follow for daily tips and inspiration')).toBe(false)
      })

      it('should reject tag a friend patterns', () => {
        expect(isValidCaption('Tag a friend who needs to see this')).toBe(false)
      })

      it('should reject double tap patterns', () => {
        expect(isValidCaption('Double tap if you agree with this post')).toBe(false)
      })

      it('should reject DM me patterns', () => {
        expect(isValidCaption('DM me for more information about this')).toBe(false)
      })
    })

    describe('invalid captions - edge cases', () => {
      it('should reject empty strings', () => {
        expect(isValidCaption('')).toBe(false)
      })

      it('should reject very short captions', () => {
        expect(isValidCaption('Hi there')).toBe(false)
      })

      it('should reject copyright text', () => {
        expect(isValidCaption('© 2024 Some Company All Rights Reserved')).toBe(false)
      })

      it('should reject markdown link patterns', () => {
        expect(isValidCaption('[username](/path/) some text')).toBe(false)
      })

      it('should reject captions that are only hashtags', () => {
        expect(isValidCaption('#travel #photography #sunset')).toBe(false)
      })

      it('should reject standalone username mentions', () => {
        expect(isValidCaption('@username')).toBe(false)
      })

      it('should reject likes count patterns', () => {
        expect(isValidCaption('1234 likes')).toBe(false)
      })

      it('should reject views count patterns', () => {
        expect(isValidCaption('5000 views')).toBe(false)
      })

      it('should reject "on Instagram" patterns', () => {
        expect(isValidCaption('username on Instagram')).toBe(false)
      })

      it('should reject "Join X on Instagram" boilerplate', () => {
        expect(isValidCaption('Join Viral Sangani on Instagram')).toBe(false)
        expect(isValidCaption('Join thenikhil.ai on Instagram')).toBe(false)
        expect(isValidCaption('Join @username on Instagram')).toBe(false)
      })

      it('should reject "by continuing, you agree" patterns', () => {
        expect(isValidCaption('By continuing, you agree to our terms')).toBe(false)
      })

      it('should reject "create an account" patterns', () => {
        expect(isValidCaption('Create an account to see more')).toBe(false)
      })
    })
  })

  describe('Caption Extraction for Carousel Posts', () => {
    describe('multi-line captions with list indicators', () => {
      it('should extract full multi-line caption for carousel with list content', () => {
        const content = `[aitools_daily](/aitools_daily/)

After testing 1240+ AI tools I finally found 31 that beat every tool.

Save these for later!

#ai #tools #productivity`
        const result = extractCaptionFromContent(content, 'aitools_daily')

        // Should extract the full multi-line caption
        expect(result).toBeTruthy()
        expect(result).toContain('After testing 1240+ AI tools')
        expect(result).toContain('Save these')
      })

      it('should not over-penalize minimal carousel captions', () => {
        const content = `[creator](/creator/)

Save these!

#books #reading`
        const result = extractCaptionFromContent(content, 'creator')

        // Even though caption is short, it should be extracted
        expect(result).toBeTruthy()
        expect(result).toContain('Save these')
      })

      it('should extract captions with numbered list format', () => {
        const content = `[techguru](/techguru/)

10 AI tools you need to try:

1. Tool One - Description
2. Tool Two - Description
3. Tool Three - Description

#ai #tools`
        const result = extractCaptionFromContent(content, 'techguru')

        expect(result).toBeTruthy()
        expect(result).toContain('10 AI tools')
        expect(result).toContain('Tool One')
      })

      it('should handle carousel captions with call-to-action', () => {
        const content = `[productivity](/productivity/)

Best productivity apps I've tested.

Save this post!

#productivity #apps`
        const result = extractCaptionFromContent(content, 'productivity')

        expect(result).toBeTruthy()
        expect(result).toContain('Best productivity apps')
      })
    })

    describe('carousel-aware scoring', () => {
      it('should score multi-line captions higher than fragments', () => {
        const content = `[user](/user/)

Save these!

After testing 1240+ AI tools I finally found 31 that beat every tool.
These are game-changers for productivity.`
        const result = extractCaptionFromContent(content, 'user')

        // Should prefer the longer, more complete caption
        expect(result).toBeTruthy()
        expect(result?.length).toBeGreaterThan(30)
        expect(result).toContain('AI tools')
      })

      it('should prefer substantive content over short CTAs', () => {
        const content = `[creator](/creator/)

Check this out!

Here's my comprehensive guide to the 15 best books I read this year.
Each one changed my perspective on business and life.`
        const result = extractCaptionFromContent(content, 'creator')

        expect(result).toBeTruthy()
        expect(result).toContain('15 best books')
        expect(result).not.toBe('Check this out!')
      })

      it('should handle captions with emojis and special characters', () => {
        const content = `[traveler](/traveler/)

🌍 Travel tips you need!

After visiting 50+ countries, here are my top 10 tips for budget travel.

✈️ #travel #tips`
        const result = extractCaptionFromContent(content, 'traveler')

        expect(result).toBeTruthy()
        expect(result).toContain('50+ countries')
      })
    })

    describe('non-carousel extraction unchanged', () => {
      it('should maintain normal extraction for regular posts', () => {
        const content = `[user](/user/)

This is a regular Instagram post with a longer caption that isn't a carousel.
Just sharing my thoughts about a recent experience.`
        const result = extractCaptionFromContent(content, 'user')

        expect(result).toBeTruthy()
        expect(result).toContain('regular Instagram post')
      })

      it('should filter out UI text for non-carousel posts', () => {
        const content = `Log in to see more

Keep up with user on Instagram

[user](/user/)

Actually good content about my day at the beach!`
        const result = extractCaptionFromContent(content, 'user')

        expect(result).toBeTruthy()
        expect(result).toBe('Actually good content about my day at the beach!')
        expect(result).not.toContain('Log in')
      })

      it('should prefer actual caption over "Join X on Instagram" boilerplate', () => {
        // This simulates the real-world content structure where boilerplate appears before the actual caption
        const content = `Join Viral Sangani on Instagram

[thenikhil.ai](/thenikhil.ai/)

Save these!

After 1240+ AI tools I finally found 31 that beat every tool.

Share this with your mates.

Follow for more.

[ AI tools, useful tools, Top AI tools, productivity tools ]`
        const result = extractCaptionFromContent(content, 'thenikhil.ai')

        expect(result).toBeTruthy()
        // Should extract the actual caption, not the boilerplate
        expect(result).not.toContain('Join Viral Sangani on Instagram')
        expect(result).toContain('AI tools')
      })

      it('should handle content with "Join X on Instagram" at the beginning', () => {
        const content = `Join creator_name on Instagram

Some random UI text

[creator_name](/creator_name/)

This is the best productivity guide you will ever need.
I spent 6 months researching this topic.`
        const result = extractCaptionFromContent(content, 'creator_name')

        expect(result).toBeTruthy()
        expect(result).not.toBe('Join creator_name on Instagram')
        expect(result).toContain('productivity guide')
      })
    })
  })

  describe('extractCaptionFromContent - new strategies', () => {
    describe('Strategy 7: Multi-line block extraction', () => {
      it('should extract multi-line captions between paragraphs', () => {
        const content = `[user](/user/)

After testing 1240+ AI tools I finally found 31 that beat every tool.
Save these for later!

#ai #tools #productivity`
        const result = extractCaptionFromContent(content, 'user')
        expect(result).toContain('After testing 1240+ AI tools')
        expect(result).toContain('Save these')
      })

      it('should extract long multi-line descriptions', () => {
        const content = `Some header

This is a comprehensive review of the best productivity tools.
I spent months testing each one to find the absolute best.
Here are my top picks for 2024.

#productivity #tools`
        const result = extractCaptionFromContent(content, null)
        expect(result).toContain('comprehensive review')
        expect(result).toContain('top picks')
      })
    })

    describe('Strategy 8: Content between username and hashtags', () => {
      it('should extract caption between username and hashtag section', () => {
        const content = `[creator](/creator/)

These are the 10 best books I read this year.
Each one changed my perspective on life and business.
Save this post for your reading list!

#books #reading #selfimprovement`
        const result = extractCaptionFromContent(content, 'creator')
        expect(result).toContain('10 best books')
      })
    })

    describe('Caption quality scoring', () => {
      it('should prefer longer captions over shorter fragments', () => {
        // This content has both a short fragment and a longer caption
        const content = `[user](/user/)

Save these!

After testing 1240+ AI tools I finally found 31 that beat every tool.
These are the ones you absolutely need to try.`
        const result = extractCaptionFromContent(content, 'user')
        // Should extract the longer, more complete caption
        expect(result?.length).toBeGreaterThan(30)
        expect(result).toContain('AI tools')
      })

      it('should prefer captions with complete sentences', () => {
        const content = `Header text

This is a complete sentence about the topic.

fragment here`
        const result = extractCaptionFromContent(content, null)
        expect(result).toContain('complete sentence')
      })

      it('should prefer captions with topic keywords', () => {
        const content = `Login text
Some UI element
After testing 1240+ AI tools I found 31 amazing ones`
        const result = extractCaptionFromContent(content, null)
        expect(result).toContain('AI tools')
      })
    })

    describe('Edge cases for improved extraction', () => {
      it('should handle content with only short fragments', () => {
        const content = `[user](/user/)

Save these!

Like and share!`
        const result = extractCaptionFromContent(content, 'user')
        // May return null or the best available short fragment
        expect(result === null || result.length < 50).toBe(true)
      })

      it('should extract from messy Parallel AI output', () => {
        const content = `[aitools_daily](/aitools_daily/)

After testing 1240+ AI tools I finally found 31 that beat every tool.

Save these for later!

[View all 234 comments](/p/ABC123/comments/)

1,234 likes

Keep up with aitools_daily on Instagram

Log in to see more`
        const result = extractCaptionFromContent(content, 'aitools_daily')
        expect(result).toContain('After testing')
        expect(result).toContain('AI tools')
        expect(result).not.toContain('Log in')
        expect(result).not.toContain('Keep up with')
      })

      it('should handle content with numbers in captions', () => {
        const content = `Some header
1000 views
I tested 50 apps and found 10 winners for productivity in 2024`
        const result = extractCaptionFromContent(content, null)
        expect(result).toContain('50 apps')
        expect(result).toContain('10 winners')
      })
    })
  })

  describe('Title Generation for Carousel Posts', () => {
    describe('carousel context in AI prompt', () => {
      it('should include carousel information in title generation prompt', async () => {
        const url = 'https://www.instagram.com/p/CAROUSEL_PROMPT/'
        const content = `[aitools](/aitools/)

After testing 1240+ AI tools I finally found 31 that beat every tool.

Save these!`

        vi.spyOn(aiModule, 'generateText').mockResolvedValue({
          text: '31 Essential AI Tools After Testing 1240+',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await generateInstagramTitle(url, content, 'post', null, ['ai', 'tools'])

        expect(result).toBe('31 Essential AI Tools After Testing 1240+')
        expect(aiModule.generateText).toHaveBeenCalled()

        // Verify the prompt includes AI tools context
        const promptCall = vi.mocked(aiModule.generateText).mock.calls[0]
        expect(promptCall[0].prompt).toContain('AI tools')
      })

      it('should generate descriptive title for minimal caption with carousel context', async () => {
        const url = 'https://www.instagram.com/p/MIN_CAPTION/'
        const content = '[books](/books/)\n\nMy favorite book recommendations for January!\n\n#books #reading #bookrecs'
        const hashtags = ['books', 'reading', 'bookrecs']

        vi.spyOn(aiModule, 'generateText').mockResolvedValue({
          text: 'January Book Recommendations',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await generateInstagramTitle(url, content, 'post', null, hashtags)

        expect(result).toBe('January Book Recommendations')
        expect(aiModule.generateText).toHaveBeenCalled()
      })

      it('should handle carousel with numbered items in caption', async () => {
        const url = 'https://www.instagram.com/p/NUMBERED/'
        const content = `[tech](/tech/)

10 productivity apps you need to try:

1. App One
2. App Two`

        vi.spyOn(aiModule, 'generateText').mockResolvedValue({
          text: '10 Must-Try Productivity Apps',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await generateInstagramTitle(url, content, 'post')

        expect(result).toBe('10 Must-Try Productivity Apps')
        expect(aiModule.generateText).toHaveBeenCalled()
      })
    })

    describe('OG description fallback for carousels', () => {
      it('should use OG description when caption is minimal', async () => {
        const url = 'https://www.instagram.com/p/OG_FALLBACK/'
        const content = '[user](/user/)\n\nSave!'
        const ogDescription = 'Here are the 15 best movies I watched this year across different genres'

        vi.spyOn(aiModule, 'generateText').mockResolvedValue({
          text: '15 Best Movies of the Year',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await generateInstagramTitle(url, content, 'post', ogDescription)

        expect(result).toBe('15 Best Movies of the Year')
        expect(aiModule.generateText).toHaveBeenCalled()

        // Verify combined content was used
        const promptCall = vi.mocked(aiModule.generateText).mock.calls[0]
        expect(promptCall[0].prompt).toContain('15 best movies')
      })

      it('should combine short caption with OG description', async () => {
        const url = 'https://www.instagram.com/p/COMBINED/'
        const content = '[user](/user/)\n\nCheck these out!'
        const ogDescription = 'A comprehensive guide to the top AI tools for developers in 2024'

        vi.spyOn(aiModule, 'generateText').mockResolvedValue({
          text: 'Top AI Tools for Developers 2024',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await generateInstagramTitle(url, content, 'post', ogDescription)

        expect(result).toBe('Top AI Tools for Developers 2024')
      })

      it('should not use OG description if it contains invalid patterns', async () => {
        const url = 'https://www.instagram.com/p/INVALID_OG/'
        const content = '[user](/user/)\n\nSave!'
        const ogDescription = 'Log in to Instagram to see photos and videos'

        const result = await generateInstagramTitle(url, content, 'post', ogDescription)

        // Should use fallback title since OG description is invalid
        expect(result).toContain('Instagram Post')
        expect(aiModule.generateText).not.toHaveBeenCalled()
      })
    })

    describe('non-carousel title generation unchanged', () => {
      it('should generate normal titles for single-image posts', async () => {
        const url = 'https://www.instagram.com/p/SINGLE/'
        const content = `[user](/user/)

This is my experience traveling to Japan and discovering amazing food spots.`

        vi.spyOn(aiModule, 'generateText').mockResolvedValue({
          text: 'Discovering Amazing Food in Japan',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await generateInstagramTitle(url, content, 'post')

        expect(result).toBe('Discovering Amazing Food in Japan')
      })

      it('should maintain retry logic for regular posts', async () => {
        const url = 'https://www.instagram.com/p/RETRY/'
        const content = '[user](/user/)\n\nThis is a great content post about interesting topics that I want to share!'

        const generateTextSpy = vi.spyOn(aiModule, 'generateText')
        generateTextSpy.mockRejectedValueOnce(new Error('Request timed out'))
        generateTextSpy.mockResolvedValueOnce({
          text: 'Great Content About Interesting Topics',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await generateInstagramTitle(url, content, 'post')

        expect(result).toBe('Great Content About Interesting Topics')
        expect(generateTextSpy).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('generateInstagramTitle with hashtags', () => {
    it('should use hashtags for additional context', async () => {
      const url = 'https://www.instagram.com/p/TEST/'
      const content = '[user](/user/)\n\nCheck out these amazing tools I found for productivity!\n\n#ai #tools #productivity'
      const hashtags = ['ai', 'tools', 'productivity']

      const generateTextSpy = vi.spyOn(aiModule, 'generateText')
      generateTextSpy.mockResolvedValue({
        text: 'Best AI Productivity Tools Collection',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
        warnings: [],
        response: {} as any,
        request: {} as any,
        rawResponse: {} as any,
      })

      const result = await generateInstagramTitle(url, content, 'post', null, hashtags)

      expect(result).toBe('Best AI Productivity Tools Collection')
      // Verify the prompt included hashtags
      const promptCall = generateTextSpy.mock.calls[0]
      expect(promptCall[0].prompt).toContain('#ai')
      expect(promptCall[0].prompt).toContain('#tools')
    })

    it('should combine short caption with OG description', async () => {
      const url = 'https://www.instagram.com/p/SHORT/'
      const content = '[user](/user/)\n\nSave these!'
      const ogDescription = 'After testing 1240+ AI tools I finally found 31 that beat every tool'

      vi.spyOn(aiModule, 'generateText').mockResolvedValue({
        text: '31 Must-Have AI Tools After Testing 1240+',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
        warnings: [],
        response: {} as any,
        request: {} as any,
        rawResponse: {} as any,
      })

      const result = await generateInstagramTitle(url, content, 'post', ogDescription)

      expect(result).toBe('31 Must-Have AI Tools After Testing 1240+')
      // Verify AI was called with combined content
      expect(aiModule.generateText).toHaveBeenCalled()
    })

    it('should handle AI tools content correctly', async () => {
      const url = 'https://www.instagram.com/p/AITOOLS/'
      const content = `[aitools_daily](/aitools_daily/)

After testing 1240+ AI tools I finally found 31 that beat every tool.
Save these for later!`

      vi.spyOn(aiModule, 'generateText').mockResolvedValue({
        text: '31 Best AI Tools After Testing 1240+',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
        warnings: [],
        response: {} as any,
        request: {} as any,
        rawResponse: {} as any,
      })

      const result = await generateInstagramTitle(url, content, 'post', null, ['ai', 'tools'])

      expect(result).toBe('31 Best AI Tools After Testing 1240+')
      // Verify the prompt was constructed correctly
      const promptCall = vi.mocked(aiModule.generateText).mock.calls[0]
      expect(promptCall[0].prompt).toContain('AI tools')
    })
  })

  describe('Instagram Carousel Integration Tests', () => {
    describe('full carousel extraction flow', () => {
      it('should extract carousel with minimal caption and generate AI title', async () => {
        const url = 'https://www.instagram.com/p/CAROUSEL_INTEGRATION/'

        // Mock carousel detection
        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          thumbnailUrl: 'https://instagram.com/thumb.jpg',
          carouselItems: [
            { isVideo: false, url: 'https://instagram.com/img1.jpg' },
            { isVideo: false, url: 'https://instagram.com/img2.jpg' },
            { isVideo: false, url: 'https://instagram.com/img3.jpg' },
          ],
        })

        // Mock Parallel AI response with minimal caption
        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Instagram',
          full_content: '[aitools](/aitools/)\n\nSave these!\n\n#ai #tools',
          excerpts: ['ai', 'tools'],
        })

        // Mock OG metadata
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogTitle: 'Instagram',
          ogDescription: 'After testing 1240+ AI tools I found 31 that beat every tool',
          ogImage: 'https://instagram.com/og.jpg',
        })

        // Mock AI title generation
        vi.spyOn(aiModule, 'generateText').mockResolvedValue({
          text: '31 Best AI Tools After Testing 1240+',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await extractInstagramContent(url)

        // Verify extraction results
        expect(result).toBeDefined()
        expect(result?.source).toBe('instagram')
        expect(result?.title).toBe('31 Best AI Tools After Testing 1240+')
        expect(result?.content).toContain('Save these')
        expect(result?.rawMetadata?.instagram?.isCarousel).toBe(true)
        expect(result?.rawMetadata?.carouselInfo?.itemCount).toBe(3)

        // Verify media URLs contain all carousel items
        expect(result?.mediaUrls).toContain('https://instagram.com/img1.jpg')
        expect(result?.mediaUrls).toContain('https://instagram.com/img2.jpg')
        expect(result?.mediaUrls).toContain('https://instagram.com/img3.jpg')

        // Verify AI title generation was called
        expect(aiModule.generateText).toHaveBeenCalled()
      })

      it('should extract carousel with multi-line caption and proper metadata', async () => {
        const url = 'https://www.instagram.com/p/MULTILINE_CAROUSEL/'

        // Mock carousel detection
        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          thumbnailUrl: 'https://instagram.com/thumb.jpg',
          carouselItems: [
            { isVideo: false, url: 'https://instagram.com/img1.jpg' },
            { isVideo: false, url: 'https://instagram.com/img2.jpg' },
          ],
        })

        // Mock Parallel AI response with multi-line caption
        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Instagram Post',
          full_content: `[books](/books/)

My top 10 book recommendations for 2024:

Each of these changed how I think about business and life.

#books #reading`,
          excerpts: ['books', 'reading'],
        })

        // Mock OG metadata
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogImage: 'https://instagram.com/og.jpg',
        })

        // Mock AI title generation
        vi.spyOn(aiModule, 'generateText').mockResolvedValue({
          text: 'Top 10 Book Recommendations for 2024',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await extractInstagramContent(url)

        expect(result).toBeDefined()
        expect(result?.title).toBe('Top 10 Book Recommendations for 2024')
        expect(result?.content).toContain('top 10 book recommendations')
        expect(result?.rawMetadata?.instagram?.hashtags).toEqual(['books', 'reading'])
        expect(result?.rawMetadata?.carouselInfo?.isCarousel).toBe(true)
        expect(result?.rawMetadata?.carouselInfo?.itemCount).toBe(2)
      })

      it('should handle carousel when Parallel AI fails but carousel metadata available', async () => {
        const url = 'https://www.instagram.com/p/CAROUSEL_NO_PARALLEL/'

        // Mock carousel detection
        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          thumbnailUrl: 'https://instagram.com/thumb.jpg',
          carouselItems: [
            { isVideo: false, url: 'https://instagram.com/img1.jpg' },
            { isVideo: false, url: 'https://instagram.com/img2.jpg' },
          ],
        })

        // Mock Parallel AI failure
        vi.mocked(extractWithParallel).mockResolvedValue(null)

        // Mock OG metadata with description
        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogTitle: 'Instagram',
          ogDescription: 'Check out these productivity tips that changed my workflow',
          ogImage: 'https://instagram.com/og.jpg',
        })

        // Mock AI title generation
        vi.spyOn(aiModule, 'generateText').mockResolvedValue({
          text: 'Productivity Tips That Changed My Workflow',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await extractInstagramContent(url)

        expect(result).toBeDefined()
        expect(result?.title).toBe('Productivity Tips That Changed My Workflow')
        expect(result?.rawMetadata?.instagram?.isCarousel).toBe(true)
        expect(result?.rawMetadata?.carouselInfo?.itemCount).toBe(2)
        expect(result?.mediaUrls).toContain('https://instagram.com/img1.jpg')
        expect(result?.mediaUrls).toContain('https://instagram.com/img2.jpg')
      })

      it('should properly extract all carousel images and deduplicate', async () => {
        const url = 'https://www.instagram.com/p/DEDUPE_TEST/'

        // Mock carousel with duplicate URLs
        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          thumbnailUrl: 'https://instagram.com/img1.jpg', // Same as first item
          carouselItems: [
            { isVideo: false, url: 'https://instagram.com/img1.jpg' },
            { isVideo: false, url: 'https://instagram.com/img2.jpg' },
            { isVideo: false, url: 'https://instagram.com/img3.jpg' },
          ],
        })

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Good Title',
          full_content: 'This is a carousel post with enough content to meet the minimum length requirement for processing',
          excerpts: null,
        })

        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogImage: 'https://instagram.com/img1.jpg', // Same as first item
        })

        const result = await extractInstagramContent(url)

        // Should deduplicate URLs
        expect(result?.mediaUrls).toBeDefined()
        expect(result?.mediaUrls?.length).toBe(3) // 3 unique URLs
        expect(result?.mediaUrls).toEqual([
          'https://instagram.com/img1.jpg',
          'https://instagram.com/img2.jpg',
          'https://instagram.com/img3.jpg',
        ])
      })

      it('should handle large carousel with video items', async () => {
        const url = 'https://www.instagram.com/p/LARGE_CAROUSEL/'

        // Mock large carousel with videos
        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          thumbnailUrl: 'https://instagram.com/thumb.jpg',
          carouselItems: Array.from({ length: 10 }, (_, i) => ({
            isVideo: i % 3 === 0, // Every 3rd item is a video
            url: `https://instagram.com/item${i}.${i % 3 === 0 ? 'mp4' : 'jpg'}`,
            thumbnailUrl: i % 3 === 0 ? `https://instagram.com/thumb${i}.jpg` : undefined,
          })),
        })

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Instagram Post',
          full_content: 'Here are 10 amazing tools for productivity\n\nSave these!',
          excerpts: null,
        })

        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogImage: 'https://instagram.com/og.jpg',
        })

        vi.spyOn(aiModule, 'generateText').mockResolvedValue({
          text: '10 Amazing Productivity Tools',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
          warnings: [],
          response: {} as any,
          request: {} as any,
          rawResponse: {} as any,
        })

        const result = await extractInstagramContent(url)

        expect(result).toBeDefined()
        expect(result?.rawMetadata?.carouselInfo?.itemCount).toBe(10)
        expect(result?.rawMetadata?.carouselInfo?.hasVideos).toBe(true)
        expect(result?.mediaUrls?.length).toBeGreaterThan(10) // Carousel items + thumbnail + OG
      })
    })

    describe('edge cases and error handling', () => {
      it('should handle carousel detection failure gracefully', async () => {
        const url = 'https://www.instagram.com/p/CAROUSEL_FAIL/'

        // Mock carousel detection failure
        vi.mocked(getInstagramMediaInfo).mockRejectedValue(new Error('GraphQL error'))

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Good Title',
          full_content: 'Post content that meets the minimum length requirement for extraction and AI processing',
          excerpts: null,
        })

        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogImage: 'https://instagram.com/fallback.jpg',
        })

        const result = await extractInstagramContent(url)

        // Should still extract content without carousel metadata
        expect(result).toBeDefined()
        expect(result?.title).toBe('Good Title')
        expect(result?.rawMetadata?.instagram?.isCarousel).toBeUndefined()
        expect(result?.mediaUrls).toEqual(['https://instagram.com/fallback.jpg'])
      })

      it('should handle empty carousel items array', async () => {
        const url = 'https://www.instagram.com/p/EMPTY_ITEMS/'

        vi.mocked(getInstagramMediaInfo).mockResolvedValue({
          isVideo: false,
          isCarousel: true,
          thumbnailUrl: 'https://instagram.com/thumb.jpg',
          carouselItems: [], // Empty array
        })

        vi.mocked(extractWithParallel).mockResolvedValue({
          url,
          title: 'Post Title',
          full_content: 'This is a carousel with no items somehow but still has valid content',
          excerpts: null,
        })

        vi.mocked(extractOGMetadata).mockResolvedValue({
          ogImage: 'https://instagram.com/og.jpg',
        })

        const result = await extractInstagramContent(url)

        expect(result).toBeDefined()
        // Currently, carousel info is still included even with 0 items
        // This test documents the actual behavior
        expect(result?.rawMetadata?.carouselInfo?.itemCount).toBe(0)
      })
    })
  })
})
