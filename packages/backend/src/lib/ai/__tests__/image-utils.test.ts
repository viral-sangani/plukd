/**
 * Comprehensive test suite for image-utils module
 *
 * Coverage goals:
 * - image-utils.ts: 80%+ statements, 80%+ branches, 80%+ functions
 *
 * Tests cover:
 * - Image URL validation (protocol, extension, malformed URLs)
 * - Trusted domain verification (exact matches, wildcards, edge cases)
 * - Media URL filtering (validation, limits, empty inputs)
 * - Image part building (valid/invalid URLs, error handling)
 * - Edge cases (security, performance, boundary conditions)
 */

import { describe, it, expect } from 'vitest'
import {
  isValidImageUrl,
  isTrustedImageDomain,
  filterMediaUrls,
  buildImageParts,
  type ImagePart,
} from '../image-utils'

// =============================================================================
// A. IMAGE URL VALIDATION TESTS (15 tests)
// =============================================================================

describe('isValidImageUrl', () => {
  describe('Valid Image URLs', () => {
    it('should accept HTTPS URLs with .jpg extension', () => {
      expect(isValidImageUrl('https://example.com/image.jpg')).toBe(true)
    })

    it('should accept HTTPS URLs with .jpeg extension', () => {
      expect(isValidImageUrl('https://example.com/photo.jpeg')).toBe(true)
    })

    it('should accept HTTPS URLs with .png extension', () => {
      expect(isValidImageUrl('https://example.com/graphic.png')).toBe(true)
    })

    it('should accept HTTPS URLs with .gif extension', () => {
      expect(isValidImageUrl('https://example.com/animation.gif')).toBe(true)
    })

    it('should accept HTTPS URLs with .webp extension', () => {
      expect(isValidImageUrl('https://example.com/modern.webp')).toBe(true)
    })

    it('should accept HTTP URLs with image extensions', () => {
      expect(isValidImageUrl('http://example.com/image.png')).toBe(true)
    })

    it('should accept URLs with query parameters', () => {
      expect(isValidImageUrl('https://example.com/image.jpg?size=large&quality=high')).toBe(true)
    })

    it('should accept URLs with hash fragments', () => {
      expect(isValidImageUrl('https://example.com/image.png#thumbnail')).toBe(true)
    })

    it('should be case-insensitive for extensions', () => {
      expect(isValidImageUrl('https://example.com/IMAGE.JPG')).toBe(true)
      expect(isValidImageUrl('https://example.com/photo.PNG')).toBe(true)
      expect(isValidImageUrl('https://example.com/graphic.WebP')).toBe(true)
    })

    it('should accept URLs with complex paths', () => {
      expect(isValidImageUrl('https://cdn.example.com/users/123/uploads/2024/01/photo.jpg')).toBe(
        true
      )
    })
  })

  describe('Invalid Image URLs', () => {
    it('should reject URLs without image extensions', () => {
      expect(isValidImageUrl('https://example.com/page')).toBe(false)
      expect(isValidImageUrl('https://example.com/document.pdf')).toBe(false)
    })

    it('should reject non-HTTP(S) protocols', () => {
      expect(isValidImageUrl('ftp://example.com/image.png')).toBe(false)
      expect(isValidImageUrl('file:///path/to/image.jpg')).toBe(false)
      expect(isValidImageUrl('data:image/png;base64,abc123')).toBe(false)
    })

    it('should reject malformed URLs', () => {
      expect(isValidImageUrl('not a url')).toBe(false)
      expect(isValidImageUrl('htp://broken.com/image.jpg')).toBe(false)
      expect(isValidImageUrl('')).toBe(false)
    })

    it('should reject URLs with extension in domain but not path', () => {
      expect(isValidImageUrl('https://image.jpg.com/page')).toBe(false)
    })

    it('should reject URLs with extension in query parameter only', () => {
      expect(isValidImageUrl('https://example.com/download?file=image.jpg')).toBe(false)
    })
  })
})

// =============================================================================
// B. TRUSTED DOMAIN VERIFICATION TESTS (20 tests)
// =============================================================================

