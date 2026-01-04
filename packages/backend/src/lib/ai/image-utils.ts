/**
 * Image utilities for multimodal AI processing.
 *
 * Provides validation, filtering, and transformation functions for image URLs
 * before passing them to AI models via the Vercel AI SDK.
 */

/**
 * Common image file extensions that AI models can process.
 */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'] as const

/**
 * Trusted domains for image content.
 * These are CDN domains from popular social platforms that serve user-uploaded images.
 */
const TRUSTED_IMAGE_DOMAINS = [
  // Twitter/X
  'pbs.twimg.com',
  'video.twimg.com',
  // Reddit
  'i.redd.it',
  'preview.redd.it',
  // Imgur
  'i.imgur.com',
  // Instagram/Facebook
  'scontent.cdninstagram.com',
  // Facebook CDN (wildcard match handled separately)
  'fbcdn.net',
] as const

/**
 * Check if a URL is a valid HTTP/HTTPS URL pointing to an image.
 *
 * Validates:
 * - URL is well-formed with http or https protocol
 * - URL path ends with a common image extension
 *
 * @param url - The URL string to validate
 * @returns True if the URL is a valid image URL, false otherwise
 *
 * @example
 * ```typescript
 * isValidImageUrl('https://example.com/image.png') // true
 * isValidImageUrl('https://example.com/page') // false
 * isValidImageUrl('ftp://example.com/image.png') // false
 * isValidImageUrl('not a url') // false
 * ```
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)

    // Must be HTTP or HTTPS
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false
    }

    // Check if pathname ends with an image extension
    const pathname = parsedUrl.pathname.toLowerCase()
    return IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext))
  } catch {
    // URL parsing failed
    return false
  }
}

/**
 * Check if a URL is from a trusted domain for image content.
 *
 * Trusted domains include CDNs from Twitter, Reddit, Imgur, Instagram, and Facebook.
 * Supports wildcard matching for *.fbcdn.net domains.
 *
 * @param url - The URL string to check
 * @returns True if the URL is from a trusted image domain, false otherwise
 *
 * @example
 * ```typescript
 * isTrustedImageDomain('https://pbs.twimg.com/media/123.jpg') // true
 * isTrustedImageDomain('https://i.redd.it/abc.png') // true
 * isTrustedImageDomain('https://scontent-lax3-1.xx.fbcdn.net/image.jpg') // true
 * isTrustedImageDomain('https://malicious-site.com/image.jpg') // false
 * ```
 */
export function isTrustedImageDomain(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname.toLowerCase()

    // Check exact domain matches
    if (
      TRUSTED_IMAGE_DOMAINS.some(
        (domain) => domain !== 'fbcdn.net' && hostname === domain
      )
    ) {
      return true
    }

    // Check wildcard match for *.fbcdn.net
    if (hostname === 'fbcdn.net' || hostname.endsWith('.fbcdn.net')) {
      return true
    }

    return false
  } catch {
    // URL parsing failed
    return false
  }
}

/**
 * Filter and validate image URLs for AI processing.
 *
 * Performs the following operations:
 * 1. Validates each URL is a proper image URL
 * 2. Checks each URL is from a trusted domain
 * 3. Limits the number of images to avoid token limits
 *
 * @param urls - Array of URL strings to filter (can be undefined)
 * @param maxImages - Maximum number of images to return (default: 4)
 * @returns Array of validated image URLs, empty array if input is undefined/empty
 *
 * @example
 * ```typescript
 * const urls = [
 *   'https://pbs.twimg.com/media/123.jpg',
 *   'https://malicious.com/fake.jpg',
 *   'https://i.redd.it/post.png',
 *   'not-a-url',
 * ]
 * filterMediaUrls(urls) // ['https://pbs.twimg.com/media/123.jpg', 'https://i.redd.it/post.png']
 * filterMediaUrls(undefined) // []
 * filterMediaUrls(urls, 1) // ['https://pbs.twimg.com/media/123.jpg']
 * ```
 */
export function filterMediaUrls(
  urls: string[] | undefined,
  maxImages: number = 4
): string[] {
  if (!urls || urls.length === 0) {
    return []
  }

  return urls
    .filter((url) => isValidImageUrl(url) && isTrustedImageDomain(url))
    .slice(0, maxImages)
}

/**
 * Image part type for Vercel AI SDK messages.
 */
export interface ImagePart {
  type: 'image'
  image: URL
}

/**
 * Convert validated image URLs to Vercel AI SDK image part format.
 *
 * Transforms URL strings into the format expected by the Vercel AI SDK
 * for multimodal messages. Invalid URLs are silently skipped.
 *
 * @param urls - Array of validated image URL strings
 * @returns Array of image parts ready for use in AI messages
 *
 * @example
 * ```typescript
 * const validUrls = filterMediaUrls(content.mediaUrls)
 * const imageParts = buildImageParts(validUrls)
 *
 * // Use in messages:
 * const messages = [
 *   {
 *     role: 'user',
 *     content: [
 *       { type: 'text', text: promptText },
 *       ...imageParts,
 *     ],
 *   },
 * ]
 * ```
 */
export function buildImageParts(urls: string[]): ImagePart[] {
  const parts: ImagePart[] = []

  for (const url of urls) {
    try {
      parts.push({
        type: 'image',
        image: new URL(url),
      })
    } catch {
      // Skip invalid URLs silently - they should have been filtered already
      // but this provides an extra safety net
      continue
    }
  }

  return parts
}
