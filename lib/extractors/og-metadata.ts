/**
 * Open Graph Metadata Extractor
 *
 * Fetches a URL and extracts Open Graph metadata (og:title, og:description,
 * og:image, og:site_name, og:type) as well as standard meta tags
 * (description, author, keywords).
 *
 * Designed to be called as part of the content extraction pipeline
 * for web URLs where platform-specific extractors are not available.
 */

/**
 * Structured result from OG metadata extraction
 */
export interface OGMetadata {
  // Open Graph metadata
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  ogSiteName?: string
  ogType?: string
  // Standard meta tags
  metaDescription?: string
  metaAuthor?: string
  metaKeywords?: string
  // Page title from <title> tag
  pageTitle?: string
}

/**
 * User agent string that mimics a modern browser to avoid bot detection
 */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Default headers for fetch requests
 */
const DEFAULT_HEADERS: HeadersInit = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  DNT: '1',
  Connection: 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
}

/**
 * Timeout for fetch requests in milliseconds
 */
const FETCH_TIMEOUT_MS = 10000

/**
 * Maximum HTML size to process (5MB)
 */
const MAX_HTML_SIZE = 5 * 1024 * 1024

/**
 * Extract the content of a meta tag by name or property attribute
 *
 * @param html - The HTML string to search in
 * @param attribute - The attribute name to match (name or property)
 * @param value - The value of the attribute to match
 * @returns The content attribute value or undefined
 */
function extractMetaContent(html: string, attribute: 'name' | 'property', value: string): string | undefined {
  // Match meta tags with the specified attribute
  // Handles various formats: <meta property="og:title" content="...">
  // and <meta content="..." property="og:title">
  const patterns = [
    // property/name comes before content
    new RegExp(
      `<meta\\s+${attribute}=["']${value}["']\\s+content=["']([^"']*?)["']`,
      'i'
    ),
    // content comes before property/name
    new RegExp(
      `<meta\\s+content=["']([^"']*?)["']\\s+${attribute}=["']${value}["']`,
      'i'
    ),
    // Handle attributes with spaces and other attributes in between
    new RegExp(
      `<meta\\s+[^>]*${attribute}=["']${value}["'][^>]*content=["']([^"']*?)["']`,
      'i'
    ),
    new RegExp(
      `<meta\\s+[^>]*content=["']([^"']*?)["'][^>]*${attribute}=["']${value}["']`,
      'i'
    ),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match && match[1]) {
      return decodeHTMLEntities(match[1].trim())
    }
  }

  return undefined
}

/**
 * Extract the page title from the <title> tag
 *
 * @param html - The HTML string to search in
 * @returns The title text or undefined
 */
function extractPageTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  if (match && match[1]) {
    return decodeHTMLEntities(match[1].trim())
  }
  return undefined
}

/**
 * Decode common HTML entities
 *
 * @param text - Text that may contain HTML entities
 * @returns Decoded text
 */
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
}

/**
 * Fetch HTML content from a URL with timeout and size limits
 *
 * @param url - The URL to fetch
 * @returns The HTML content as a string
 * @throws Error if fetch fails, times out, or content is too large
 */
async function fetchHTML(url: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // Check content type
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error(`Unexpected content type: ${contentType}`)
    }

    // Check content length if available
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_HTML_SIZE) {
      throw new Error(`Content too large: ${contentLength} bytes`)
    }

    const html = await response.text()

    // Final size check
    if (html.length > MAX_HTML_SIZE) {
      throw new Error(`Content too large: ${html.length} bytes`)
    }

    return html
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Extract Open Graph and standard meta tag metadata from a URL
 *
 * Fetches the URL and parses the HTML to extract:
 * - Open Graph metadata (og:title, og:description, og:image, og:site_name, og:type)
 * - Standard meta tags (description, author, keywords)
 * - Page title from <title> tag
 *
 * Uses browser-like headers to avoid bot detection. Handles errors gracefully
 * and returns partial results if some metadata is unavailable.
 *
 * @param url - The URL to extract metadata from
 * @returns Extracted metadata object, or null if extraction completely fails
 *
 * @example
 * ```typescript
 * const metadata = await extractOGMetadata('https://example.com/article')
 * if (metadata) {
 *   console.log(metadata.ogTitle, metadata.ogDescription)
 * }
 * ```
 */
export async function extractOGMetadata(url: string): Promise<OGMetadata | null> {
  try {
    console.log(`[og-metadata] Extracting metadata from: ${url}`)

    const html = await fetchHTML(url)

    const metadata: OGMetadata = {}

    // Extract Open Graph metadata
    metadata.ogTitle = extractMetaContent(html, 'property', 'og:title')
    metadata.ogDescription = extractMetaContent(html, 'property', 'og:description')
    metadata.ogImage = extractMetaContent(html, 'property', 'og:image')
    metadata.ogSiteName = extractMetaContent(html, 'property', 'og:site_name')
    metadata.ogType = extractMetaContent(html, 'property', 'og:type')

    // Extract standard meta tags
    metadata.metaDescription = extractMetaContent(html, 'name', 'description')
    metadata.metaAuthor = extractMetaContent(html, 'name', 'author')
    metadata.metaKeywords = extractMetaContent(html, 'name', 'keywords')

    // Extract page title
    metadata.pageTitle = extractPageTitle(html)

    // Clean up undefined values
    const cleanedMetadata: OGMetadata = {}
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined) {
        cleanedMetadata[key as keyof OGMetadata] = value
      }
    }

    // Return null if no metadata was found
    if (Object.keys(cleanedMetadata).length === 0) {
      console.log(`[og-metadata] No metadata found for: ${url}`)
      return null
    }

    console.log(
      `[og-metadata] Extracted metadata: title="${cleanedMetadata.ogTitle || cleanedMetadata.pageTitle || 'none'}"`
    )

    return cleanedMetadata
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[og-metadata] Failed to extract metadata from ${url}: ${errorMessage}`)
    return null
  }
}

/**
 * Merge OG metadata into raw metadata object
 *
 * Creates a new raw metadata object with OG metadata included,
 * preserving any existing metadata.
 *
 * @param existingMetadata - Existing raw metadata (may be null/undefined)
 * @param ogMetadata - OG metadata to merge
 * @returns Merged metadata object
 */
export function mergeOGMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  ogMetadata: OGMetadata | null
): Record<string, unknown> {
  const merged: Record<string, unknown> = existingMetadata ? { ...existingMetadata } : {}

  if (ogMetadata) {
    merged.ogMetadata = ogMetadata
  }

  return merged
}
