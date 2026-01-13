/**
 * Comprehensive tests for Twitter content extractor
 *
 * Tests the Twitter/X extractor which uses the Gopher API to fetch tweet data
 * and transforms it into the ExtractedContent format.
 *
 * Coverage:
 * - URL ID extraction from various Twitter/X URL formats
 * - Media URL extraction from tweet content
 * - Successful content extraction with all metadata
 * - Error handling (invalid URLs, API failures, missing tweets)
 * - Edge cases (empty content, missing metadata, malformed data)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ExtractedContent } from '@plukd/shared'

// Mock the gopher-client module before importing
vi.mock('../gopher-client')

// Now import after mocks are set up
import {
  extractTwitterContent,
  extractTweetId,
  extractMediaUrls,
} from '../twitter'
import { getbyid, GopherApiError } from '../gopher-client'
import type { TwitterResult } from '../gopher-client'

describe('Twitter Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('extractTweetId', () => {
    describe('valid URLs', () => {
      it('should extract tweet ID from standard twitter.com URL', () => {
        const url = 'https://twitter.com/elonmusk/status/1234567890'
        const result = extractTweetId(url)

        expect(result).toEqual({
          username: 'elonmusk',
          tweetId: '1234567890',
        })
      })

      it('should extract tweet ID from x.com URL', () => {
        const url = 'https://x.com/user123/status/9876543210'
        const result = extractTweetId(url)

        expect(result).toEqual({
          username: 'user123',
          tweetId: '9876543210',
        })
      })

      it('should extract tweet ID from www.twitter.com URL', () => {
        const url = 'https://www.twitter.com/testuser/status/1111111111'
        const result = extractTweetId(url)

        expect(result).toEqual({
          username: 'testuser',
          tweetId: '1111111111',
        })
      })

      it('should extract tweet ID from www.x.com URL', () => {
        const url = 'https://www.x.com/anotheruser/status/2222222222'
        const result = extractTweetId(url)

        expect(result).toEqual({
          username: 'anotheruser',
          tweetId: '2222222222',
        })
      })

      it('should extract tweet ID from mobile.twitter.com URL', () => {
        const url = 'https://mobile.twitter.com/mobileuser/status/3333333333'
        const result = extractTweetId(url)

        expect(result).toEqual({
          username: 'mobileuser',
          tweetId: '3333333333',
        })
      })

      it('should extract tweet ID from http URL', () => {
        const url = 'http://twitter.com/httpuser/status/4444444444'
        const result = extractTweetId(url)

        expect(result).toEqual({
          username: 'httpuser',
          tweetId: '4444444444',
        })
      })

      it('should handle usernames with underscores', () => {
        const url = 'https://twitter.com/user_name_123/status/5555555555'
        const result = extractTweetId(url)

        expect(result).toEqual({
          username: 'user_name_123',
          tweetId: '5555555555',
        })
      })

      it('should handle very long tweet IDs', () => {
        const url = 'https://twitter.com/user/status/1234567890123456789'
        const result = extractTweetId(url)

        expect(result).toEqual({
          username: 'user',
          tweetId: '1234567890123456789',
        })
      })
    })

    describe('invalid URLs', () => {
      it('should return null for invalid Twitter URL format', () => {
        const url = 'https://twitter.com/elonmusk'
        const result = extractTweetId(url)

        expect(result).toBeNull()
      })

      it('should return null for non-Twitter URLs', () => {
        const url = 'https://example.com/status/1234567890'
        const result = extractTweetId(url)

        expect(result).toBeNull()
      })

      it('should return null for Twitter home page', () => {
        const url = 'https://twitter.com'
        const result = extractTweetId(url)

        expect(result).toBeNull()
      })

      it('should return null for Twitter profile URL', () => {
        const url = 'https://twitter.com/username/following'
        const result = extractTweetId(url)

        expect(result).toBeNull()
      })

      it('should return null for malformed URL', () => {
        const url = 'not-a-url'
        const result = extractTweetId(url)

        expect(result).toBeNull()
      })
    })
  })

  describe('extractMediaUrls', () => {
    describe('image extraction', () => {
      it('should extract single image URL with extension', () => {
        const content = 'Check this out https://pbs.twimg.com/media/ABC123.jpg amazing!'
        const result = extractMediaUrls(content)

        expect(result.mediaUrls).toEqual(['https://pbs.twimg.com/media/ABC123.jpg'])
        expect(result.cleanedContent).toBe('Check this out amazing!')
      })

      it('should extract multiple image URLs', () => {
        const content = 'Photos: https://pbs.twimg.com/media/img1.jpg and https://pbs.twimg.com/media/img2.png'
        const result = extractMediaUrls(content)

        expect(result.mediaUrls).toHaveLength(2)
        expect(result.mediaUrls).toContain('https://pbs.twimg.com/media/img1.jpg')
        expect(result.mediaUrls).toContain('https://pbs.twimg.com/media/img2.png')
      })

      it('should extract image URL with format query parameter', () => {
        const content = 'Image https://pbs.twimg.com/media/ABC_xyz?format=jpg&name=large here'
        const result = extractMediaUrls(content)

        expect(result.mediaUrls).toEqual(['https://pbs.twimg.com/media/ABC_xyz?format=jpg&name=large'])
        expect(result.cleanedContent).toBe('Image here')
      })

      it('should extract GIF URLs', () => {
        const content = 'Funny gif https://pbs.twimg.com/media/funny.gif lol'
        const result = extractMediaUrls(content)

        expect(result.mediaUrls).toEqual(['https://pbs.twimg.com/media/funny.gif'])
      })

      it('should extract webp format URLs', () => {
        const content = 'Modern format https://pbs.twimg.com/media/ABC?format=webp test'
        const result = extractMediaUrls(content)

        expect(result.mediaUrls).toEqual(['https://pbs.twimg.com/media/ABC?format=webp'])
      })
    })

    describe('video extraction', () => {
      it('should extract video thumbnail URL', () => {
        const content = 'Video: https://pbs.twimg.com/amplify_video_thumb/123456/img/thumb.jpg'
        const result = extractMediaUrls(content)

        expect(result.mediaUrls).toEqual(['https://pbs.twimg.com/amplify_video_thumb/123456/img/thumb.jpg'])
      })

      it('should extract external video thumbnail', () => {
        const content = 'External https://pbs.twimg.com/ext_tw_video_thumb/789/pu/img/xyz.jpg video'
        const result = extractMediaUrls(content)

        expect(result.mediaUrls).toEqual(['https://pbs.twimg.com/ext_tw_video_thumb/789/pu/img/xyz.jpg'])
      })

      it('should extract tweet video thumbnail', () => {
        const content = 'Tweet video https://pbs.twimg.com/tweet_video_thumb/ABC123.jpg here'
        const result = extractMediaUrls(content)

        expect(result.mediaUrls).toEqual(['https://pbs.twimg.com/tweet_video_thumb/ABC123.jpg'])
      })

      it('should extract video.twimg.com URLs', () => {
        const content = 'Video https://video.twimg.com/ext_tw_video/123/pu/vid/720x1280/video.mp4 cool'
        const result = extractMediaUrls(content)

        expect(result.mediaUrls).toEqual(['https://video.twimg.com/ext_tw_video/123/pu/vid/720x1280/video.mp4'])
      })
    })

    describe('duplicate handling', () => {
      it('should avoid duplicate URLs', () => {
        const content = 'Same image https://pbs.twimg.com/media/ABC.jpg twice https://pbs.twimg.com/media/ABC.jpg'
        const result = extractMediaUrls(content)

        expect(result.mediaUrls).toHaveLength(1)
        expect(result.mediaUrls).toEqual(['https://pbs.twimg.com/media/ABC.jpg'])
      })

      it('should keep different URLs even if similar', () => {
        const content = 'https://pbs.twimg.com/media/ABC.jpg and https://pbs.twimg.com/media/XYZ.jpg'
        const result = extractMediaUrls(content)

        expect(result.mediaUrls).toHaveLength(2)
      })
    })

    describe('content cleaning', () => {
      it('should remove media URLs from content', () => {
        const content = 'Great photo https://pbs.twimg.com/media/photo.jpg from yesterday'
        const result = extractMediaUrls(content)

        expect(result.cleanedContent).toBe('Great photo from yesterday')
        expect(result.cleanedContent).not.toContain('pbs.twimg.com')
      })

      it('should clean up extra whitespace after URL removal', () => {
        const content = 'Text    https://pbs.twimg.com/media/img.jpg    more text'
        const result = extractMediaUrls(content)

        expect(result.cleanedContent).toBe('Text more text')
      })

      it('should handle content with only media URLs', () => {
        const content = 'https://pbs.twimg.com/media/img1.jpg https://pbs.twimg.com/media/img2.jpg'
        const result = extractMediaUrls(content)

        expect(result.cleanedContent).toBe('')
        expect(result.mediaUrls).toHaveLength(2)
      })

      it('should preserve other URLs in content', () => {
        const content = 'Check https://example.com and https://pbs.twimg.com/media/img.jpg'
        const result = extractMediaUrls(content)

        expect(result.cleanedContent).toContain('https://example.com')
        expect(result.cleanedContent).not.toContain('pbs.twimg.com')
      })
    })

    describe('edge cases', () => {
      it('should handle empty content', () => {
        const content = ''
        const result = extractMediaUrls(content)

        expect(result.mediaUrls).toEqual([])
        expect(result.cleanedContent).toBe('')
      })

      it('should handle content with no media URLs', () => {
        const content = 'Just a regular tweet with no images'
        const result = extractMediaUrls(content)

        expect(result.mediaUrls).toEqual([])
        expect(result.cleanedContent).toBe('Just a regular tweet with no images')
      })

      it('should handle http protocol (not just https)', () => {
        const content = 'Old http://pbs.twimg.com/media/old.jpg link'
        const result = extractMediaUrls(content)

        expect(result.mediaUrls).toEqual(['http://pbs.twimg.com/media/old.jpg'])
      })

      it('should handle mixed case in URLs', () => {
        const content = 'Mixed https://pbs.twimg.com/MEDIA/ABC.JPG case'
        const result = extractMediaUrls(content)

        expect(result.mediaUrls).toHaveLength(1)
      })
    })
  })

  describe('extractTwitterContent', () => {
    describe('successful extraction', () => {
      it('should extract complete tweet content with all metadata', async () => {
        const url = 'https://twitter.com/testuser/status/1234567890'
        const mockGopherResponse: TwitterResult = {
          id: '1234567890',
          source: 'twitter',
          content: 'This is a test tweet with great content!',
          metadata: {
            conversation_id: '1234567890',
            created_at: '2024-01-15T10:00:00.000Z',
            likes: 1500,
            public_metrics: {
              like_count: 1500,
              reply_count: 50,
              retweet_count: 300,
            },
            tweet_id: 1234567890,
            user_id: 'user123',
            username: 'testuser',
          },
        }

        vi.mocked(getbyid).mockResolvedValue(mockGopherResponse)

        const result = await extractTwitterContent(url)

        expect(getbyid).toHaveBeenCalledWith('twitter', '1234567890')
        expect(result).toMatchObject({
          url,
          source: 'twitter',
          title: 'This is a test tweet with great content!',
          content: 'This is a test tweet with great content!',
          author: '@testuser',
          authorUrl: 'https://x.com/testuser',
          publishedAt: new Date('2024-01-15T10:00:00.000Z'),
          engagement: {
            likes: 1500,
            comments: 50,
            shares: 300,
          },
        })
      })

      it('should extract tweet with media URLs', async () => {
        const url = 'https://x.com/photos/status/9999999999'
        const mockGopherResponse: TwitterResult = {
          id: '9999999999',
          source: 'twitter',
          content: 'Amazing sunset! https://pbs.twimg.com/media/sunset.jpg #photography',
          metadata: {
            conversation_id: '9999999999',
            created_at: '2024-01-16T18:30:00.000Z',
            likes: 5000,
            public_metrics: {
              like_count: 5000,
              reply_count: 200,
              retweet_count: 1000,
            },
            tweet_id: 9999999999,
            user_id: 'photographer',
            username: 'photos',
          },
        }

        vi.mocked(getbyid).mockResolvedValue(mockGopherResponse)

        const result = await extractTwitterContent(url)

        expect(result.mediaUrls).toBeDefined()
        expect(result.mediaUrls).toContain('https://pbs.twimg.com/media/sunset.jpg')
        expect(result.content).not.toContain('pbs.twimg.com')
        expect(result.content).toContain('#photography')
      })

      it('should handle tweet with multiple media items', async () => {
        const url = 'https://twitter.com/user/status/1111111111'
        const mockGopherResponse: TwitterResult = {
          id: '1111111111',
          source: 'twitter',
          content: 'Gallery: https://pbs.twimg.com/media/img1.jpg https://pbs.twimg.com/media/img2.png https://video.twimg.com/video.mp4',
          metadata: {
            conversation_id: '1111111111',
            created_at: '2024-01-17T12:00:00.000Z',
            likes: 800,
            public_metrics: {
              like_count: 800,
              reply_count: 30,
              retweet_count: 100,
            },
            tweet_id: 1111111111,
            user_id: 'user123',
            username: 'user',
          },
        }

        vi.mocked(getbyid).mockResolvedValue(mockGopherResponse)

        const result = await extractTwitterContent(url)

        expect(result.mediaUrls).toHaveLength(3)
        expect(result.content).toBe('Gallery:')
      })

      it('should use fallback metadata fields when public_metrics unavailable', async () => {
        const url = 'https://twitter.com/oldtweet/status/8888888888'
        const mockGopherResponse: TwitterResult = {
          id: '8888888888',
          source: 'twitter',
          content: 'Old tweet format',
          metadata: {
            conversation_id: '8888888888',
            created_at: '2020-01-01T00:00:00.000Z',
            likes: 100,
            public_metrics: {
              like_count: 0,
              reply_count: 0,
              retweet_count: 0,
            },
            tweet_id: 8888888888,
            user_id: 'old',
            username: 'oldtweet',
          },
        }

        vi.mocked(getbyid).mockResolvedValue(mockGopherResponse)

        const result = await extractTwitterContent(url)

        // Note: Due to ?? operator, public_metrics.like_count: 0 takes precedence
        expect(result.engagement?.likes).toBe(0)
      })

      it('should generate title from content up to 80 chars', async () => {
        const longContent = 'A'.repeat(100)
        const url = 'https://twitter.com/user/status/7777777777'
        const mockGopherResponse: TwitterResult = {
          id: '7777777777',
          source: 'twitter',
          content: longContent,
          metadata: {
            conversation_id: '7777777777',
            created_at: '2024-01-18T09:00:00.000Z',
            likes: 0,
            public_metrics: {
              like_count: 0,
              reply_count: 0,
              retweet_count: 0,
            },
            tweet_id: 7777777777,
            user_id: 'user123',
            username: 'user',
          },
        }

        vi.mocked(getbyid).mockResolvedValue(mockGopherResponse)

        const result = await extractTwitterContent(url)

        expect(result.title.length).toBeLessThanOrEqual(80)
        expect(result.title).toContain('...')
      })

      it('should use username fallback for title when content is empty', async () => {
        const url = 'https://twitter.com/emptyuser/status/6666666666'
        const mockGopherResponse: TwitterResult = {
          id: '6666666666',
          source: 'twitter',
          content: '   ',
          metadata: {
            conversation_id: '6666666666',
            created_at: '2024-01-19T14:00:00.000Z',
            likes: 0,
            public_metrics: {
              like_count: 0,
              reply_count: 0,
              retweet_count: 0,
            },
            tweet_id: 6666666666,
            user_id: 'empty',
            username: 'emptyuser',
          },
        }

        vi.mocked(getbyid).mockResolvedValue(mockGopherResponse)

        const result = await extractTwitterContent(url)

        expect(result.title).toBe('@emptyuser on Twitter')
      })

      it('should include rawMetadata in result', async () => {
        const url = 'https://twitter.com/user/status/5555555555'
        const mockGopherResponse: TwitterResult = {
          id: '5555555555',
          source: 'twitter',
          content: 'Tweet with metadata',
          metadata: {
            conversation_id: '5555555555',
            created_at: '2024-01-20T16:00:00.000Z',
            likes: 50,
            public_metrics: {
              like_count: 50,
              reply_count: 5,
              retweet_count: 10,
            },
            tweet_id: 5555555555,
            user_id: 'user123',
            username: 'user',
          },
        }

        vi.mocked(getbyid).mockResolvedValue(mockGopherResponse)

        const result = await extractTwitterContent(url)

        expect(result.rawMetadata).toBeDefined()
        expect(result.rawMetadata?.id).toBe('5555555555')
        expect(result.rawMetadata?.source).toBe('twitter')
      })
    })

    describe('error handling', () => {
      it('should throw error for invalid Twitter URL format', async () => {
        const url = 'https://twitter.com/invalid-url'

        await expect(extractTwitterContent(url)).rejects.toThrow(
          'Invalid Twitter/X URL format'
        )
        expect(getbyid).not.toHaveBeenCalled()
      })

      it('should throw error when tweet not found', async () => {
        const url = 'https://twitter.com/user/status/9999999999'
        vi.mocked(getbyid).mockResolvedValue(null)

        await expect(extractTwitterContent(url)).rejects.toThrow(GopherApiError)
      })

      it('should throw GopherApiError when API fails', async () => {
        const url = 'https://twitter.com/user/status/1234567890'
        const apiError = new GopherApiError('API request failed', 500)
        vi.mocked(getbyid).mockRejectedValue(apiError)

        await expect(extractTwitterContent(url)).rejects.toThrow(GopherApiError)
      })

      it('should handle network timeout errors', async () => {
        const url = 'https://twitter.com/user/status/1234567890'
        const timeoutError = new Error('Request timeout')
        vi.mocked(getbyid).mockRejectedValue(timeoutError)

        await expect(extractTwitterContent(url)).rejects.toThrow('Request timeout')
      })

      it('should handle rate limiting errors', async () => {
        const url = 'https://twitter.com/user/status/1234567890'
        const rateLimitError = new GopherApiError('Rate limit exceeded', 429)
        vi.mocked(getbyid).mockRejectedValue(rateLimitError)

        await expect(extractTwitterContent(url)).rejects.toThrow(GopherApiError)
      })
    })

    describe('edge cases', () => {
      it('should handle missing metadata fields gracefully', async () => {
        const url = 'https://twitter.com/user/status/4444444444'
        const mockGopherResponse: TwitterResult = {
          id: '4444444444',
          source: 'twitter',
          content: 'Minimal tweet',
          metadata: {
            conversation_id: '4444444444',
            created_at: '2024-01-21T10:00:00.000Z',
            likes: 0,
            public_metrics: {
              like_count: 0,
              reply_count: 0,
              retweet_count: 0,
            },
            tweet_id: 4444444444,
            user_id: 'user123',
            username: 'user',
          },
        }

        vi.mocked(getbyid).mockResolvedValue(mockGopherResponse)

        const result = await extractTwitterContent(url)

        expect(result).toBeDefined()
        expect(result.engagement).toEqual({
          likes: 0,
          comments: 0,
          shares: 0,
        })
      })

      it('should handle invalid date gracefully', async () => {
        const url = 'https://twitter.com/user/status/3333333333'
        const mockGopherResponse: TwitterResult = {
          id: '3333333333',
          source: 'twitter',
          content: 'Tweet with bad date',
          metadata: {
            conversation_id: '3333333333',
            created_at: 'invalid-date',
            likes: 0,
            public_metrics: {
              like_count: 0,
              reply_count: 0,
              retweet_count: 0,
            },
            tweet_id: 3333333333,
            user_id: 'user123',
            username: 'user',
          },
        }

        vi.mocked(getbyid).mockResolvedValue(mockGopherResponse)

        const result = await extractTwitterContent(url)

        expect(result.publishedAt).toBeUndefined()
      })

      it('should handle empty content string', async () => {
        const url = 'https://twitter.com/user/status/2222222222'
        const mockGopherResponse: TwitterResult = {
          id: '2222222222',
          source: 'twitter',
          content: '',
          metadata: {
            conversation_id: '2222222222',
            created_at: '2024-01-22T11:00:00.000Z',
            likes: 0,
            public_metrics: {
              like_count: 0,
              reply_count: 0,
              retweet_count: 0,
            },
            tweet_id: 2222222222,
            user_id: 'user123',
            username: 'user',
          },
        }

        vi.mocked(getbyid).mockResolvedValue(mockGopherResponse)

        const result = await extractTwitterContent(url)

        expect(result.content).toBe('')
        expect(result.title).toBe('@user on Twitter')
      })

      it('should use URL username when metadata username missing', async () => {
        const url = 'https://twitter.com/urluser/status/1111111111'
        const mockGopherResponse: TwitterResult = {
          id: '1111111111',
          source: 'twitter',
          content: 'Test tweet',
          metadata: {
            conversation_id: '1111111111',
            created_at: '2024-01-23T12:00:00.000Z',
            likes: 0,
            public_metrics: {
              like_count: 0,
              reply_count: 0,
              retweet_count: 0,
            },
            tweet_id: 1111111111,
            user_id: 'user123',
            username: '',
          },
        }

        vi.mocked(getbyid).mockResolvedValue(mockGopherResponse)

        const result = await extractTwitterContent(url)

        expect(result.author).toBe('@urluser')
        expect(result.authorUrl).toBe('https://x.com/urluser')
      })

      it('should handle tweets with only media (no text)', async () => {
        const url = 'https://twitter.com/user/status/7777777777'
        const mockGopherResponse: TwitterResult = {
          id: '7777777777',
          source: 'twitter',
          content: 'https://pbs.twimg.com/media/photo.jpg',
          metadata: {
            conversation_id: '7777777777',
            created_at: '2024-01-24T13:00:00.000Z',
            likes: 1000,
            public_metrics: {
              like_count: 1000,
              reply_count: 20,
              retweet_count: 50,
            },
            tweet_id: 7777777777,
            user_id: 'user123',
            username: 'user',
          },
        }

        vi.mocked(getbyid).mockResolvedValue(mockGopherResponse)

        const result = await extractTwitterContent(url)

        expect(result.mediaUrls).toHaveLength(1)
        expect(result.content).toBe('')
        expect(result.title).toBe('@user on Twitter')
      })

      it('should handle very large engagement numbers', async () => {
        const url = 'https://twitter.com/viral/status/8888888888'
        const mockGopherResponse: TwitterResult = {
          id: '8888888888',
          source: 'twitter',
          content: 'Viral tweet!',
          metadata: {
            conversation_id: '8888888888',
            created_at: '2024-01-25T14:00:00.000Z',
            likes: 5000000,
            public_metrics: {
              like_count: 5000000,
              reply_count: 100000,
              retweet_count: 1000000,
            },
            tweet_id: 8888888888,
            user_id: 'viral',
            username: 'viral',
          },
        }

        vi.mocked(getbyid).mockResolvedValue(mockGopherResponse)

        const result = await extractTwitterContent(url)

        expect(result.engagement).toEqual({
          likes: 5000000,
          comments: 100000,
          shares: 1000000,
        })
      })
    })
  })
})