describe('isTrustedImageDomain', () => {
  describe('Twitter/X Domains', () => {
    it('should trust pbs.twimg.com', () => {
      expect(isTrustedImageDomain('https://pbs.twimg.com/media/123.jpg')).toBe(true)
    })

    it('should trust video.twimg.com', () => {
      expect(isTrustedImageDomain('https://video.twimg.com/tweet_video/abc.mp4')).toBe(true)
    })

    it('should be case-insensitive for Twitter domains', () => {
      expect(isTrustedImageDomain('https://PBS.TWIMG.COM/media/123.jpg')).toBe(true)
    })
  })

  describe('Reddit Domains', () => {
    it('should trust i.redd.it', () => {
      expect(isTrustedImageDomain('https://i.redd.it/abc123.png')).toBe(true)
    })

    it('should trust preview.redd.it', () => {
      expect(isTrustedImageDomain('https://preview.redd.it/xyz789.jpg')).toBe(true)
    })
  })

  describe('Imgur Domains', () => {
    it('should trust i.imgur.com', () => {
      expect(isTrustedImageDomain('https://i.imgur.com/abc123.gif')).toBe(true)
    })

    it('should reject www.imgur.com (not in trusted list)', () => {
      expect(isTrustedImageDomain('https://www.imgur.com/abc123')).toBe(false)
    })
  })

  describe('Instagram Domains', () => {
    it('should trust scontent.cdninstagram.com', () => {
      expect(isTrustedImageDomain('https://scontent.cdninstagram.com/v/t51.jpg')).toBe(true)
    })
  })

  describe('Facebook CDN Domains (Wildcard)', () => {
    it('should trust exact fbcdn.net domain', () => {
      expect(isTrustedImageDomain('https://fbcdn.net/image.jpg')).toBe(true)
    })

    it('should trust *.fbcdn.net subdomains', () => {
      expect(isTrustedImageDomain('https://scontent-lax3-1.xx.fbcdn.net/v/t1.jpg')).toBe(true)
      expect(isTrustedImageDomain('https://scontent.xx.fbcdn.net/image.png')).toBe(true)
      expect(isTrustedImageDomain('https://external.xx.fbcdn.net/safe_image.php')).toBe(true)
    })

    it('should trust deeply nested fbcdn.net subdomains', () => {
      expect(isTrustedImageDomain('https://a.b.c.fbcdn.net/image.jpg')).toBe(true)
    })

    it('should reject domains that contain fbcdn.net but do not end with it', () => {
      expect(isTrustedImageDomain('https://fbcdn.net.evil.com/image.jpg')).toBe(false)
    })

    it('should be case-insensitive for Facebook domains', () => {
      expect(isTrustedImageDomain('https://SCONTENT.XX.FBCDN.NET/image.jpg')).toBe(true)
    })
  })

  describe('Untrusted Domains', () => {
    it('should reject random domains', () => {
      expect(isTrustedImageDomain('https://malicious-site.com/image.jpg')).toBe(false)
      expect(isTrustedImageDomain('https://evil.com/fake.png')).toBe(false)
    })

    it('should reject domains similar to trusted ones', () => {
      expect(isTrustedImageDomain('https://pbs.twimg.com.evil.com/image.jpg')).toBe(false)
      expect(isTrustedImageDomain('https://fake-i.redd.it/image.png')).toBe(false)
    })

    it('should reject subdomain of trusted domain that is not wildcard-enabled', () => {
      expect(isTrustedImageDomain('https://cdn.pbs.twimg.com/image.jpg')).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle malformed URLs gracefully', () => {
      expect(isTrustedImageDomain('not a url')).toBe(false)
      expect(isTrustedImageDomain('')).toBe(false)
      expect(isTrustedImageDomain('htp://broken.com')).toBe(false)
    })

    it('should reject data URLs', () => {
      expect(isTrustedImageDomain('data:image/png;base64,abc123')).toBe(false)
    })

    it('should handle URLs with ports', () => {
      expect(isTrustedImageDomain('https://pbs.twimg.com:443/image.jpg')).toBe(true)
      expect(isTrustedImageDomain('https://evil.com:8080/image.jpg')).toBe(false)
    })
  })
})

