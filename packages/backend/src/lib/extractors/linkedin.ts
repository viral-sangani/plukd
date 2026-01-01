import type { ExtractedContent } from '@plukd/shared'

/**
 * Extract content from a LinkedIn post URL.
 *
 * Note: LinkedIn has strict anti-scraping measures and requires authentication.
 * This is a placeholder that returns minimal content. Full implementation
 * will require a different approach (browser extension, manual entry, or API).
 *
 * @param url - The LinkedIn post URL
 * @returns Basic ExtractedContent with just the URL and source
 */
export async function extractLinkedInContent(url: string): Promise<ExtractedContent> {
  console.log('[extractors/linkedin] LinkedIn post extraction is not yet supported')
  console.log('[extractors/linkedin] LinkedIn requires authentication and has strict anti-scraping measures')

  return {
    url,
    source: 'linkedin',
    title: 'LinkedIn Post',
    content: '',
    rawMetadata: {
      extractionNote: 'LinkedIn extraction not yet implemented. Content must be added manually.',
    },
  }
}
