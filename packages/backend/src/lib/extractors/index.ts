import { detectSource } from '@plukd/shared'
import type { ExtractedContent } from '@plukd/shared'
import { extractTwitterContent } from './twitter'
import { extractRedditContent } from './reddit'
import { extractLinkedInContent } from './linkedin'
import { extractOGMetadata } from './og-metadata'

// Re-export the ExtractedContent type for convenience
export type { ExtractedContent } from '@plukd/shared'

// Re-export individual extractors
export { extractTwitterContent } from './twitter'
export { extractRedditContent } from './reddit'
export { extractLinkedInContent } from './linkedin'
export { extractOGMetadata } from './og-metadata'

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
      return extractTwitterContent(url)

    case 'reddit':
      return extractRedditContent(url)

    case 'linkedin':
      return extractLinkedInContent(url)

    case 'youtube':
      // YouTube extraction not yet implemented
      console.log('[extractors] YouTube extraction not yet supported')
      return null

    case 'web':
      // Generic web extraction using OG metadata
      return extractWebContent(url)

    default:
      console.log(`[extractors] Unknown source: ${source}`)
      return null
  }
}

/**
 * Extract content from a generic web URL using OG metadata
 *
 * Fetches the page and extracts Open Graph metadata, standard meta tags,
 * and the page title to create an ExtractedContent object.
 *
 * @param url - The web URL to extract content from
 * @returns Extracted content with OG metadata, or null if extraction fails
 */
async function extractWebContent(url: string): Promise<ExtractedContent | null> {
  console.log(`[extractors] Extracting web content from: ${url}`)

  const ogMetadata = await extractOGMetadata(url)

  if (!ogMetadata) {
    console.log(`[extractors] No OG metadata found for: ${url}`)
    return null
  }

  // Build ExtractedContent from OG metadata
  // Prefer OG title over page title, fall back to URL
  const title = ogMetadata.ogTitle || ogMetadata.pageTitle || url

  // Use OG description or meta description as content
  const content = ogMetadata.ogDescription || ogMetadata.metaDescription || ''

  // Use meta author if available
  const author = ogMetadata.metaAuthor

  // Collect media URLs if OG image is available
  const mediaUrls = ogMetadata.ogImage ? [ogMetadata.ogImage] : undefined

  return {
    url,
    source: 'web',
    title,
    content,
    author,
    mediaUrls,
    // Include OG metadata as top-level fields
    ogTitle: ogMetadata.ogTitle,
    ogDescription: ogMetadata.ogDescription,
    ogImage: ogMetadata.ogImage,
    ogSiteName: ogMetadata.ogSiteName,
    ogType: ogMetadata.ogType,
    metaDescription: ogMetadata.metaDescription,
    metaAuthor: ogMetadata.metaAuthor,
    metaKeywords: ogMetadata.metaKeywords,
    // Also store in rawMetadata for compatibility
    rawMetadata: {
      og: {
        title: ogMetadata.ogTitle,
        description: ogMetadata.ogDescription,
        image: ogMetadata.ogImage,
        siteName: ogMetadata.ogSiteName,
        type: ogMetadata.ogType,
      },
      web: {
        pageTitle: ogMetadata.pageTitle,
      },
    },
  }
}