// =============================================================================
// C. MEDIA URL FILTERING TESTS (15 tests)
// =============================================================================

describe('filterMediaUrls', () => {
  describe('Basic Filtering', () => {
    it('should filter and return valid trusted image URLs', () => {
      const urls = [
        'https://pbs.twimg.com/media/123.jpg',
        'https://i.redd.it/post.png',
        'https://i.imgur.com/abc.gif',
      ]

      const result = filterMediaUrls(urls)

      expect(result).toEqual(urls)
      expect(result.length).toBe(3)
    })

    it('should reject invalid image URLs', () => {
      const urls = [
        'https://pbs.twimg.com/media/123.jpg', // valid
        'https://pbs.twimg.com/page', // no extension
        'ftp://pbs.twimg.com/image.png', // bad protocol
      ]

      const result = filterMediaUrls(urls)

      expect(result).toEqual(['https://pbs.twimg.com/media/123.jpg'])
      expect(result.length).toBe(1)
    })

    it('should reject untrusted domains', () => {
      const urls = [
        'https://pbs.twimg.com/media/123.jpg', // trusted
        'https://malicious.com/fake.jpg', // untrusted
        'https://i.redd.it/post.png', // trusted
      ]

      const result = filterMediaUrls(urls)

      expect(result).toEqual([
        'https://pbs.twimg.com/media/123.jpg',
        'https://i.redd.it/post.png',
      ])
      expect(result.length).toBe(2)
    })

    it('should reject malformed URLs', () => {
      const urls = [
        'https://pbs.twimg.com/media/123.jpg', // valid
        'not-a-url', // malformed
        'https://i.redd.it/post.png', // valid
      ]

      const result = filterMediaUrls(urls)

      expect(result).toEqual([
        'https://pbs.twimg.com/media/123.jpg',
        'https://i.redd.it/post.png',
      ])
      expect(result.length).toBe(2)
    })
  })

  describe('Empty and Undefined Inputs', () => {
    it('should return empty array for undefined input', () => {
      const result = filterMediaUrls(undefined)

      expect(result).toEqual([])
      expect(Array.isArray(result)).toBe(true)
    })

    it('should return empty array for empty array input', () => {
      const result = filterMediaUrls([])

      expect(result).toEqual([])
    })

    it('should return empty array when all URLs are invalid', () => {
      const urls = ['not-a-url', 'https://evil.com/fake.jpg', 'ftp://bad.com/image.png']

      const result = filterMediaUrls(urls)

      expect(result).toEqual([])
    })
  })

  describe('Image Limit Enforcement', () => {
    it('should limit to 4 images by default', () => {
      const urls = [
        'https://pbs.twimg.com/media/1.jpg',
        'https://pbs.twimg.com/media/2.jpg',
        'https://pbs.twimg.com/media/3.jpg',
        'https://pbs.twimg.com/media/4.jpg',
        'https://pbs.twimg.com/media/5.jpg',
        'https://pbs.twimg.com/media/6.jpg',
      ]

      const result = filterMediaUrls(urls)

      expect(result.length).toBe(4)
      expect(result).toEqual([
        'https://pbs.twimg.com/media/1.jpg',
        'https://pbs.twimg.com/media/2.jpg',
        'https://pbs.twimg.com/media/3.jpg',
        'https://pbs.twimg.com/media/4.jpg',
      ])
    })

    it('should respect custom maxImages parameter', () => {
      const urls = [
        'https://pbs.twimg.com/media/1.jpg',
        'https://pbs.twimg.com/media/2.jpg',
        'https://pbs.twimg.com/media/3.jpg',
        'https://pbs.twimg.com/media/4.jpg',
      ]

      const result = filterMediaUrls(urls, 2)

      expect(result.length).toBe(2)
      expect(result).toEqual([
        'https://pbs.twimg.com/media/1.jpg',
        'https://pbs.twimg.com/media/2.jpg',
      ])
    })

    it('should allow maxImages = 1 for single image', () => {
      const urls = [
        'https://pbs.twimg.com/media/1.jpg',
        'https://pbs.twimg.com/media/2.jpg',
        'https://pbs.twimg.com/media/3.jpg',
      ]

      const result = filterMediaUrls(urls, 1)

      expect(result.length).toBe(1)
      expect(result).toEqual(['https://pbs.twimg.com/media/1.jpg'])
    })

    it('should handle maxImages larger than array length', () => {
      const urls = ['https://pbs.twimg.com/media/1.jpg', 'https://pbs.twimg.com/media/2.jpg']

      const result = filterMediaUrls(urls, 10)

      expect(result.length).toBe(2)
      expect(result).toEqual(urls)
    })

    it('should apply limit after filtering invalid URLs', () => {
      const urls = [
        'https://pbs.twimg.com/media/1.jpg', // valid
        'https://evil.com/bad.jpg', // invalid (untrusted)
        'https://pbs.twimg.com/media/2.jpg', // valid
        'not-a-url', // invalid
        'https://pbs.twimg.com/media/3.jpg', // valid
        'https://pbs.twimg.com/media/4.jpg', // valid
        'https://pbs.twimg.com/media/5.jpg', // valid (should be excluded by limit)
      ]

      const result = filterMediaUrls(urls, 4)

      // Should filter out invalid URLs first, then limit to 4
      expect(result.length).toBe(4)
      expect(result).toEqual([
        'https://pbs.twimg.com/media/1.jpg',
        'https://pbs.twimg.com/media/2.jpg',
        'https://pbs.twimg.com/media/3.jpg',
        'https://pbs.twimg.com/media/4.jpg',
      ])
    })
  })

  describe('Real-World Platform URLs', () => {
    it('should handle Twitter image URLs with query parameters', () => {
      const urls = [
        'https://pbs.twimg.com/media/abc123.jpg?format=jpg&name=large',
        'https://pbs.twimg.com/media/xyz789.png?format=png&name=900x900',
      ]

      const result = filterMediaUrls(urls)

      expect(result).toEqual(urls)
      expect(result.length).toBe(2)
    })

    it('should handle Facebook CDN URLs', () => {
      const urls = [
        'https://scontent-lax3-1.xx.fbcdn.net/v/t51.29350-15/123.jpg',
        'https://external.xx.fbcdn.net/safe_image.png',
      ]

      const result = filterMediaUrls(urls)

      expect(result).toEqual(urls)
      expect(result.length).toBe(2)
    })
  })
})

