/**
 * Parallel AI Extract API Client
 *
 * Client for interacting with the Parallel AI Extract API to fetch
 * full content, titles, and publish dates from URLs.
 *
 * Uses the v1beta extract endpoint with search-extract-2025-10-10 beta feature.
 */

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
 * Extract content from a URL using the Parallel AI Extract API
 *
 * Makes a POST request to the extract endpoint with the specified URL
 * and returns the extracted content including title, full content,
 * and publish date.
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

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    console.log(`[parallel] Extracting content from: ${url}`)

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
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`[parallel] API request failed: HTTP ${response.status} - ${errorText}`)
      return null
    }

    const data = (await response.json()) as ParallelExtractResponse

    // Check for errors in the response
    if (data.errors && data.errors.length > 0) {
      const urlError = data.errors.find((e) => e.url === url)
      if (urlError) {
        console.error(`[parallel] Extraction error for ${url}: ${urlError.error}`)
        return null
      }
    }

    // Return the first result
    if (data.results && data.results.length > 0) {
      const result = data.results[0]
      console.log(
        `[parallel] Extracted content: title="${result.title || 'none'}", ` +
          `content_length=${result.full_content?.length ?? 0}`
      )
      return result
    }

    console.error(`[parallel] No results returned for ${url}`)
    return null
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[parallel] Request timed out for ${url}`)
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[parallel] Failed to extract content from ${url}: ${errorMessage}`)
    }
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}
