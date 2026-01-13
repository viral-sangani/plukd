/**
 * Comprehensive tests for Instagram video downloader and content type detection
 *
 * Tests cover:
 * - URL type detection (isInstagramVideoUrl, maybeInstagramVideo, isInstagramReelUrl)
 * - GraphQL media info fetching
 * - Carousel detection
 * - shouldTranscribeInstagram logic
 * - Video download functionality
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Instagram Video Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment
    delete process.env.DEBUG
    delete process.env.RAPIDAPI_KEY
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Import after mocks are set up
  const importModule = async () => {
    // Clear module cache to get fresh imports
    vi.resetModules()
    return import('../instagram-video')
  }

  describe('isInstagramVideoUrl', () => {
    it('should return true for /reel/ URLs', async () => {
      const { isInstagramVideoUrl } = await importModule()
      expect(isInstagramVideoUrl('https://www.instagram.com/reel/ABC123xyz/')).toBe(true)
      expect(isInstagramVideoUrl('https://instagram.com/reel/XYZ789/')).toBe(true)
    })

    it('should return true for /reels/ URLs', async () => {
      const { isInstagramVideoUrl } = await importModule()
      expect(isInstagramVideoUrl('https://www.instagram.com/reels/ABC123xyz/')).toBe(true)
    })

    it('should return false for /p/ URLs (posts may be images)', async () => {
      const { isInstagramVideoUrl } = await importModule()
      expect(isInstagramVideoUrl('https://www.instagram.com/p/ABC123xyz/')).toBe(false)
      expect(isInstagramVideoUrl('https://instagram.com/p/XYZ789/')).toBe(false)
    })

    it('should return false for /tv/ URLs', async () => {
      const { isInstagramVideoUrl } = await importModule()
      expect(isInstagramVideoUrl('https://www.instagram.com/tv/ABC123xyz/')).toBe(false)
    })

    it('should return false for profile URLs', async () => {
      const { isInstagramVideoUrl } = await importModule()
      expect(isInstagramVideoUrl('https://www.instagram.com/username/')).toBe(false)
    })

    it('should return false for non-Instagram URLs', async () => {
      const { isInstagramVideoUrl } = await importModule()
      expect(isInstagramVideoUrl('https://twitter.com/user/status/123')).toBe(false)
      expect(isInstagramVideoUrl('https://example.com/reel/123')).toBe(false)
    })

    it('should return false for invalid URLs', async () => {
      const { isInstagramVideoUrl } = await importModule()
      expect(isInstagramVideoUrl('not-a-url')).toBe(false)
      expect(isInstagramVideoUrl('')).toBe(false)
    })

    it('should handle URLs with query parameters', async () => {
      const { isInstagramVideoUrl } = await importModule()
      expect(isInstagramVideoUrl('https://www.instagram.com/reel/ABC123/?utm_source=share')).toBe(true)
      expect(isInstagramVideoUrl('https://www.instagram.com/p/ABC123/?igshid=xyz')).toBe(false)
    })

    it('should be case-insensitive', async () => {
      const { isInstagramVideoUrl } = await importModule()
      expect(isInstagramVideoUrl('https://www.instagram.com/REEL/ABC123/')).toBe(true)
      expect(isInstagramVideoUrl('https://www.instagram.com/Reel/ABC123/')).toBe(true)
    })
  })

  describe('isInstagramReelUrl', () => {
    it('should return true for /reel/ URLs', async () => {
      const { isInstagramReelUrl } = await importModule()
      expect(isInstagramReelUrl('https://www.instagram.com/reel/ABC123xyz/')).toBe(true)
    })

    it('should return true for /reels/ URLs', async () => {
      const { isInstagramReelUrl } = await importModule()
      expect(isInstagramReelUrl('https://www.instagram.com/reels/ABC123xyz/')).toBe(true)
    })

    it('should return false for /p/ URLs', async () => {
      const { isInstagramReelUrl } = await importModule()
      expect(isInstagramReelUrl('https://www.instagram.com/p/ABC123xyz/')).toBe(false)
    })

    it('should return false for /tv/ URLs', async () => {
      const { isInstagramReelUrl } = await importModule()
      expect(isInstagramReelUrl('https://www.instagram.com/tv/ABC123xyz/')).toBe(false)
    })
  })

  describe('maybeInstagramVideo', () => {
    it('should return true for /p/ URLs (posts might be videos)', async () => {
      const { maybeInstagramVideo } = await importModule()
      expect(maybeInstagramVideo('https://www.instagram.com/p/ABC123xyz/')).toBe(true)
    })

    it('should return true for /tv/ URLs (IGTV videos)', async () => {
      const { maybeInstagramVideo } = await importModule()
      expect(maybeInstagramVideo('https://www.instagram.com/tv/ABC123xyz/')).toBe(true)
    })

    it('should return false for /reel/ URLs (handled by isInstagramVideoUrl)', async () => {
      const { maybeInstagramVideo } = await importModule()
      expect(maybeInstagramVideo('https://www.instagram.com/reel/ABC123xyz/')).toBe(false)
    })

    it('should return false for profile URLs', async () => {
      const { maybeInstagramVideo } = await importModule()
      expect(maybeInstagramVideo('https://www.instagram.com/username/')).toBe(false)
    })

    it('should return false for non-Instagram URLs', async () => {
      const { maybeInstagramVideo } = await importModule()
      expect(maybeInstagramVideo('https://twitter.com/p/123')).toBe(false)
    })
  })

  describe('getInstagramMediaInfo', () => {
    it('should return video info for a video post', async () => {
      const { getInstagramMediaInfo } = await importModule()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              xdt_shortcode_media: {
                is_video: true,
                video_url: 'https://video.cdninstagram.com/video.mp4',
                display_url: 'https://instagram.com/thumbnail.jpg',
                dimensions: { width: 1080, height: 1920 },
              },
            },
          }),
      })

      const result = await getInstagramMediaInfo('https://www.instagram.com/p/ABC123/')

      expect(result).toEqual({
        isVideo: true,
        isCarousel: false,
        videoUrl: 'https://video.cdninstagram.com/video.mp4',
        thumbnailUrl: 'https://instagram.com/thumbnail.jpg',
        carouselItems: undefined,
      })
    })

    it('should return image info for an image post', async () => {
      const { getInstagramMediaInfo } = await importModule()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              xdt_shortcode_media: {
                is_video: false,
                display_url: 'https://instagram.com/image.jpg',
                dimensions: { width: 1080, height: 1080 },
              },
            },
          }),
      })

      const result = await getInstagramMediaInfo('https://www.instagram.com/p/ABC123/')

      expect(result).toEqual({
        isVideo: false,
        isCarousel: false,
        videoUrl: undefined,
        thumbnailUrl: 'https://instagram.com/image.jpg',
        carouselItems: undefined,
      })
    })

    it('should detect carousel posts with multiple images', async () => {
      const { getInstagramMediaInfo } = await importModule()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              xdt_shortcode_media: {
                is_video: false,
                display_url: 'https://instagram.com/cover.jpg',
                edge_sidecar_to_children: {
                  edges: [
                    {
                      node: {
                        is_video: false,
                        display_url: 'https://instagram.com/image1.jpg',
                      },
                    },
                    {
                      node: {
                        is_video: false,
                        display_url: 'https://instagram.com/image2.jpg',
                      },
                    },
                    {
                      node: {
                        is_video: false,
                        display_url: 'https://instagram.com/image3.jpg',
                      },
                    },
                  ],
                },
              },
            },
          }),
      })

      const result = await getInstagramMediaInfo('https://www.instagram.com/p/ABC123/')

      expect(result).toEqual({
        isVideo: false,
        isCarousel: true,
        videoUrl: undefined,
        thumbnailUrl: 'https://instagram.com/cover.jpg',
        carouselItems: [
          { isVideo: false, url: 'https://instagram.com/image1.jpg' },
          { isVideo: false, url: 'https://instagram.com/image2.jpg' },
          { isVideo: false, url: 'https://instagram.com/image3.jpg' },
        ],
      })
    })

    it('should detect carousel posts with mixed content (images and videos)', async () => {
      const { getInstagramMediaInfo } = await importModule()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              xdt_shortcode_media: {
                is_video: false,
                display_url: 'https://instagram.com/cover.jpg',
                edge_sidecar_to_children: {
                  edges: [
                    {
                      node: {
                        is_video: false,
                        display_url: 'https://instagram.com/image1.jpg',
                      },
                    },
                    {
                      node: {
                        is_video: true,
                        display_url: 'https://instagram.com/video-thumb.jpg',
                        video_url: 'https://video.cdninstagram.com/video.mp4',
                      },
                    },
                  ],
                },
              },
            },
          }),
      })

      const result = await getInstagramMediaInfo('https://www.instagram.com/p/ABC123/')

      expect(result).toEqual({
        isVideo: false,
        isCarousel: true,
        videoUrl: undefined,
        thumbnailUrl: 'https://instagram.com/cover.jpg',
        carouselItems: [
          { isVideo: false, url: 'https://instagram.com/image1.jpg' },
          { isVideo: true, url: 'https://video.cdninstagram.com/video.mp4', thumbnailUrl: 'https://instagram.com/video-thumb.jpg' },
        ],
      })
    })

    it('should return null when GraphQL API fails', async () => {
      const { getInstagramMediaInfo } = await importModule()

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
      })

      const result = await getInstagramMediaInfo('https://www.instagram.com/p/ABC123/')

      expect(result).toBeNull()
    })

    it('should return null when no media data in response', async () => {
      const { getInstagramMediaInfo } = await importModule()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      })

      const result = await getInstagramMediaInfo('https://www.instagram.com/p/ABC123/')

      expect(result).toBeNull()
    })

    it('should return null for invalid URLs', async () => {
      const { getInstagramMediaInfo } = await importModule()

      const result = await getInstagramMediaInfo('https://www.instagram.com/username/')

      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle network errors gracefully', async () => {
      const { getInstagramMediaInfo } = await importModule()

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await getInstagramMediaInfo('https://www.instagram.com/p/ABC123/')

      expect(result).toBeNull()
    })
  })

  describe('shouldTranscribeInstagram', () => {
    it('should return true for reel URLs without media info', async () => {
      const { shouldTranscribeInstagram } = await importModule()

      const result = await shouldTranscribeInstagram('https://www.instagram.com/reel/ABC123/')

      expect(result).toBe(true)
    })

    it('should return true for reel URLs even with media info', async () => {
      const { shouldTranscribeInstagram } = await importModule()

      // Reels are always videos, so we don't need to check
      const result = await shouldTranscribeInstagram('https://www.instagram.com/reel/ABC123/')

      expect(result).toBe(true)
    })

    it('should return false for /p/ image posts', async () => {
      const { shouldTranscribeInstagram, getInstagramMediaInfo } = await importModule()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              xdt_shortcode_media: {
                is_video: false,
                display_url: 'https://instagram.com/image.jpg',
              },
            },
          }),
      })

      // First get the media info
      const mediaInfo = await getInstagramMediaInfo('https://www.instagram.com/p/ABC123/')

      const result = await shouldTranscribeInstagram(
        'https://www.instagram.com/p/ABC123/',
        mediaInfo ?? undefined
      )

      expect(result).toBe(false)
    })

    it('should return true for /p/ video posts', async () => {
      const { shouldTranscribeInstagram, getInstagramMediaInfo } = await importModule()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              xdt_shortcode_media: {
                is_video: true,
                video_url: 'https://video.cdninstagram.com/video.mp4',
              },
            },
          }),
      })

      const mediaInfo = await getInstagramMediaInfo('https://www.instagram.com/p/ABC123/')

      const result = await shouldTranscribeInstagram(
        'https://www.instagram.com/p/ABC123/',
        mediaInfo ?? undefined
      )

      expect(result).toBe(true)
    })

    it('should return false for carousel posts', async () => {
      const { shouldTranscribeInstagram, getInstagramMediaInfo } = await importModule()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              xdt_shortcode_media: {
                is_video: false,
                display_url: 'https://instagram.com/cover.jpg',
                edge_sidecar_to_children: {
                  edges: [
                    { node: { is_video: false, display_url: 'https://instagram.com/img1.jpg' } },
                    { node: { is_video: false, display_url: 'https://instagram.com/img2.jpg' } },
                  ],
                },
              },
            },
          }),
      })

      const mediaInfo = await getInstagramMediaInfo('https://www.instagram.com/p/ABC123/')

      const result = await shouldTranscribeInstagram(
        'https://www.instagram.com/p/ABC123/',
        mediaInfo ?? undefined
      )

      expect(result).toBe(false)
    })

    it('should fetch media info if not provided for /p/ URLs', async () => {
      const { shouldTranscribeInstagram } = await importModule()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              xdt_shortcode_media: {
                is_video: true,
                video_url: 'https://video.cdninstagram.com/video.mp4',
              },
            },
          }),
      })

      const result = await shouldTranscribeInstagram('https://www.instagram.com/p/ABC123/')

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should return false when media info cannot be fetched for /p/ URLs', async () => {
      const { shouldTranscribeInstagram } = await importModule()

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
      })

      const result = await shouldTranscribeInstagram('https://www.instagram.com/p/ABC123/')

      expect(result).toBe(false)
    })

    it('should return false for non-Instagram URLs', async () => {
      const { shouldTranscribeInstagram } = await importModule()

      const result = await shouldTranscribeInstagram('https://twitter.com/user/status/123')

      expect(result).toBe(false)
    })
  })

  describe('downloadInstagramVideo', () => {
    it('should download video using GraphQL API', async () => {
      const { downloadInstagramVideo } = await importModule()

      // Mock GraphQL API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              xdt_shortcode_media: {
                is_video: true,
                video_url: 'https://video.cdninstagram.com/video.mp4',
              },
            },
          }),
      })

      // Mock video download - need enough bytes to pass validation
      const mockVideoBuffer = Buffer.alloc(2000, 'x') // 2000 bytes to pass the 1000 byte check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'video/mp4']]),
        arrayBuffer: () => Promise.resolve(mockVideoBuffer.buffer),
      })

      const result = await downloadInstagramVideo('https://www.instagram.com/reel/ABC123/')

      expect(result).toBeDefined()
      expect(result.buffer).toBeDefined()
      expect(result.mimeType).toBe('video/mp4')
    })

    it('should throw error when video cannot be downloaded', async () => {
      const { downloadInstagramVideo } = await importModule()

      // Mock all methods failing
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      })

      await expect(
        downloadInstagramVideo('https://www.instagram.com/reel/ABC123/')
      ).rejects.toThrow()
    })

    it('should throw error for invalid shortcode', async () => {
      const { downloadInstagramVideo } = await importModule()

      await expect(
        downloadInstagramVideo('https://www.instagram.com/username/')
      ).rejects.toThrow('Could not extract shortcode')
    })
  })

  describe('extractShortcode', () => {
    it('should extract shortcode from various URL formats', async () => {
      const { extractShortcode } = await importModule()

      expect(extractShortcode('https://www.instagram.com/p/ABC123xyz/')).toBe('ABC123xyz')
      expect(extractShortcode('https://www.instagram.com/reel/XYZ789/')).toBe('XYZ789')
      expect(extractShortcode('https://instagram.com/p/DEF456/')).toBe('DEF456')
      expect(extractShortcode('https://www.instagram.com/tv/GHI789/')).toBe('GHI789')
    })

    it('should return null for URLs without shortcode', async () => {
      const { extractShortcode } = await importModule()

      expect(extractShortcode('https://www.instagram.com/username/')).toBeNull()
      expect(extractShortcode('https://www.instagram.com/')).toBeNull()
    })

    it('should handle URLs with query parameters', async () => {
      const { extractShortcode } = await importModule()

      expect(extractShortcode('https://www.instagram.com/p/ABC123/?utm_source=share')).toBe('ABC123')
    })
  })

  describe('DEBUG mode logging', () => {
    it('should not log verbose messages when DEBUG is not set', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { getInstagramMediaInfo } = await importModule()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              xdt_shortcode_media: {
                is_video: true,
                video_url: 'https://video.cdninstagram.com/video.mp4',
              },
            },
          }),
      })

      await getInstagramMediaInfo('https://www.instagram.com/p/ABC123/')

      // Should not have verbose debug logs
      const debugLogs = consoleSpy.mock.calls.filter(
        (call) => call[0]?.includes?.('[instagram-video]') && call[0]?.includes?.('GraphQL')
      )
      expect(debugLogs.length).toBe(0)

      consoleSpy.mockRestore()
    })

    it('should log verbose messages when DEBUG=true', async () => {
      process.env.DEBUG = 'true'
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Need to reimport to pick up DEBUG env var
      vi.resetModules()
      const { getInstagramMediaInfo } = await import('../instagram-video')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              xdt_shortcode_media: {
                is_video: true,
                video_url: 'https://video.cdninstagram.com/video.mp4',
              },
            },
          }),
      })

      await getInstagramMediaInfo('https://www.instagram.com/p/ABC123/')

      // Should have debug logs when DEBUG=true
      const allLogs = consoleSpy.mock.calls.map((call) => call[0])
      const hasDebugLogs = allLogs.some(
        (log) => typeof log === 'string' && log.includes('[instagram-video]')
      )
      expect(hasDebugLogs).toBe(true)

      consoleSpy.mockRestore()
    })
  })
})