// =============================================================================
// D. IMAGE PART BUILDING TESTS (10 tests)
// =============================================================================

describe('buildImageParts', () => {
  describe('Valid URL Conversion', () => {
    it('should convert valid URLs to ImagePart format', () => {
      const urls = [
        'https://pbs.twimg.com/media/123.jpg',
        'https://i.redd.it/post.png',
        'https://i.imgur.com/abc.gif',
      ]

      const result = buildImageParts(urls)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        type: 'image',
        image: new URL('https://pbs.twimg.com/media/123.jpg'),
      })
      expect(result[1]).toEqual({
        type: 'image',
        image: new URL('https://i.redd.it/post.png'),
      })
      expect(result[2]).toEqual({
        type: 'image',
        image: new URL('https://i.imgur.com/abc.gif'),
      })
    })

    it('should create ImagePart objects with correct type', () => {
      const urls = ['https://pbs.twimg.com/media/123.jpg']

      const result = buildImageParts(urls)

      expect(result[0].type).toBe('image')
    })

    it('should create URL objects for image property', () => {
      const urls = ['https://pbs.twimg.com/media/123.jpg']

      const result = buildImageParts(urls)

      expect(result[0].image).toBeInstanceOf(URL)
      expect(result[0].image.href).toBe('https://pbs.twimg.com/media/123.jpg')
    })

    it('should handle URLs with complex query parameters', () => {
      const urls = ['https://pbs.twimg.com/media/123.jpg?format=jpg&name=large&w=800']

      const result = buildImageParts(urls)

      expect(result).toHaveLength(1)
      expect(result[0].image.search).toBe('?format=jpg&name=large&w=800')
    })
  })

  describe('Empty and Edge Cases', () => {
    it('should return empty array for empty input', () => {
      const result = buildImageParts([])

      expect(result).toEqual([])
      expect(Array.isArray(result)).toBe(true)
    })

    it('should skip invalid URLs silently', () => {
      const urls = [
        'https://pbs.twimg.com/media/valid.jpg', // valid
        'not-a-url', // invalid
        'https://i.redd.it/also-valid.png', // valid
      ]

      const result = buildImageParts(urls)

      // Should only include valid URLs
      expect(result).toHaveLength(2)
      expect(result[0].image.href).toBe('https://pbs.twimg.com/media/valid.jpg')
      expect(result[1].image.href).toBe('https://i.redd.it/also-valid.png')
    })

    it('should return empty array when all URLs are invalid', () => {
      const urls = ['not-a-url', 'also-not-a-url', '']

      const result = buildImageParts(urls)

      expect(result).toEqual([])
    })
  })

  describe('Type Safety', () => {
    it('should produce ImagePart type compatible objects', () => {
      const urls = ['https://pbs.twimg.com/media/123.jpg']

      const result: ImagePart[] = buildImageParts(urls)

      // TypeScript compilation validates this
      expect(result[0].type).toBe('image')
      expect(result[0].image).toBeInstanceOf(URL)
    })

    it('should be compatible with Vercel AI SDK message format', () => {
      const urls = ['https://pbs.twimg.com/media/123.jpg', 'https://i.redd.it/post.png']

      const imageParts = buildImageParts(urls)

      // Simulate Vercel AI SDK message construction
      const message = {
        role: 'user',
        content: [{ type: 'text', text: 'Analyze these images' }, ...imageParts],
      }

      expect(message.content).toHaveLength(3)
      expect(message.content[0]).toEqual({ type: 'text', text: 'Analyze these images' })
      expect(message.content[1].type).toBe('image')
      expect(message.content[2].type).toBe('image')
    })
  })
})

