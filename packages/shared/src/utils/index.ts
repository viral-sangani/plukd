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
