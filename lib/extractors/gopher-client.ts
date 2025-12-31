/**
 * Gopher API Client
 *
 * Client for interacting with the Gopher API to extract content from
 * social media platforms (Twitter/X, Reddit).
 *
 * Handles the async job workflow:
 * 1. POST to submit a search job
 * 2. Poll status endpoint until complete
 * 3. GET results when ready
 */

import { sleep } from '@/lib/utils'

// API configuration
const GOPHER_API_BASE_URL = 'https://data.gopher-ai.com'
const DEFAULT_POLL_INTERVAL_MS = 2000
const DEFAULT_TIMEOUT_MS = 120000

// Supported platforms
export type GopherPlatform = 'twitter' | 'reddit'

// Job status values returned by the API
type GopherJobStatus = 'done(saved)' | 'in progress'

// Submit job response
interface GopherSubmitResponse {
  uuid: string
  error?: string
}

// Status check response
interface GopherStatusResponse {
  status: GopherJobStatus
  error?: string
}

// Twitter-specific metadata
export interface TwitterPublicMetrics {
  like_count: number
  reply_count: number
  retweet_count: number
}

export interface TwitterMetadata {
  conversation_id: string
  created_at: string
  likes: number
  public_metrics: TwitterPublicMetrics
  tweet_id: number
  user_id: string
  username: string
}

export interface TwitterResult {
  id: string
  source: 'twitter'
  content: string
  metadata: TwitterMetadata
}

// Reddit-specific metadata
export interface RedditMetadata {
  title: string
  body: string
  communityName: string
  username: string
  upVotes: number
  numberOfComments: number
  createdAt: string
}

export interface RedditResult {
  id: string
  source: 'reddit'
  content: string
  metadata: RedditMetadata
}

// Union type for all result types
export type GopherResult = TwitterResult | RedditResult

// Twitter operation types
export type TwitterOperationType = 'getbyid' | 'search' | 'gettweets' | 'getreplies'

// Platform-specific request arguments
export interface TwitterSearchArgs {
  type: TwitterOperationType
  query: string
  max_results?: number
}

export interface RedditSearchArgs {
  type: 'scrapeurls'
  urls: string[]
}

// Union type for platform arguments
export type GopherSearchArgs = TwitterSearchArgs | RedditSearchArgs

// Options for the fetch function
export interface GopherFetchOptions {
  pollIntervalMs?: number
  timeoutMs?: number
}

// Error class for Gopher API errors
export class GopherApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly apiError?: string
  ) {
    super(message)
    this.name = 'GopherApiError'
  }
}

/**
 * Get the API key from environment variable
 */
function getApiKey(): string {
  const apiKey = process.env.GOPHER_API_KEY
  if (!apiKey) {
    throw new GopherApiError('GOPHER_API_KEY environment variable is not set')
  }
  return apiKey
}

/**
 * Create headers for API requests
 */
function createHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getApiKey()}`,
  }
}

/**
 * Submit a search job to the Gopher API
 *
 * API expects: { type: "twitter", arguments: { type: "getbyid", query: "id" } }
 */
async function submitJob(
  platform: GopherPlatform,
  args: GopherSearchArgs
): Promise<string> {
  const url = `${GOPHER_API_BASE_URL}/api/v1/search/live`

  // Build the correct API request structure
  const body = {
    type: platform,
    arguments: args,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new GopherApiError(
      `Failed to submit job: ${response.statusText}`,
      response.status
    )
  }

  const data: GopherSubmitResponse = await response.json()

  if (data.error) {
    throw new GopherApiError(`API error: ${data.error}`, undefined, data.error)
  }

  if (!data.uuid) {
    throw new GopherApiError('No UUID returned from job submission')
  }

  return data.uuid
}

/**
 * Check the status of a job
 */
async function checkJobStatus(uuid: string): Promise<GopherJobStatus> {
  const url = `${GOPHER_API_BASE_URL}/api/v1/search/live/status/${uuid}`

  const response = await fetch(url, {
    method: 'GET',
    headers: createHeaders(),
  })

  if (!response.ok) {
    throw new GopherApiError(
      `Failed to check job status: ${response.statusText}`,
      response.status
    )
  }

  const data: GopherStatusResponse = await response.json()

  if (data.error) {
    throw new GopherApiError(
      `Job status error: ${data.error}`,
      undefined,
      data.error
    )
  }

  return data.status
}

/**
 * Get the results of a completed job
 */
async function getJobResults<T extends GopherResult>(uuid: string): Promise<T[]> {
  const url = `${GOPHER_API_BASE_URL}/api/v1/search/live/result/${uuid}`

  const response = await fetch(url, {
    method: 'GET',
    headers: createHeaders(),
  })

  if (!response.ok) {
    throw new GopherApiError(
      `Failed to get job results: ${response.statusText}`,
      response.status
    )
  }

  const data: T[] = await response.json()
  return data
}

/**
 * Poll for job completion with timeout
 */
async function pollUntilComplete(
  uuid: string,
  pollIntervalMs: number,
  timeoutMs: number
): Promise<void> {
  const startTime = Date.now()

  while (true) {
    const elapsed = Date.now() - startTime
    if (elapsed >= timeoutMs) {
      throw new GopherApiError(
        `Job timed out after ${timeoutMs}ms (UUID: ${uuid})`
      )
    }

    const status = await checkJobStatus(uuid)

    if (status === 'done(saved)') {
      return
    }

    await sleep(pollIntervalMs)
  }
}

/**
 * Fetch data from Gopher API for Twitter
 *
 * Handles the full async workflow: submit job, poll for completion, get results
 */
export async function fetchFromGopher(
  platform: 'twitter',
  args: TwitterSearchArgs,
  options?: GopherFetchOptions
): Promise<TwitterResult[]>

/**
 * Fetch data from Gopher API for Reddit
 *
 * Handles the full async workflow: submit job, poll for completion, get results
 */
export async function fetchFromGopher(
  platform: 'reddit',
  args: RedditSearchArgs,
  options?: GopherFetchOptions
): Promise<RedditResult[]>

/**
 * Fetch data from Gopher API
 *
 * Handles the full async workflow:
 * 1. Submit a search job
 * 2. Poll for job completion
 * 3. Retrieve and return results
 *
 * @param platform - The platform to search ('twitter' or 'reddit')
 * @param args - Platform-specific search arguments
 * @param options - Optional configuration for polling and timeout
 * @returns Array of results from the search
 * @throws GopherApiError if the API returns an error or the job times out
 *
 * @example
 * // Fetch Twitter results
 * const tweets = await fetchFromGopher('twitter', {
 *   query: 'anthropic claude',
 *   max_results: 10
 * })
 *
 * @example
 * // Fetch Reddit post and comments
 * const redditData = await fetchFromGopher('reddit', {
 *   url: 'https://reddit.com/r/Anthropic/comments/...'
 * })
 */
export async function fetchFromGopher(
  platform: GopherPlatform,
  args: GopherSearchArgs,
  options: GopherFetchOptions = {}
): Promise<GopherResult[]> {
  const {
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options

  // Step 1: Submit the job
  const uuid = await submitJob(platform, args)

  // Step 2: Poll until complete
  await pollUntilComplete(uuid, pollIntervalMs, timeoutMs)

  // Step 3: Get and return results
  const results = await getJobResults(uuid)
  return results
}

/**
 * Type guard to check if a result is from Twitter
 */
export function isTwitterResult(result: GopherResult): result is TwitterResult {
  return result.source === 'twitter'
}

/**
 * Type guard to check if a result is from Reddit
 */
export function isRedditResult(result: GopherResult): result is RedditResult {
  return result.source === 'reddit'
}

/**
 * Fetch a single item by ID from the Gopher API
 *
 * This uses the search API with a specific ID query to fetch a single tweet or post.
 *
 * @param platform - The platform to fetch from ('twitter' or 'reddit')
 * @param id - The content ID (e.g., tweet ID)
 * @param options - Optional configuration for polling and timeout
 * @returns The result for the specified ID, or null if not found
 * @throws GopherApiError if the API returns an error or the job times out
 *
 * @example
 * // Fetch a tweet by ID
 * const tweet = await getbyid('twitter', '2005343559453651178')
 */
export async function getbyid(
  platform: 'twitter',
  id: string,
  options?: GopherFetchOptions
): Promise<TwitterResult | null>
export async function getbyid(
  platform: 'reddit',
  id: string,
  options?: GopherFetchOptions
): Promise<RedditResult | null>
export async function getbyid(
  platform: GopherPlatform,
  id: string,
  options: GopherFetchOptions = {}
): Promise<GopherResult | null> {
  // For Twitter, use getbyid operation type
  if (platform === 'twitter') {
    const results = await fetchFromGopher(
      'twitter',
      { type: 'getbyid', query: id },
      options
    )
    return results.length > 0 ? results[0] : null
  }

  // For Reddit, we would need a URL - this is a fallback
  // In practice, Reddit content should be fetched via fetchFromGopher with url arg
  throw new GopherApiError(
    `getbyid is not supported for platform: ${platform}. Use fetchFromGopher with a URL instead.`
  )
}