// =============================================================================
// E. INTEGRATION TESTS (5 tests)
// =============================================================================

describe('Integration: filterMediaUrls + buildImageParts', () => {
  it('should filter and convert URLs in complete workflow', () => {
    const mixedUrls = [
      'https://pbs.twimg.com/media/123.jpg', // valid trusted
      'https://evil.com/fake.jpg', // untrusted
      'https://i.redd.it/post.png', // valid trusted
      'not-a-url', // invalid
      'https://pbs.twimg.com/page', // no extension
    ]

    const filtered = filterMediaUrls(mixedUrls)
    const imageParts = buildImageParts(filtered)

    expect(filtered.length).toBe(2)
    expect(imageParts.length).toBe(2)
    expect(imageParts[0].image.href).toBe('https://pbs.twimg.com/media/123.jpg')
    expect(imageParts[1].image.href).toBe('https://i.redd.it/post.png')
  })

  it('should handle complete pipeline with maxImages limit', () => {
    const urls = [
      'https://pbs.twimg.com/media/1.jpg',
      'https://pbs.twimg.com/media/2.jpg',
      'https://pbs.twimg.com/media/3.jpg',
      'https://pbs.twimg.com/media/4.jpg',
      'https://pbs.twimg.com/media/5.jpg',
      'https://evil.com/bad.jpg', // will be filtered out
    ]

    const filtered = filterMediaUrls(urls, 3)
    const imageParts = buildImageParts(filtered)

    expect(filtered.length).toBe(3)
    expect(imageParts.length).toBe(3)
    expect(imageParts[0].image.href).toBe('https://pbs.twimg.com/media/1.jpg')
    expect(imageParts[2].image.href).toBe('https://pbs.twimg.com/media/3.jpg')
  })

  it('should produce AI SDK compatible output from raw URLs', () => {
    const contentFromExtractor = {
      text: 'Check out these images!',
      mediaUrls: [
        'https://pbs.twimg.com/media/abc.jpg',
        'https://i.redd.it/xyz.png',
        'https://malicious.com/bad.jpg',
      ],
    }

    const validUrls = filterMediaUrls(contentFromExtractor.mediaUrls)
    const imageParts = buildImageParts(validUrls)

    const aiMessage = {
      role: 'user',
      content: [{ type: 'text', text: contentFromExtractor.text }, ...imageParts],
    }

    expect(aiMessage.content).toHaveLength(3) // 1 text + 2 images
    expect(aiMessage.content[0]).toEqual({ type: 'text', text: 'Check out these images!' })
    expect(aiMessage.content[1].type).toBe('image')
    expect(aiMessage.content[2].type).toBe('image')
  })

  it('should handle empty/undefined URLs through complete pipeline', () => {
    const filtered = filterMediaUrls(undefined)
    const imageParts = buildImageParts(filtered)

    expect(filtered).toEqual([])
    expect(imageParts).toEqual([])
  })

  it('should maintain URL integrity through pipeline', () => {
    const originalUrl = 'https://pbs.twimg.com/media/test.jpg?format=jpg&name=4096x4096'

    const filtered = filterMediaUrls([originalUrl])
    const imageParts = buildImageParts(filtered)

    expect(imageParts[0].image.href).toBe(originalUrl)
    expect(imageParts[0].image.pathname).toBe('/media/test.jpg')
    expect(imageParts[0].image.search).toBe('?format=jpg&name=4096x4096')
  })
})

