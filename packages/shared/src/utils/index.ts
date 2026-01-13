import type { ContentSource } from '../types'

/**
 * Detect the content source from a URL
 */
export function detectSource(url: string): ContentSource {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()

    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      return 'twitter'
    }
    if (hostname.includes('reddit.com')) {
      return 'reddit'
    }
    if (hostname.includes('linkedin.com')) {
      return 'linkedin'
    }
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      return 'youtube'
    }
    if (hostname.includes('instagram.com') || hostname.includes('instagr.am')) {
      return 'instagram'
    }
    return 'web'
  } catch {
    return 'web'
  }
}

/**
 * Extract all URLs from a text string
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return text.match(urlRegex) || []
}

/**
 * Format a date to a relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'just now'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours}h ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays}d ago`
  }

  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`
  }

  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`
  }

  const diffInYears = Math.floor(diffInDays / 365)
  return `${diffInYears}y ago`
}

/**
 * Format a date to a human-readable date string (e.g., "Dec 28, 2025")
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Extract YouTube video ID from a URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url)

    // Handle youtu.be short URLs
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1)
    }

    // Handle youtube.com URLs
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v')
    }

    return null
  } catch {
    return null
  }
}

/**
 * Extract Twitter/X post ID from a URL
 */
export function extractTwitterPostId(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')
    const statusIndex = pathParts.indexOf('status')

    if (statusIndex !== -1 && pathParts[statusIndex + 1]) {
      return pathParts[statusIndex + 1]
    }

    return null
  } catch {
    return null
  }
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
    }, delay)
  }
}

/**
 * Generate a human-readable fallback title from a URL.
 *
 * This is used when content extraction fails to provide a title.
 * Instead of showing "Untitled", we attempt to generate something
 * more meaningful from the URL itself.
 *
 * Examples:
 * - https://youtube.com/watch?v=abc123 -> "YouTube Video"
 * - https://x.com/elonmusk/status/123 -> "Post by @elonmusk"
 * - https://reddit.com/r/programming/... -> "Reddit: r/programming"
 * - https://example.com/blog/my-article -> "example.com: my-article"
 *
 * @param url - The URL to generate a title from
 * @param source - The detected content source
 * @returns A human-readable title
 */
export function generateFallbackTitle(url: string, source: ContentSource): string {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.replace('www.', '')
    const pathname = urlObj.pathname

    switch (source) {
      case 'youtube': {
        const videoId = extractYouTubeVideoId(url)
        if (videoId) {
          return `YouTube Video (${videoId})`
        }
        return 'YouTube Video'
      }

      case 'twitter': {
        // Extract username from path: /username/status/id
        const pathParts = pathname.split('/').filter(Boolean)
        if (pathParts.length >= 1 && pathParts[0]) {
          const username = pathParts[0]
          return `Post by @${username}`
        }
        return 'Twitter/X Post'
      }

      case 'reddit': {
        // Extract subreddit from path: /r/subreddit/...
        const match = pathname.match(/\/r\/([^/]+)/)
        if (match && match[1]) {
          const subreddit = match[1]
          return `Reddit: r/${subreddit}`
        }
        return 'Reddit Post'
      }

      case 'linkedin': {
        // Check if it's a post or article
        if (pathname.includes('/posts/')) {
          return 'LinkedIn Post'
        }
        if (pathname.includes('/pulse/')) {
          return 'LinkedIn Article'
        }
        return 'LinkedIn Content'
      }

      case 'instagram': {
        // Extract username from path: /username/ or /p/postid or /reel/reelid
        const pathParts = pathname.split('/').filter(Boolean)
        const isReel = pathname.includes('/reel/')
        const isPost = pathname.includes('/p/')

        // Try to find username
        if (pathParts.length >= 1) {
          const firstPart = pathParts[0]
          // Skip if it's a content type path
          if (firstPart && !['p', 'reel', 'stories', 'tv', 'explore'].includes(firstPart)) {
            const contentType = isReel ? 'Reel' : isPost ? 'Post' : 'Content'
            return `Instagram ${contentType} by @${firstPart}`
          }
        }

        // Fallback based on content type
        if (isReel) return 'Instagram Reel'
        if (isPost) return 'Instagram Post'
        return 'Instagram Content'
      }

      case 'web':
      default: {
        // Try to extract something meaningful from the path
        const pathSegments = pathname.split('/').filter(Boolean)
        if (pathSegments.length > 0) {
          // Get the last meaningful segment
          const lastSegment = pathSegments[pathSegments.length - 1]
          if (lastSegment) {
            // Clean up the segment: remove extension, convert dashes/underscores to spaces
            const cleaned = lastSegment
              .replace(/\.[^.]+$/, '') // Remove file extension
              .replace(/[-_]/g, ' ') // Convert dashes and underscores to spaces
              .replace(/\s+/g, ' ') // Normalize whitespace
              .trim()

            if (cleaned.length > 0 && cleaned.length <= 60) {
              // Capitalize first letter of each word
              const titleCase = cleaned
                .split(' ')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
              return `${hostname}: ${titleCase}`
            }
          }
        }
        // Fallback to just the hostname
        return `Link from ${hostname}`
      }
    }
  } catch {
    // If URL parsing fails, return a generic title
    return 'Saved Link'
  }
}

