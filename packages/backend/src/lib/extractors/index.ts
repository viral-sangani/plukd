import { detectSource } from '@plukd/shared'
import type { ContentSource, ExtractedContent } from '@plukd/shared'
import { extractTwitterContent } from './twitter'
import { extractOGMetadata } from './og-metadata'
import { extractWithParallel } from './parallel-client'

// Re-export the ExtractedContent type for convenience
export type { ExtractedContent } from '@plukd/shared'

// Re-export individual extractors
export { extractTwitterContent } from './twitter'
export { extractOGMetadata } from './og-metadata'
export { extractWithParallel } from './parallel-client'

/**
 * Extract content using the Parallel AI extractor
 *
 * Calls the Parallel API to extract content from URLs and transforms
 * the response into the ExtractedContent interface.
 *
 * @param url - The URL to extract content from
 * @param source - The content source type (reddit, linkedin, web, etc.)
 * @returns Extracted content or null if extraction fails
 */
async function extractWithParallelAI(
  url: string,
  source: ContentSource
): Promise<ExtractedContent | null> {
  console.log(`[extractors] Extracting ${source} content with Parallel AI: ${url}`)

  const result = await extractWithParallel(url)

  if (!result) {
    console.log(`[extractors] Parallel AI returned no content for: ${url}`)
    return null
  }

  // Build content from full_content or excerpts
  const content = result.full_content || (result.excerpts?.join('\n\n') ?? '')

  // Parse published date if available
  const publishedAt = result.publish_date ? new Date(result.publish_date) : undefined

  return {
    url,
    source,
    title: result.title || url,
    content,
    publishedAt,
    rawMetadata: {
      excerpts: result.excerpts,
    },
  }
}

/**
 * Extract content from a URL by detecting the platform and routing
 * to the appropriate extractor.
 *
 * @param url - The URL to extract content from
 * @returns Extracted content or null if the platform is not supported
 */
export async function extractContent(url: string): Promise<ExtractedContent | null> {
  const source = detectSource(url)

  switch (source) {
    case 'twitter':
      // Twitter uses existing Gopher API extractor
      return extractTwitterContent(url)

    case 'youtube':
      // YouTube extraction not supported - skip entirely
      console.log('[extractors] YouTube extraction not supported, skipping')
      return null

    case 'reddit':
    case 'linkedin':
    case 'web':
      // Reddit, LinkedIn, and web use Parallel AI extractor
      return extractWithParallelAI(url, source)

    default:
      console.log(`[extractors] Unknown source: ${source}`)
      return null
  }
}