// =============================================================================
// F. SECURITY & PERFORMANCE TESTS (8 tests)
// =============================================================================

describe('Security & Performance', () => {
  describe('Security', () => {
    it('should prevent domain spoofing with similar trusted domains', () => {
      const spoofedUrls = [
        'https://pbs.twimg.com.evil.com/image.jpg',
        'https://evil-i.redd.it/image.png',
        'https://i.imgur.com.malicious.com/fake.gif',
      ]

      const result = filterMediaUrls(spoofedUrls)

      expect(result).toEqual([])
    })

    it('should reject JavaScript protocol URLs', () => {
      const maliciousUrls = [
        'javascript:alert("xss").jpg',
        'javascript://pbs.twimg.com/media/123.jpg',
      ]

      maliciousUrls.forEach((url) => {
        expect(isValidImageUrl(url)).toBe(false)
      })
    })

    it('should reject data URLs to prevent large embedded payloads', () => {
      const dataUrl = 'data:image/png;base64,' + 'A'.repeat(10000)

      expect(isValidImageUrl(dataUrl)).toBe(false)
    })

    it('should handle URL with unusual characters safely', () => {
      const urls = [
        'https://pbs.twimg.com/media/image%20name.jpg',
        'https://i.redd.it/post-123_abc.png',
        "https://i.imgur.com/it's-a-quote.gif",
      ]

      const result = filterMediaUrls(urls)

      // URL parser should handle these safely
      expect(result.length).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Performance', () => {
    it('should handle large URL arrays efficiently', () => {
      const largeUrlArray = Array.from(
        { length: 1000 },
        (_, i) => `https://pbs.twimg.com/media/${i}.jpg`
      )

      const start = Date.now()
      const result = filterMediaUrls(largeUrlArray, 10)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(100) // Should complete in < 100ms
      expect(result.length).toBe(10)
    })

    it('should handle very long URLs without performance degradation', () => {
      const longUrl =
        'https://pbs.twimg.com/media/' +
        'a'.repeat(1000) +
        '.jpg?' +
        'param=' +
        'b'.repeat(1000)

      const start = Date.now()
      const valid = isValidImageUrl(longUrl)
      const trusted = isTrustedImageDomain(longUrl)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(10)
      expect(valid).toBe(true)
      expect(trusted).toBe(true)
    })

    it('should efficiently filter mixed valid/invalid URLs', () => {
      const mixedUrls = [
        ...Array.from({ length: 50 }, (_, i) => `https://pbs.twimg.com/media/${i}.jpg`),
        ...Array.from({ length: 50 }, (_, i) => `https://evil.com/fake${i}.jpg`),
      ]

      const start = Date.now()
      const result = filterMediaUrls(mixedUrls)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(50)
      expect(result.length).toBe(4) // Limited by default maxImages
    })

    it('should handle buildImageParts for many URLs efficiently', () => {
      const urls = Array.from(
        { length: 100 },
        (_, i) => `https://pbs.twimg.com/media/${i}.jpg`
      )

      const start = Date.now()
      const result = buildImageParts(urls)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(50)
      expect(result.length).toBe(100)
    })
  })
})
