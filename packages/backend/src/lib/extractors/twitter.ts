import type { ExtractedContent } from '@plukd/shared'
import {
  getbyid,
  type TwitterMetadata,
  GopherApiError,
} from './gopher-client'

/**
 * Regular expression patterns for extracting media URLs from tweet content.
 *
 * Supported formats:
 * - https://pbs.twimg.com/media/[id].jpg
 * - https://pbs.twimg.com/media/[id].png
 * - https://pbs.twimg.com/media/[id].gif
 * - https://pbs.twimg.com/media/[id]?format=jpg (or other formats)
 * - https://pbs.twimg.com/amplify_video_thumb/[id]/img/[filename].jpg (video thumbnails)
 * - https://pbs.twimg.com/ext_tw_video_thumb/[id]/... (external video thumbnails)
 * - https://pbs.twimg.com/tweet_video_thumb/[id].jpg (tweet video thumbnails)
 * - https://video.twimg.com/...
 */
const TWITTER_MEDIA_PATTERNS = [
  // pbs.twimg.com images with extension
  /https?:\/\/pbs\.twimg\.com\/media\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|gif)/gi,
  // pbs.twimg.com images with format query param
  /https?:\/\/pbs\.twimg\.com\/media\/[A-Za-z0-9_-]+\?format=(?:jpg|jpeg|png|gif|webp)(?:&[^\s]*)*/gi,
  // pbs.twimg.com amplify video thumbnails (e.g., /amplify_video_thumb/2005058551224705024/img/MB_ntcZ5Yo8tCmtl.jpg)
  /https?:\/\/pbs\.twimg\.com\/amplify_video_thumb\/\d+\/img\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png)/gi,
  // pbs.twimg.com external video thumbnails (e.g., /ext_tw_video_thumb/...)
  /https?:\/\/pbs\.twimg\.com\/ext_tw_video_thumb\/[^\s]+\.(?:jpg|jpeg|png)/gi,
  // pbs.twimg.com tweet video thumbnails (e.g., /tweet_video_thumb/[id].jpg)
  /https?:\/\/pbs\.twimg\.com\/tweet_video_thumb\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|gif)/gi,
  // video.twimg.com videos
  /https?:\/\/video\.twimg\.com\/[^\s]+/gi,
]

/**
 * Extract media URLs from tweet content.
 *
 * Searches for Twitter media URLs (images and videos) embedded in the content
 * and returns them as an array. Also returns the cleaned content with media URLs removed.
 *
 * @param content - The raw tweet content
 * @returns Object containing extracted media URLs and cleaned content
 */
export function extractMediaUrls(content: string): {
  mediaUrls: string[]
  cleanedContent: string
} {
  const mediaUrls: string[] = []
  let cleanedContent = content

  for (const pattern of TWITTER_MEDIA_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0
    const matches = content.match(pattern)
    if (matches) {
      for (const match of matches) {
        // Avoid duplicates
        if (!mediaUrls.includes(match)) {
          mediaUrls.push(match)
        }
        // Remove the URL from content (and any trailing whitespace)
        cleanedContent = cleanedContent.replace(match, '')
      }
    }
  }

  // Clean up extra whitespace left behind after removing URLs
  cleanedContent = cleanedContent.replace(/\s+/g, ' ').trim()

  return { mediaUrls, cleanedContent }
}

/**
 * Regular expression patterns for extracting tweet IDs from various Twitter/X URL formats.
 *
 * Supported formats:
 * - https://x.com/username/status/123456789
 * - https://twitter.com/username/status/123456789
 * - https://www.x.com/username/status/123456789
 * - https://www.twitter.com/username/status/123456789
 * - https://mobile.twitter.com/username/status/123456789
 */
const TWITTER_URL_PATTERNS = [
  // x.com format
  /^https?:\/\/(?:www\.)?x\.com\/([^/]+)\/status\/(\d+)/i,
  // twitter.com format
  /^https?:\/\/(?:www\.|mobile\.)?twitter\.com\/([^/]+)\/status\/(\d+)/i,
]

/**
 * Extract tweet ID from a Twitter/X URL.
 *
 * @param url - The Twitter/X URL
 * @returns An object containing the tweet ID and username, or null if not a valid Twitter URL
 */
export function extractTweetId(url: string): { tweetId: string; username: string } | null {
  for (const pattern of TWITTER_URL_PATTERNS) {
    const match = url.match(pattern)
    if (match) {
      return {
        username: match[1],
        tweetId: match[2],
      }
    }
  }
  return null
}

/**
 * Truncate text to a maximum length, adding ellipsis if truncated.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Generate a title for a tweet.
 *
 * Uses the tweet text truncated to 80 characters, or falls back to "Author on Twitter".
 *
 * @param content - The tweet text content
 * @param username - The tweet author's username
 * @returns A suitable title for the tweet
 */
function generateTitle(content: string, username: string): string {
  const truncatedContent = truncateText(content.trim(), 80)
  if (truncatedContent.length > 0) {
    return truncatedContent
  }
  return `@${username} on Twitter`
}

/**
 * Extract content from a Twitter/X post URL.
 *
 * Fetches tweet data from the Gopher API using the getbyid operation
 * and transforms it into the ExtractedContent format.
 *
 * @param url - The Twitter/X post URL
 * @returns Extracted content from the tweet
 * @throws Error if the URL format is invalid or tweet cannot be found
 *
 * @example
 * const content = await extractTwitterContent('https://x.com/username/status/123456789')
 * console.log(content.title, content.engagement?.likes)
 */
export async function extractTwitterContent(url: string): Promise<ExtractedContent> {
  // Extract tweet ID from URL
  const tweetInfo = extractTweetId(url)
  if (!tweetInfo) {
    throw new Error(`Invalid Twitter/X URL format: ${url}`)
  }

  const { tweetId, username: urlUsername } = tweetInfo

  // Fetch tweet data from Gopher API using getbyid operation
  const response = await getbyid('twitter', tweetId)

  if (!response) {
    throw new GopherApiError(`Tweet not found: ${tweetId}`)
  }

  // Extract metadata with safe defaults
  const metadata: TwitterMetadata = response.metadata
  const rawContent = response.content || ''
  const username = metadata?.username || urlUsername

  // Extract media URLs from content and get cleaned text
  const { mediaUrls, cleanedContent } = extractMediaUrls(rawContent)
  const content = cleanedContent

  // Parse the published date from metadata
  let publishedAt: Date | undefined
  if (metadata?.created_at) {
    const parsed = new Date(metadata.created_at)
    if (!isNaN(parsed.getTime())) {
      publishedAt = parsed
    }
  }

  // Get engagement metrics from public_metrics or direct metadata fields
  const publicMetrics = metadata?.public_metrics
  const likes = publicMetrics?.like_count ?? metadata?.likes ?? 0
  const comments = publicMetrics?.reply_count ?? 0
  const shares = publicMetrics?.retweet_count ?? 0

  // Transform to ExtractedContent format
  const extractedContent: ExtractedContent = {
    url,
    source: 'twitter',
    title: generateTitle(content, username),
    author: `@${username}`,
    authorUrl: `https://x.com/${username}`,
    content,
    publishedAt,
    mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
    engagement: {
      likes,
      comments,
      shares,
    },
    rawMetadata: {
      id: response.id,
      source: response.source,
      ...metadata,
    },
  }

  return extractedContent
}
