/**
 * Parallel AI Extract API Client
 *
 * Client for interacting with the Parallel AI Extract API to fetch
 * full content, titles, and publish dates from URLs.
 *
 * Uses the v1beta extract endpoint with search-extract-2025-10-10 beta feature.
 *
 * Features:
 * - Retry logic with exponential backoff for network errors and 5xx responses
 * - Configurable timeout and retry parameters
 */

/**
 * Log debug message only when DEBUG=true
 */
function debugLog(message: string): void {
  if (process.env.DEBUG === 'true') {
    console.log(message)
  }
}

/**
 * Result from a single URL extraction
 */
export interface ParallelExtractResult {
  url: string
  title: string
  full_content: string | null
  excerpts: string[] | null
  publish_date?: string
}

/**
 * Response from the Parallel AI Extract API
 */
export interface ParallelExtractResponse {
  extract_id: string
  results: ParallelExtractResult[]
  errors: { url: string; error: string }[]
}

/**
 * API endpoint for the Parallel AI Extract service
 */
const PARALLEL_API_URL = 'https://api.parallel.ai/v1beta/extract'

/**
 * Timeout for API requests in milliseconds
 */
const FETCH_TIMEOUT_MS = 30000

/**
 * Maximum number of retry attempts for failed requests
 */
const MAX_RETRIES = 2

/**
 * Base delay for exponential backoff in milliseconds
 */
const BASE_RETRY_DELAY_MS = 1000

/**
 * Determines if an error is retryable.
 * Retryable errors include:
 * - Network errors (fetch failures)
 * - 5xx server errors
 * - Timeout errors
 *
 * Non-retryable errors include:
 * - 4xx client errors (bad request, unauthorized, not found, etc.)
 *
 * @param error - The error or response status code
 * @returns true if the request should be retried
 */
export function isRetryableError(error: unknown): boolean {
  // Network errors and timeouts are retryable
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return true // Timeout - retryable
    }
    // Generic network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return true
    }
  }
  return false
}

/**
 * Determines if an HTTP status code is retryable.
 * 5xx errors are retryable, 4xx errors are not.
 *
 * @param statusCode - The HTTP status code
 * @returns true if the status code indicates a retryable error
 */
export function isRetryableStatusCode(statusCode: number): boolean {
  return statusCode >= 500 && statusCode < 600
}

/**
 * Calculates the delay for exponential backoff.
 *
 * @param attempt - The current retry attempt (0-indexed)
 * @param baseDelay - The base delay in milliseconds
 * @returns The delay in milliseconds with jitter
 */
export function calculateBackoffDelay(attempt: number, baseDelay: number = BASE_RETRY_DELAY_MS): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  // Add jitter (0-25% of the delay) to prevent thundering herd
  const jitter = exponentialDelay * Math.random() * 0.25
  return exponentialDelay + jitter
}

/**
 * Sleep for a specified duration
 *
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Makes a single API request to the Parallel AI Extract service.
 * This is the internal function that handles the actual HTTP request.
 *
 * @param url - The URL to extract content from
 * @param apiKey - The API key for authentication
 * @param signal - Abort signal for timeout handling
 * @returns Object containing either a result or error information
 */
async function makeExtractRequest(
  url: string,
  apiKey: string,
  signal: AbortSignal
): Promise<{
  result: ParallelExtractResult | null
  shouldRetry: boolean
  statusCode?: number
  errorMessage?: string
}> {
  const response = await fetch(PARALLEL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'parallel-beta': 'search-extract-2025-10-10',
    },
    body: JSON.stringify({
      urls: [url],
      objective:
        'Extract the main article content, key points, author name, important quotes, statistics, and actionable insights. Focus on the core message and valuable information worth saving for future reference.',
      full_content: true,
      excerpts: true,
      title: true,
      publish_date: true,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    const shouldRetry = isRetryableStatusCode(response.status)
    return {
      result: null,
      shouldRetry,
      statusCode: response.status,
      errorMessage: errorText,
    }
  }

  const data = (await response.json()) as ParallelExtractResponse

  // Check for errors in the response
  if (data.errors && data.errors.length > 0) {
    const urlError = data.errors.find((e) => e.url === url)
    if (urlError) {
      return {
        result: null,
        shouldRetry: false, // API-level errors are not retryable
        errorMessage: urlError.error,
      }
    }
  }

  // Return the first result
  if (data.results && data.results.length > 0) {
    return {
      result: data.results[0],
      shouldRetry: false,
    }
  }

  return {
    result: null,
    shouldRetry: false,
    errorMessage: 'No results returned',
  }
}

/**
 * Extract content from a URL using the Parallel AI Extract API
 *
 * Makes a POST request to the extract endpoint with the specified URL
 * and returns the extracted content including title, full content,
 * and publish date.
 *
 * Features:
 * - Automatic retry with exponential backoff for network errors and 5xx responses
 * - Detailed logging for debugging extraction issues
 * - Does not retry on 4xx client errors
 *
 * @param url - The URL to extract content from
 * @returns The extraction result, or null if extraction fails
 *
 * @example
 * ```typescript
 * const result = await extractWithParallel('https://example.com/article')
 * if (result) {
 *   console.log(result.title, result.full_content)
 * }
 * ```
 */
export async function extractWithParallel(url: string): Promise<ParallelExtractResult | null> {
  const apiKey = process.env.PARALLEL_API_KEY
  if (!apiKey) {
    console.error('[parallel] PARALLEL_API_KEY environment variable is not set')
    return null
  }

  debugLog(`[parallel] Extracting content from: ${url}`)

  let lastError: string | undefined
  let lastStatusCode: number | undefined

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      if (attempt > 0) {
        const delay = calculateBackoffDelay(attempt - 1)
        debugLog(`[parallel] Retry attempt ${attempt}/${MAX_RETRIES} after ${Math.round(delay)}ms delay`)
        await sleep(delay)
      }

      const { result, shouldRetry, statusCode, errorMessage } = await makeExtractRequest(
        url,
        apiKey,
        controller.signal
      )

      lastStatusCode = statusCode
      lastError = errorMessage

      if (result) {
        debugLog(`[parallel] Extraction successful: title="${result.title || 'none'}", content_length=${result.full_content?.length ?? 0}`)
        return result
      }

      if (!shouldRetry || attempt >= MAX_RETRIES) {
        // Log only on final failure
        const errorDetails = statusCode
          ? `HTTP ${statusCode} - ${errorMessage}`
          : errorMessage || 'No results returned'
        console.error(`[parallel] Extraction failed after retries: ${errorDetails}`)
        return null
      }

      debugLog(`[parallel] Request failed with HTTP ${statusCode}, will retry`)
    } catch (error) {
      clearTimeout(timeoutId)

      const errorMessage = error instanceof Error ? error.message : String(error)
      const isTimeout = error instanceof Error && error.name === 'AbortError'
      const shouldRetry = isRetryableError(error)

      lastError = isTimeout ? 'Request timed out' : errorMessage

      if (!shouldRetry || attempt >= MAX_RETRIES) {
        // Log only on final failure
        console.error(`[parallel] Extraction failed after retries: ${lastError}`)
        return null
      }

      debugLog(`[parallel] ${isTimeout ? 'Timeout' : 'Network error'} occurred, will retry`)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // This should not be reached, but just in case
  console.error(`[parallel] Extraction failed after retries: ${lastError}`)
  return null
}
