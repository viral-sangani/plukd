/**
 * Reddit Content Extractor
 *
 * Extracts content from Reddit posts using the Gopher API.
 * Handles various Reddit URL formats and transforms the response
 * into the ExtractedContent interface.
 */

import { fetchFromGopher, RedditResult, RedditMetadata } from './gopher-client'
import type { ExtractedContent } from '@plukd/shared'

/**
 * Reddit URL pattern regex
 * Matches:
 * - https://reddit.com/r/subreddit/comments/id/title
 * - https://www.reddit.com/r/subreddit/comments/id/title
 * - https://old.reddit.com/r/subreddit/comments/id/title
 */
const REDDIT_URL_PATTERN =
  /^https?:\/\/(?:www\.|old\.)?reddit\.com\/r\/[\w-]+\/comments\/[\w]+(?:\/[\w-]*)?/i

/**
 * Validates that a URL is a valid Reddit post URL
 *
 * @param url - The URL to validate
 * @returns True if the URL is a valid Reddit post URL
 */
export function isValidRedditUrl(url: string): boolean {
  return REDDIT_URL_PATTERN.test(url)
}

/**
 * Normalizes a Reddit URL to a standard format
 * Converts old.reddit.com and www.reddit.com to reddit.com
 *
 * @param url - The Reddit URL to normalize
 * @returns Normalized URL
 */
export function normalizeRedditUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    urlObj.hostname = 'reddit.com'
    return urlObj.toString()
  } catch {
    return url
  }
}

/**
 * Type guard to check if metadata indicates a post
 * Posts have a title field, comments do not
 */
function isPostMetadata(
  metadata: RedditMetadata & { dataType?: string }
): boolean {
  return metadata.dataType === 'post' || (metadata.title !== undefined && metadata.title !== '')
}

/**
 * Type guard to check if metadata indicates a comment
 */
function isCommentMetadata(
  metadata: RedditMetadata & { dataType?: string }
): boolean {
  return metadata.dataType === 'comment'
}

/** Maximum number of comment replies to include */
const MAX_REPLIES = 10

/** Minimum number of replies to include */
const MIN_REPLIES = 5

/**
 * Extracts content from a Reddit post URL
 *
 * Uses the Gopher API to fetch the post and top comments,
 * then transforms the response into the ExtractedContent interface.
 *
 * @param url - The Reddit post URL to extract content from
 * @returns Extracted content including post body and top comments
 * @throws Error if the URL is invalid or the API request fails
 */
export async function extractRedditContent(url: string): Promise<ExtractedContent> {
  if (!isValidRedditUrl(url)) {
    throw new Error(`Invalid Reddit URL: ${url}`)
  }

  const normalizedUrl = normalizeRedditUrl(url)

  // Use Gopher API to scrape the Reddit URL
  const items = await fetchFromGopher('reddit', { type: 'scrapeurls', urls: [normalizedUrl] })

  if (!items || items.length === 0) {
    throw new Error(`No content found for Reddit URL: ${url}`)
  }

  // Find the main post (first item with dataType: "post" or has a title)
  const postItem = items.find((item) =>
    isPostMetadata(item.metadata as RedditMetadata & { dataType?: string })
  )

  if (!postItem) {
    throw new Error(`No post found in Reddit response for URL: ${url}`)
  }

  const postMetadata = postItem.metadata

  // Extract comments (items with dataType: "comment"), limit to top 5-10
  const comments = items
    .filter((item): item is RedditResult =>
      isCommentMetadata(item.metadata as RedditMetadata & { dataType?: string })
    )
    .slice(0, MAX_REPLIES)
    .map((item) => item.metadata.body)

  // Ensure we have at least MIN_REPLIES if available
  const replies = comments.length >= MIN_REPLIES ? comments : comments.slice(0, comments.length)

  // Build author URL from username
  const authorUrl = postMetadata.username
    ? `https://reddit.com/u/${postMetadata.username}`
    : undefined

  // Parse published date if available
  const publishedAt = postMetadata.createdAt
    ? new Date(postMetadata.createdAt)
    : undefined

  return {
    url,
    source: 'reddit',
    title: postMetadata.title,
    content: postMetadata.body,
    author: postMetadata.username,
    authorUrl,
    publishedAt,
    replies,
    engagement: {
      likes: postMetadata.upVotes,
      comments: postMetadata.numberOfComments,
    },
    rawMetadata: {
      communityName: postMetadata.communityName,
      upVotes: postMetadata.upVotes,
      numberOfComments: postMetadata.numberOfComments,
    },
  }
}
