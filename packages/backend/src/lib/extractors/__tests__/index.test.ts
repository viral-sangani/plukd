/**
 * Comprehensive tests for the content extraction orchestrator
 *
 * Tests the main extractContent() function which routes to platform-specific
 * extractors and handles fallback chains.
 *
 * Coverage:
 * - Platform routing (Twitter, YouTube, Instagram, Reddit, LinkedIn, Web)
 * - Primary extraction success/failure
 * - Fallback to OG metadata
 * - Special features (YouTube transcripts, Instagram transcription)
 * - Error handling and edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock all external modules
vi.mock('../twitter')
vi.mock('../youtube')
vi.mock('../instagram')
vi.mock('../og-metadata')
vi.mock('../parallel-client')
vi.mock('../instagram-video')
vi.mock('../../transcription')

// Now import after mocks are set up
import { extractContent } from '../index'
import * as twitterExtractor from '../twitter'
import * as youtubeExtractor from '../youtube'
import * as instagramExtractor from '../instagram'
import * as ogMetadataExtractor from '../og-metadata'
import * as parallelClient from '../parallel-client'
import * as instagramVideo from '../instagram-video'
import * as transcription from '../../transcription'
import type { ExtractedContent } from '@plukd/shared'

// Test fixtures - URL samples for each platform
const twitterUrls = {
  standard: 'https://twitter.com/elonmusk/status/1234567890',
  xDomain: 'https://x.com/elonmusk/status/1234567890',
  thread: 'https://twitter.com/user/status/123456/thread',
}

const youtubeUrls = {
  standard: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  short: 'https://youtu.be/dQw4w9WgXcQ',
}

const instagramUrls = {
  post: 'https://www.instagram.com/p/ABC123xyz/',
  reel: 'https://www.instagram.com/reel/ABC123xyz/',
}

const redditUrls = {
  standard: 'https://reddit.com/r/programming/comments/abc123/best_practices',
}

const linkedinUrls = {
  post: 'https://www.linkedin.com/posts/johndoe_leadership-activity-123456',
}

const webUrls = {
  simple: 'https://example.com',
  withPath: 'https://example.com/blog/article',
}

describe('Content Extraction Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Platform Routing', () => {
    it('should route Twitter URLs to Twitter extractor', async () => {
      const mockResult: ExtractedContent = {
        url: twitterUrls.standard,
        source: 'twitter',
        title: 'Test Tweet',
        content: 'Tweet content',
      }

      vi.mocked(twitterExtractor.extractTwitterContent).mockResolvedValue(mockResult)

      const result = await extractContent(twitterUrls.standard)

      expect(twitterExtractor.extractTwitterContent).toHaveBeenCalledWith(twitterUrls.standard)
      expect(result).toEqual(mockResult)
    })

    it('should route X.com URLs to Twitter extractor', async () => {
      const mockResult: ExtractedContent = {
        url: twitterUrls.xDomain,
        source: 'twitter',
        title: 'Test Tweet',
        content: 'Tweet content',
      }

      vi.mocked(twitterExtractor.extractTwitterContent).mockResolvedValue(mockResult)

      const result = await extractContent(twitterUrls.xDomain)

      expect(twitterExtractor.extractTwitterContent).toHaveBeenCalledWith(twitterUrls.xDomain)
      expect(result).toEqual(mockResult)
    })

    it('should route YouTube URLs to YouTube extractor', async () => {
      const mockResult: ExtractedContent = {
        url: youtubeUrls.standard,
        source: 'youtube',
        title: 'Test Video',
        content: 'Video description',
      }

      vi.mocked(youtubeExtractor.extractYouTubeContent).mockResolvedValue(mockResult)

      const result = await extractContent(youtubeUrls.standard)

      expect(youtubeExtractor.extractYouTubeContent).toHaveBeenCalledWith(youtubeUrls.standard)
      expect(result).toEqual(mockResult)
    })

    it('should route Instagram URLs to Instagram extractor', async () => {
      const mockResult: ExtractedContent = {
        url: instagramUrls.post,
        source: 'instagram',
        title: 'Test Post',
        content: 'Post caption',
      }

      vi.mocked(instagramExtractor.extractInstagramContent).mockResolvedValue(mockResult)
      vi.mocked(transcription.isTranscriptionAvailable).mockReturnValue(false)

      const result = await extractContent(instagramUrls.post)

      expect(instagramExtractor.extractInstagramContent).toHaveBeenCalledWith(instagramUrls.post)
      expect(result).toEqual(mockResult)
    })

    it('should route Reddit URLs to Parallel AI extractor', async () => {
      const mockParallelResult = {
        url: redditUrls.standard,
        title: 'Reddit Post Title',
        full_content: 'Reddit post content with discussion',
        excerpts: ['Key point 1', 'Key point 2'],
      }

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(mockParallelResult)

      const result = await extractContent(redditUrls.standard)

      expect(parallelClient.extractWithParallel).toHaveBeenCalledWith(redditUrls.standard)
      expect(result).toBeDefined()
      expect(result?.source).toBe('reddit')
      expect(result?.title).toBe('Reddit Post Title')
      expect(result?.content).toBe('Reddit post content with discussion')
    })

    it('should route LinkedIn URLs to Parallel AI extractor', async () => {
      const mockParallelResult = {
        url: linkedinUrls.post,
        title: 'LinkedIn Post',
        full_content: 'Professional insight content',
        excerpts: ['Professional point 1'],
      }

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(mockParallelResult)

      const result = await extractContent(linkedinUrls.post)

      expect(parallelClient.extractWithParallel).toHaveBeenCalledWith(linkedinUrls.post)
      expect(result?.source).toBe('linkedin')
    })

    it('should route web URLs to Parallel AI extractor', async () => {
      const mockParallelResult = {
        url: webUrls.withPath,
        title: 'Blog Article',
        full_content: 'Article content',
        excerpts: ['Main point'],
      }

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(mockParallelResult)

      const result = await extractContent(webUrls.withPath)

      expect(parallelClient.extractWithParallel).toHaveBeenCalledWith(webUrls.withPath)
      expect(result?.source).toBe('web')
    })
  })

  describe('Twitter Extraction', () => {
    it('should extract tweet content successfully', async () => {
      const mockResult: ExtractedContent = {
        url: twitterUrls.standard,
        source: 'twitter',
        title: 'Exciting announcement!',
        content: 'We are launching a new feature today',
        author: '@elonmusk',
        authorUrl: 'https://x.com/elonmusk',
        publishedAt: new Date('2024-01-15T10:00:00Z'),
        engagement: {
          likes: 5000,
          comments: 300,
          shares: 1000,
        },
        mediaUrls: ['https://pbs.twimg.com/media/image.jpg'],
      }

      vi.mocked(twitterExtractor.extractTwitterContent).mockResolvedValue(mockResult)

      const result = await extractContent(twitterUrls.standard)

      expect(result).toEqual(mockResult)
      expect(result?.engagement?.likes).toBe(5000)
      expect(result?.mediaUrls).toHaveLength(1)
    })

    it('should handle thread detection', async () => {
      const mockResult: ExtractedContent = {
        url: twitterUrls.thread,
        source: 'twitter',
        title: 'Thread about AI',
        content: 'Part 1 of my thoughts on AI...',
        rawMetadata: {
          isThread: true,
          threadLength: 5,
        },
      }

      vi.mocked(twitterExtractor.extractTwitterContent).mockResolvedValue(mockResult)

      const result = await extractContent(twitterUrls.thread)

      expect(result?.rawMetadata?.isThread).toBe(true)
      expect(result?.rawMetadata?.threadLength).toBe(5)
    })

    it('should extract media from tweets', async () => {
      const mockResult: ExtractedContent = {
        url: twitterUrls.standard,
        source: 'twitter',
        title: 'Check out these photos',
        content: 'Amazing sunset today!',
        mediaUrls: [
          'https://pbs.twimg.com/media/image1.jpg',
          'https://pbs.twimg.com/media/image2.jpg',
          'https://video.twimg.com/video.mp4',
        ],
      }

      vi.mocked(twitterExtractor.extractTwitterContent).mockResolvedValue(mockResult)

      const result = await extractContent(twitterUrls.standard)

      expect(result?.mediaUrls).toHaveLength(3)
      expect(result?.mediaUrls).toContain('https://video.twimg.com/video.mp4')
    })

    it('should fallback to OG metadata when Twitter extractor fails', async () => {
      const error = new Error('Twitter API error')
      vi.mocked(twitterExtractor.extractTwitterContent).mockRejectedValue(error)

      const mockOGMetadata = {
        ogTitle: 'Tweet from OG',
        ogDescription: 'Tweet content from OG tags',
        ogImage: 'https://example.com/og-image.jpg',
      }

      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(mockOGMetadata)

      const result = await extractContent(twitterUrls.standard)

      expect(twitterExtractor.extractTwitterContent).toHaveBeenCalled()
      expect(ogMetadataExtractor.extractOGMetadata).toHaveBeenCalledWith(twitterUrls.standard)
      expect(result?.title).toBe('Tweet from OG')
      expect(result?.content).toBe('Tweet content from OG tags')
    })

    it('should handle rate limiting gracefully', async () => {
      const rateLimitError = new Error('Rate limit exceeded')
      vi.mocked(twitterExtractor.extractTwitterContent).mockRejectedValue(rateLimitError)

      const mockOGMetadata = {
        ogTitle: 'Fallback Title',
        ogDescription: 'Fallback content',
      }

      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(mockOGMetadata)

      const result = await extractContent(twitterUrls.standard)

      expect(result).toBeDefined()
      expect(result?.title).toBe('Fallback Title')
    })

    it('should handle invalid tweet ID', async () => {
      const invalidError = new Error('Invalid Twitter/X URL format')
      vi.mocked(twitterExtractor.extractTwitterContent).mockRejectedValue(invalidError)
      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(null)

      const result = await extractContent('https://twitter.com/invalid')

      expect(result).toBeNull()
    })

    it('should handle protected tweets', async () => {
      const protectedError = new Error('Tweet not found: protected')
      vi.mocked(twitterExtractor.extractTwitterContent).mockRejectedValue(protectedError)

      const mockOGMetadata = {
        ogTitle: 'Protected Tweet',
        ogDescription: 'This tweet is from a protected account',
      }

      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(mockOGMetadata)

      const result = await extractContent(twitterUrls.standard)

      expect(result?.title).toBe('Protected Tweet')
    })

    it('should extract retweet content', async () => {
      const mockResult: ExtractedContent = {
        url: twitterUrls.standard,
        source: 'twitter',
        title: 'RT @original: Original tweet content',
        content: 'Original tweet content',
        author: '@elonmusk',
        rawMetadata: {
          isRetweet: true,
          originalAuthor: '@original',
        },
      }

      vi.mocked(twitterExtractor.extractTwitterContent).mockResolvedValue(mockResult)

      const result = await extractContent(twitterUrls.standard)

      expect(result?.rawMetadata?.isRetweet).toBe(true)
      expect(result?.rawMetadata?.originalAuthor).toBe('@original')
    })
  })

  describe('YouTube Extraction', () => {
    it('should extract video with transcript successfully', async () => {
      const mockResult: ExtractedContent = {
        url: youtubeUrls.standard,
        source: 'youtube',
        title: 'Amazing Tech Tutorial',
        content: 'Video description\n\n---\n\nTranscript:\nHello everyone, welcome to this tutorial...',
        transcript: 'Hello everyone, welcome to this tutorial...',
        mediaUrls: ['https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'],
        ogTitle: 'Amazing Tech Tutorial',
        ogDescription: 'Video description',
        ogImage: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      }

      vi.mocked(youtubeExtractor.extractYouTubeContent).mockResolvedValue(mockResult)

      const result = await extractContent(youtubeUrls.standard)

      expect(result?.transcript).toBeDefined()
      expect(result?.content).toContain('Transcript:')
      expect(result?.title).toBe('Amazing Tech Tutorial')
    })

    it('should continue without transcript if unavailable', async () => {
      const mockResult: ExtractedContent = {
        url: youtubeUrls.standard,
        source: 'youtube',
        title: 'Video Without Transcript',
        content: 'Just the video description',
        transcript: undefined,
        ogDescription: 'Just the video description',
      }

      vi.mocked(youtubeExtractor.extractYouTubeContent).mockResolvedValue(mockResult)

      const result = await extractContent(youtubeUrls.standard)

      expect(result?.transcript).toBeUndefined()
      expect(result?.content).not.toContain('Transcript:')
      expect(result?.content).toBe('Just the video description')
    })

    it('should handle transcript API failure gracefully', async () => {
      const mockResult: ExtractedContent = {
        url: youtubeUrls.standard,
        source: 'youtube',
        title: 'Video Title',
        content: 'Description only',
      }

      vi.mocked(youtubeExtractor.extractYouTubeContent).mockResolvedValue(mockResult)

      const result = await extractContent(youtubeUrls.standard)

      expect(result).toBeDefined()
      expect(result?.title).toBe('Video Title')
    })

    it('should handle live videos', async () => {
      const mockResult: ExtractedContent = {
        url: youtubeUrls.standard,
        source: 'youtube',
        title: 'Live Stream: Tech Conference',
        content: 'Join us live for the annual tech conference',
        rawMetadata: {
          isLive: true,
        },
      }

      vi.mocked(youtubeExtractor.extractYouTubeContent).mockResolvedValue(mockResult)

      const result = await extractContent(youtubeUrls.standard)

      expect(result?.rawMetadata?.isLive).toBe(true)
    })

    it('should handle private videos', async () => {
      vi.mocked(youtubeExtractor.extractYouTubeContent).mockResolvedValue(null)

      const mockOGMetadata = {
        ogTitle: 'Private Video',
        ogDescription: 'This video is private',
      }

      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(mockOGMetadata)

      const result = await extractContent(youtubeUrls.standard)

      expect(result?.title).toBe('Private Video')
    })

    it('should extract YouTube Shorts', async () => {
      const shortsUrl = 'https://www.youtube.com/shorts/abc123xyz'
      const mockResult: ExtractedContent = {
        url: shortsUrl,
        source: 'youtube',
        title: 'Viral Short',
        content: 'Short video content',
        rawMetadata: {
          isShort: true,
        },
      }

      vi.mocked(youtubeExtractor.extractYouTubeContent).mockResolvedValue(mockResult)

      const result = await extractContent(shortsUrl)

      expect(result?.rawMetadata?.isShort).toBe(true)
    })

    it('should handle age-restricted content', async () => {
      const mockResult: ExtractedContent = {
        url: youtubeUrls.standard,
        source: 'youtube',
        title: 'Age Restricted Video',
        content: 'This video is age-restricted',
        rawMetadata: {
          ageRestricted: true,
        },
      }

      vi.mocked(youtubeExtractor.extractYouTubeContent).mockResolvedValue(mockResult)

      const result = await extractContent(youtubeUrls.standard)

      expect(result?.rawMetadata?.ageRestricted).toBe(true)
    })

    it('should return null for deleted videos', async () => {
      vi.mocked(youtubeExtractor.extractYouTubeContent).mockResolvedValue(null)
      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(null)

      const result = await extractContent(youtubeUrls.standard)

      expect(result).toBeNull()
    })

    it('should handle very long transcripts', async () => {
      const longTranscript = 'Word '.repeat(10000)
      const mockResult: ExtractedContent = {
        url: youtubeUrls.standard,
        source: 'youtube',
        title: 'Long Video',
        content: `Description\n\n---\n\nTranscript:\n${longTranscript}`,
        transcript: longTranscript,
      }

      vi.mocked(youtubeExtractor.extractYouTubeContent).mockResolvedValue(mockResult)

      const result = await extractContent(youtubeUrls.standard)

      expect(result?.transcript).toBeDefined()
      expect(result?.transcript!.length).toBeGreaterThan(10000)
    })

    it('should fallback to OG metadata when YouTube extractor fails', async () => {
      const error = new Error('YouTube extraction failed')
      vi.mocked(youtubeExtractor.extractYouTubeContent).mockRejectedValue(error)

      const mockOGMetadata = {
        ogTitle: 'Video from OG',
        ogDescription: 'Video description from OG tags',
        ogImage: 'https://i.ytimg.com/vi/abc/hq720.jpg',
      }

      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(mockOGMetadata)

      const result = await extractContent(youtubeUrls.standard)

      expect(youtubeExtractor.extractYouTubeContent).toHaveBeenCalled()
      expect(ogMetadataExtractor.extractOGMetadata).toHaveBeenCalledWith(youtubeUrls.standard)
      expect(result?.title).toBe('Video from OG')
    })
  })

  describe('Instagram Extraction', () => {
    it('should extract post content successfully', async () => {
      const mockResult: ExtractedContent = {
        url: instagramUrls.post,
        source: 'instagram',
        title: 'Beautiful Sunset Photo',
        content: 'Amazing sunset at the beach today! #sunset #photography',
        author: '@photographer',
        mediaUrls: ['https://instagram.com/p/ABC123/media.jpg'],
      }

      vi.mocked(instagramExtractor.extractInstagramContent).mockResolvedValue(mockResult)
      vi.mocked(transcription.isTranscriptionAvailable).mockReturnValue(false)

      const result = await extractContent(instagramUrls.post)

      expect(result?.title).toBe('Beautiful Sunset Photo')
      expect(result?.content).toContain('#sunset')
    })

    it('should extract reel with video transcription', async () => {
      const mockExtractedContent: ExtractedContent = {
        url: instagramUrls.reel,
        source: 'instagram',
        title: 'Viral Dance Reel',
        content: 'Check out this dance move!',
        author: '@dancer',
      }

      const mockVideoBuffer = Buffer.from('video-data')
      const mockVideoResult = {
        buffer: mockVideoBuffer,
        mimeType: 'video/mp4',
        url: 'https://video.cdninstagram.com/video.mp4',
      }

      const mockTranscription = {
        text: 'Music playing with dance moves explained',
        language: 'en',
        duration: 15,
      }

      vi.mocked(instagramExtractor.extractInstagramContent).mockResolvedValue(
        mockExtractedContent
      )
      // New API: isInstagramReelUrl for reels (always videos)
      vi.mocked(instagramVideo.isInstagramReelUrl).mockReturnValue(true)
      vi.mocked(transcription.isTranscriptionAvailable).mockReturnValue(true)
      vi.mocked(instagramVideo.downloadInstagramVideo).mockResolvedValue(mockVideoResult)
      vi.mocked(transcription.transcribeBuffer).mockResolvedValue(mockTranscription)

      const result = await extractContent(instagramUrls.reel)

      expect(instagramVideo.downloadInstagramVideo).toHaveBeenCalledWith(instagramUrls.reel)
      expect(transcription.transcribeBuffer).toHaveBeenCalledWith(mockVideoBuffer, 'video/mp4')
      expect(result?.transcript).toBe('Music playing with dance moves explained')
      expect(result?.transcriptLanguage).toBe('en')
      expect(result?.content).toContain('Transcript:')
    })

    it('should handle video transcription failure gracefully', async () => {
      const mockExtractedContent: ExtractedContent = {
        url: instagramUrls.reel,
        source: 'instagram',
        title: 'Reel Title',
        content: 'Caption text',
      }

      vi.mocked(instagramExtractor.extractInstagramContent).mockResolvedValue(
        mockExtractedContent
      )
      // New API: isInstagramReelUrl for reels
      vi.mocked(instagramVideo.isInstagramReelUrl).mockReturnValue(true)
      vi.mocked(transcription.isTranscriptionAvailable).mockReturnValue(true)
      vi.mocked(instagramVideo.downloadInstagramVideo).mockRejectedValue(
        new Error('Download failed')
      )

      const result = await extractContent(instagramUrls.reel)

      expect(result).toBeDefined()
      expect(result?.content).toBe('Caption text')
      expect(result?.transcript).toBeUndefined()
    })

    it('should extract image posts without transcription', async () => {
      const mockResult: ExtractedContent = {
        url: instagramUrls.post,
        source: 'instagram',
        title: 'Photo Post',
        content: 'Great photo!',
        mediaUrls: ['https://instagram.com/image.jpg'],
      }

      vi.mocked(instagramExtractor.extractInstagramContent).mockResolvedValue(mockResult)
      // New API: isInstagramReelUrl returns false for posts
      vi.mocked(instagramVideo.isInstagramReelUrl).mockReturnValue(false)
      // maybeInstagramVideo returns true for /p/ URLs, but getInstagramMediaInfo says it's an image
      vi.mocked(instagramVideo.maybeInstagramVideo).mockReturnValue(true)
      vi.mocked(instagramVideo.getInstagramMediaInfo).mockResolvedValue({
        isVideo: false,
        isCarousel: false,
        thumbnailUrl: 'https://instagram.com/image.jpg',
      })
      vi.mocked(transcription.isTranscriptionAvailable).mockReturnValue(true)

      const result = await extractContent(instagramUrls.post)

      expect(instagramVideo.downloadInstagramVideo).not.toHaveBeenCalled()
      expect(transcription.transcribeBuffer).not.toHaveBeenCalled()
      expect(result?.title).toBe('Photo Post')
    })

    it('should handle carousel posts with multiple media', async () => {
      // extractInstagramContent already extracts all carousel URLs via extractMediaUrls()
      // so we don't need handleInstagramTranscription to add them again
      const mockResult: ExtractedContent = {
        url: instagramUrls.post,
        source: 'instagram',
        title: 'Travel Album',
        content: 'My vacation photos!',
        mediaUrls: [
          'https://instagram.com/media1.jpg',
          'https://instagram.com/media2.jpg',
          'https://instagram.com/media3.jpg',
        ],
        rawMetadata: {
          instagram: {
            postType: 'post',
            caption: 'My vacation photos!',
            isCarousel: true,
            carouselItems: [
              { isVideo: false, url: 'https://instagram.com/media1.jpg' },
              { isVideo: false, url: 'https://instagram.com/media2.jpg' },
              { isVideo: false, url: 'https://instagram.com/media3.jpg' },
            ],
          },
        },
      }

      vi.mocked(instagramExtractor.extractInstagramContent).mockResolvedValue(mockResult)
      // New API: isInstagramReelUrl returns false for posts
      vi.mocked(instagramVideo.isInstagramReelUrl).mockReturnValue(false)
      // maybeInstagramVideo returns true for /p/ URLs, getInstagramMediaInfo returns carousel
      vi.mocked(instagramVideo.maybeInstagramVideo).mockReturnValue(true)
      vi.mocked(instagramVideo.getInstagramMediaInfo).mockResolvedValue({
        isVideo: false,
        isCarousel: true,
        thumbnailUrl: 'https://instagram.com/cover.jpg',
        carouselItems: [
          { isVideo: false, url: 'https://instagram.com/media1.jpg' },
          { isVideo: false, url: 'https://instagram.com/media2.jpg' },
          { isVideo: false, url: 'https://instagram.com/media3.jpg' },
        ],
      })
      vi.mocked(transcription.isTranscriptionAvailable).mockReturnValue(true)

      const result = await extractContent(instagramUrls.post)

      // Should have exactly 3 carousel images (no duplicates added by handleInstagramTranscription)
      expect(result?.mediaUrls).toHaveLength(3)
      expect(result?.rawMetadata?.instagram?.isCarousel).toBe(true)
    })

    it('should handle private posts', async () => {
      vi.mocked(instagramExtractor.extractInstagramContent).mockResolvedValue(null)

      const mockOGMetadata = {
        ogTitle: 'Instagram',
        ogDescription: 'Private post',
      }

      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(mockOGMetadata)

      const result = await extractContent(instagramUrls.post)

      expect(result?.title).toBe('Instagram')
    })

    it('should return null for deleted posts', async () => {
      vi.mocked(instagramExtractor.extractInstagramContent).mockResolvedValue(null)
      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(null)

      const result = await extractContent(instagramUrls.post)

      expect(result).toBeNull()
    })

    it('should skip transcription when service unavailable', async () => {
      const mockResult: ExtractedContent = {
        url: instagramUrls.reel,
        source: 'instagram',
        title: 'Reel',
        content: 'Caption',
      }

      vi.mocked(instagramExtractor.extractInstagramContent).mockResolvedValue(mockResult)
      vi.mocked(transcription.isTranscriptionAvailable).mockReturnValue(false)

      const result = await extractContent(instagramUrls.reel)

      expect(instagramVideo.downloadInstagramVideo).not.toHaveBeenCalled()
      expect(transcription.transcribeBuffer).not.toHaveBeenCalled()
      expect(result?.transcript).toBeUndefined()
    })

    it('should fallback to OG metadata when Instagram extractor fails', async () => {
      const error = new Error('Instagram extraction failed')
      vi.mocked(instagramExtractor.extractInstagramContent).mockRejectedValue(error)

      const mockOGMetadata = {
        ogTitle: 'Instagram Post',
        ogDescription: 'Post from OG tags',
        ogImage: 'https://instagram.com/image.jpg',
      }

      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(mockOGMetadata)

      const result = await extractContent(instagramUrls.post)

      expect(instagramExtractor.extractInstagramContent).toHaveBeenCalled()
      expect(ogMetadataExtractor.extractOGMetadata).toHaveBeenCalledWith(instagramUrls.post)
      expect(result?.title).toBe('Instagram Post')
    })
  })

  describe('Reddit/LinkedIn/Web Extraction', () => {
    it('should extract Reddit post with Parallel AI', async () => {
      const mockParallelResult = {
        url: redditUrls.standard,
        title: 'Best practices for clean code',
        full_content: 'Here are the top 10 best practices...\n\nTop comments:\n- Great advice!\n- This helped me a lot',
        excerpts: ['Top 10 best practices', 'Clean code principles', 'Community discussion'],
      }

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(mockParallelResult)

      const result = await extractContent(redditUrls.standard)

      expect(parallelClient.extractWithParallel).toHaveBeenCalledWith(redditUrls.standard)
      expect(result?.source).toBe('reddit')
      expect(result?.title).toBe('Best practices for clean code')
      expect(result?.content).toContain('Top comments')
      expect(result?.rawMetadata?.excerpts).toHaveLength(3)
    })

    it('should include Reddit comments in extraction', async () => {
      const mockParallelResult = {
        url: redditUrls.standard,
        title: 'Discussion Thread',
        full_content: 'Original post content\n\nTop Comments:\n1. First comment\n2. Second comment',
        excerpts: null,
      }

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(mockParallelResult)

      const result = await extractContent(redditUrls.standard)

      expect(result?.content).toContain('Top Comments')
    })

    it('should extract LinkedIn post with Parallel AI', async () => {
      const mockParallelResult = {
        url: linkedinUrls.post,
        title: 'Leadership insights for 2024',
        full_content: 'Here are my thoughts on leadership in the modern workplace...',
        excerpts: ['Leadership principles', 'Team collaboration'],
      }

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(mockParallelResult)

      const result = await extractContent(linkedinUrls.post)

      expect(result?.source).toBe('linkedin')
      expect(result?.title).toBe('Leadership insights for 2024')
    })

    it('should extract web article with Parallel AI', async () => {
      const mockParallelResult = {
        url: webUrls.withPath,
        title: 'Understanding JavaScript Closures',
        full_content: 'Closures are a fundamental concept in JavaScript...',
        excerpts: ['Closure definition', 'Use cases', 'Best practices'],
        publish_date: '2024-01-15T10:00:00Z',
      }

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(mockParallelResult)

      const result = await extractContent(webUrls.withPath)

      expect(result?.source).toBe('web')
      expect(result?.publishedAt).toEqual(new Date('2024-01-15T10:00:00Z'))
    })

    it('should fallback to OG metadata when Parallel AI fails', async () => {
      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(null)

      const mockOGMetadata = {
        ogTitle: 'Article from OG',
        ogDescription: 'Article description',
        ogImage: 'https://example.com/image.jpg',
        ogSiteName: 'Example Blog',
      }

      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(mockOGMetadata)

      const result = await extractContent(webUrls.withPath)

      expect(parallelClient.extractWithParallel).toHaveBeenCalled()
      expect(ogMetadataExtractor.extractOGMetadata).toHaveBeenCalled()
      expect(result?.title).toBe('Article from OG')
      expect(result?.ogSiteName).toBe('Example Blog')
    })

    it('should handle web URLs without OG tags', async () => {
      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(null)

      const mockOGMetadata = {
        pageTitle: 'Page Title from HTML',
        metaDescription: 'Meta description',
      }

      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(mockOGMetadata)

      const result = await extractContent(webUrls.simple)

      expect(result?.title).toBe('Page Title from HTML')
      expect(result?.content).toBe('Meta description')
    })

    it('should handle paywalled content', async () => {
      const mockParallelResult = {
        url: webUrls.withPath,
        title: 'Premium Article',
        full_content: 'This article requires a subscription...',
        excerpts: ['Preview text'],
      }

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(mockParallelResult)

      const result = await extractContent(webUrls.withPath)

      expect(result?.content).toContain('subscription')
    })

    it('should handle very long articles', async () => {
      const longContent = 'Paragraph '.repeat(5000)
      const mockParallelResult = {
        url: webUrls.withPath,
        title: 'Long Article',
        full_content: longContent,
        excerpts: ['Key point 1', 'Key point 2', 'Key point 3'],
      }

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(mockParallelResult)

      const result = await extractContent(webUrls.withPath)

      expect(result?.content.length).toBeGreaterThan(10000)
      expect(result?.rawMetadata?.excerpts).toHaveLength(3)
    })

    it('should use excerpts when full_content is not available', async () => {
      const mockParallelResult = {
        url: webUrls.withPath,
        title: 'Article Title',
        full_content: null,
        excerpts: ['Excerpt 1', 'Excerpt 2', 'Excerpt 3'],
      }

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(mockParallelResult)

      const result = await extractContent(webUrls.withPath)

      expect(result?.content).toBe('Excerpt 1\n\nExcerpt 2\n\nExcerpt 3')
    })

    it('should handle PDF links', async () => {
      const pdfUrl = 'https://example.com/document.pdf'
      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(null)
      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(null)

      const result = await extractContent(pdfUrl)

      expect(result).toBeNull()
    })
  })

  describe('Fallback Chain', () => {
    it('should use primary extractor when successful', async () => {
      const mockResult: ExtractedContent = {
        url: twitterUrls.standard,
        source: 'twitter',
        title: 'Primary Result',
        content: 'Content from primary extractor',
      }

      vi.mocked(twitterExtractor.extractTwitterContent).mockResolvedValue(mockResult)

      const result = await extractContent(twitterUrls.standard)

      expect(twitterExtractor.extractTwitterContent).toHaveBeenCalled()
      expect(ogMetadataExtractor.extractOGMetadata).not.toHaveBeenCalled()
      expect(result).toEqual(mockResult)
    })

    it('should fallback to OG metadata when primary fails', async () => {
      vi.mocked(twitterExtractor.extractTwitterContent).mockRejectedValue(
        new Error('Primary failed')
      )

      const mockOGMetadata = {
        ogTitle: 'OG Fallback Title',
        ogDescription: 'OG Fallback Description',
      }

      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(mockOGMetadata)

      const result = await extractContent(twitterUrls.standard)

      expect(twitterExtractor.extractTwitterContent).toHaveBeenCalled()
      expect(ogMetadataExtractor.extractOGMetadata).toHaveBeenCalled()
      expect(result?.title).toBe('OG Fallback Title')
    })

    it('should return null when all extraction methods fail', async () => {
      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(null)
      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(null)

      const result = await extractContent(webUrls.simple)

      expect(parallelClient.extractWithParallel).toHaveBeenCalled()
      expect(ogMetadataExtractor.extractOGMetadata).toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('should use partial OG metadata when available', async () => {
      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(null)

      const mockOGMetadata = {
        ogTitle: 'Only Title Available',
        // Missing description and other fields
      }

      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(mockOGMetadata)

      const result = await extractContent(webUrls.simple)

      expect(result?.title).toBe('Only Title Available')
      expect(result?.content).toBe('')
    })

    it('should handle OG metadata with missing images', async () => {
      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(null)

      const mockOGMetadata = {
        ogTitle: 'Article Title',
        ogDescription: 'Article description',
        // No ogImage
      }

      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(mockOGMetadata)

      const result = await extractContent(webUrls.withPath)

      expect(result?.mediaUrls).toBeUndefined()
    })

    it('should handle network timeout errors', async () => {
      // Parallel AI returns null on timeout (handled internally)
      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(null)
      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(null)

      const result = await extractContent(webUrls.simple)

      expect(result).toBeNull()
    })

    it('should handle 404 errors', async () => {
      vi.mocked(twitterExtractor.extractTwitterContent).mockRejectedValue(
        new Error('HTTP 404: Not Found')
      )
      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(null)

      const result = await extractContent(twitterUrls.standard)

      expect(result).toBeNull()
    })

    it('should handle 500 errors and fallback', async () => {
      // Parallel AI returns null on server errors (handled internally)
      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(null)

      const mockOGMetadata = {
        ogTitle: 'Fallback Title',
        ogDescription: 'Server error, using OG metadata',
      }

      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(mockOGMetadata)

      const result = await extractContent(webUrls.simple)

      expect(result?.title).toBe('Fallback Title')
    })

    it('should handle redirect chains', async () => {
      const redirectedUrl = 'https://example.com/redirected'
      const mockParallelResult = {
        url: redirectedUrl,
        title: 'Redirected Article',
        full_content: 'Content from final URL',
        excerpts: null,
      }

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(mockParallelResult)

      const result = await extractContent(webUrls.simple)

      expect(result?.title).toBe('Redirected Article')
    })
  })

  describe('Special Features', () => {
    it('should include YouTube transcript when available', async () => {
      const mockResult: ExtractedContent = {
        url: youtubeUrls.standard,
        source: 'youtube',
        title: 'Video Title',
        content: 'Description\n\n---\n\nTranscript:\nTranscript text here',
        transcript: 'Transcript text here',
      }

      vi.mocked(youtubeExtractor.extractYouTubeContent).mockResolvedValue(mockResult)

      const result = await extractContent(youtubeUrls.standard)

      expect(result?.transcript).toBe('Transcript text here')
      expect(result?.content).toContain('Transcript:')
    })

    it('should transcribe Instagram video successfully', async () => {
      const mockExtractedContent: ExtractedContent = {
        url: instagramUrls.reel,
        source: 'instagram',
        title: 'Reel',
        content: 'Caption',
      }

      const mockVideoBuffer = Buffer.from('video-data')
      const mockTranscription = {
        text: 'Transcribed audio content',
        language: 'en',
        duration: 30,
      }

      vi.mocked(instagramExtractor.extractInstagramContent).mockResolvedValue(
        mockExtractedContent
      )
      // New API: isInstagramReelUrl for reels
      vi.mocked(instagramVideo.isInstagramReelUrl).mockReturnValue(true)
      vi.mocked(transcription.isTranscriptionAvailable).mockReturnValue(true)
      vi.mocked(instagramVideo.downloadInstagramVideo).mockResolvedValue({
        buffer: mockVideoBuffer,
        mimeType: 'video/mp4',
        url: 'https://video.cdninstagram.com/video.mp4',
      })
      vi.mocked(transcription.transcribeBuffer).mockResolvedValue(mockTranscription)

      const result = await extractContent(instagramUrls.reel)

      expect(result?.transcript).toBe('Transcribed audio content')
      expect(result?.content).toContain('Transcript:')
    })

    it('should include multiple media URLs in metadata', async () => {
      const mockResult: ExtractedContent = {
        url: twitterUrls.standard,
        source: 'twitter',
        title: 'Tweet with Media',
        content: 'Check out these images',
        mediaUrls: [
          'https://pbs.twimg.com/media/img1.jpg',
          'https://pbs.twimg.com/media/img2.jpg',
          'https://pbs.twimg.com/media/img3.jpg',
          'https://video.twimg.com/video.mp4',
        ],
      }

      vi.mocked(twitterExtractor.extractTwitterContent).mockResolvedValue(mockResult)

      const result = await extractContent(twitterUrls.standard)

      expect(result?.mediaUrls).toHaveLength(4)
      expect(result?.mediaUrls?.some((url) => url.includes('video'))).toBe(true)
    })

    it('should handle encoding issues in content', async () => {
      const mockParallelResult = {
        url: webUrls.withPath,
        title: 'Article with Special Chars: "Quotes" & Symbols',
        full_content: 'Content with special characters: é, ñ, ü, —',
        excerpts: null,
      }

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(mockParallelResult)

      const result = await extractContent(webUrls.withPath)

      expect(result?.title).toContain('Quotes')
      expect(result?.content).toContain('é')
    })

    it('should preserve publish dates when available', async () => {
      const publishDate = '2024-01-15T12:00:00Z'
      const mockParallelResult = {
        url: webUrls.withPath,
        title: 'Article',
        full_content: 'Content',
        excerpts: null,
        publish_date: publishDate,
      }

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(mockParallelResult)

      const result = await extractContent(webUrls.withPath)

      expect(result?.publishedAt).toEqual(new Date(publishDate))
    })

    it('should handle invalid publish dates gracefully', async () => {
      const mockParallelResult = {
        url: webUrls.withPath,
        title: 'Article',
        full_content: 'Content',
        excerpts: null,
        publish_date: 'invalid-date',
      }

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(mockParallelResult)

      const result = await extractContent(webUrls.withPath)

      // Should handle invalid date without crashing
      expect(result).toBeDefined()
    })

    it('should use generateFallbackTitle when no title available', async () => {
      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue({
        url: webUrls.withPath,
        title: '',
        full_content: 'Content without title',
        excerpts: null,
      })

      const result = await extractContent(webUrls.withPath)

      // Should have generated a fallback title
      expect(result?.title).toBeDefined()
      expect(result?.title.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle unknown source types', async () => {
      const unknownUrl = 'https://unknown-platform.com/content/123'

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(null)

      const mockOGMetadata = {
        ogTitle: 'Unknown Platform Content',
        ogDescription: 'Content from unknown platform',
      }

      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(mockOGMetadata)

      const result = await extractContent(unknownUrl)

      expect(ogMetadataExtractor.extractOGMetadata).toHaveBeenCalled()
      expect(result?.title).toBe('Unknown Platform Content')
    })

    it('should handle empty content strings', async () => {
      const mockParallelResult = {
        url: webUrls.simple,
        title: 'Title Only',
        full_content: '',
        excerpts: null,
      }

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(mockParallelResult)

      const result = await extractContent(webUrls.simple)

      expect(result?.title).toBe('Title Only')
      expect(result?.content).toBe('')
    })

    it('should handle very long URLs', async () => {
      const veryLongUrl = `https://example.com/${'a'.repeat(2000)}`
      const mockParallelResult = {
        url: veryLongUrl,
        title: 'Long URL Content',
        full_content: 'Content',
        excerpts: null,
      }

      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(mockParallelResult)

      const result = await extractContent(veryLongUrl)

      expect(result?.url).toBe(veryLongUrl)
    })

    it('should handle malformed HTML in OG metadata', async () => {
      vi.mocked(parallelClient.extractWithParallel).mockResolvedValue(null)
      vi.mocked(ogMetadataExtractor.extractOGMetadata).mockResolvedValue(null)

      const result = await extractContent(webUrls.simple)

      expect(result).toBeNull()
    })

    it('should handle concurrent extraction requests', async () => {
      const mockResult: ExtractedContent = {
        url: twitterUrls.standard,
        source: 'twitter',
        title: 'Tweet',
        content: 'Content',
      }

      vi.mocked(twitterExtractor.extractTwitterContent).mockResolvedValue(mockResult)

      const results = await Promise.all([
        extractContent(twitterUrls.standard),
        extractContent(twitterUrls.standard),
        extractContent(twitterUrls.standard),
      ])

      expect(results).toHaveLength(3)
      expect(results.every((r) => r?.title === 'Tweet')).toBe(true)
    })
  })
})