/**
 * Check if a title needs regeneration (is empty, generic, or matches the URL)
 *
 * @param title - The current title
 * @param url - The bookmark URL
 * @returns True if the title should be regenerated
 */
export function isTitleBad(title: string | null | undefined, url: string): boolean {
  if (!title) return true
  const trimmed = title.trim()
  const lowerTrimmed = trimmed.toLowerCase()

  // Check for empty or "Untitled"
  if (trimmed === '' || lowerTrimmed === 'untitled') {
    return true
  }

  // Check if title is just the URL
  if (trimmed === url) {
    return true
  }

  // Check for generic platform names that indicate failed extraction
  const genericTitles = ['instagram', 'twitter', 'reddit', 'linkedin', 'youtube']
  if (genericTitles.includes(lowerTrimmed)) {
    return true
  }

  // Check for standalone Instagram content type titles (without author info)
  // These are generic fallback titles that should be regenerated
  const standaloneInstagramTitles = [
    'instagram reel',
    'instagram post',
    'instagram story',
    'instagram content',
    'instagram video',
    'instagram photo',
  ]
  if (standaloneInstagramTitles.includes(lowerTrimmed)) {
    return true
  }

  // Check for Instagram-specific generic patterns
  // Only mark as bad if the title is JUST platform boilerplate without actual content
  const instagramGenericPatterns = [
    /follow on instagram$/i, // "... Follow on Instagram" (at end = no content)
    /^instagram photo by/i, // "Instagram photo by ..." (starts with = no content)
    /^instagram video by/i, // "Instagram video by ..."
    /^instagram reel by/i, // "Instagram Reel by ..."
    /^instagram post by/i, // "Instagram post by ..."
    /on instagram$/i, // "Username on Instagram" (ends with = no content after)
    /on instagram: ?$/i, // "Username on Instagram:" (empty after colon)
    /on instagram: ?"?"?$/i, // "Username on Instagram: "" (empty quotes)
  ]
  if (instagramGenericPatterns.some((pattern) => pattern.test(trimmed))) {
    return true
  }

  // Special case: "Username on Instagram: Caption" - this is GOOD if there's actual content after
  // Only mark as bad if the content after colon is too short (< 10 chars) or missing
  const onInstagramMatch = trimmed.match(/on instagram:\s*[""]?(.*)[""]?$/i)
  if (onInstagramMatch) {
    const captionPart = onInstagramMatch[1]?.replace(/[""]$/g, '').trim() || ''
    if (captionPart.length < 10) {
      return true // Too short to be meaningful
    }
    // Has meaningful content - this is a good title
    return false
  }

  // Check if title is just a domain
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.replace('www.', '')
    if (trimmed === hostname || trimmed === urlObj.hostname) {
      return true
    }
  } catch {
    // Ignore URL parsing errors
  }

  return false
}
