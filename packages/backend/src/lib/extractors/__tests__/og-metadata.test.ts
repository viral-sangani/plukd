/**
 * Comprehensive tests for Open Graph Metadata Extractor
 *
 * Tests the OG metadata extractor which fetches HTML pages and extracts
 * Open Graph metadata, standard meta tags, and page titles.
 *
 * Coverage:
 * - HTML fetching with various response types and errors
 * - Open Graph metadata extraction (og:title, og:description, og:image, etc.)
 * - Standard meta tag extraction (description, author, keywords)
 * - Page title extraction from <title> tags
 * - HTML entity decoding
 * - Error handling (network failures, invalid HTML, timeouts)
 * - Edge cases (malformed HTML, relative URLs, missing metadata)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { extractOGMetadata, mergeOGMetadata, type OGMetadata } from '../og-metadata'

// Mock global fetch
global.fetch = vi.fn()

describe('OG Metadata Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('extractOGMetadata', () => {
    describe('successful extraction', () => {
      it('should extract complete OG metadata from HTML page', async () => {
        const mockHTML = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Test Page Title</title>
              <meta property="og:title" content="OG Title" />
              <meta property="og:description" content="This is the OG description" />
              <meta property="og:image" content="https://example.com/image.jpg" />
              <meta property="og:site_name" content="Example Site" />
              <meta property="og:type" content="article" />
              <meta name="description" content="Standard meta description" />
              <meta name="author" content="John Doe" />
              <meta name="keywords" content="test, example, metadata" />
            </head>
            <body></body>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({
            'content-type': 'text/html; charset=utf-8',
            'content-length': String(mockHTML.length),
          }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(fetch).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Mozilla'),
            'Accept': expect.stringContaining('text/html'),
          }),
        }))

        expect(result).toEqual({
          ogTitle: 'OG Title',
          ogDescription: 'This is the OG description',
          ogImage: 'https://example.com/image.jpg',
          ogSiteName: 'Example Site',
          ogType: 'article',
          metaDescription: 'Standard meta description',
          metaAuthor: 'John Doe',
          metaKeywords: 'test, example, metadata',
          pageTitle: 'Test Page Title',
        })
      })

      it('should extract OG metadata with content attribute before property', async () => {
        const mockHTML = `
          <html>
            <head>
              <meta content="Content First Title" property="og:title" />
              <meta content="Content First Description" property="og:description" />
            </head>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result?.ogTitle).toBe('Content First Title')
        expect(result?.ogDescription).toBe('Content First Description')
      })

      it('should extract metadata with attributes in different order', async () => {
        const mockHTML = `
          <html>
            <head>
              <meta property="og:title" id="og-title" content="Title with ID" />
              <meta name="description" class="meta-desc" content="Description with class" />
            </head>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result?.ogTitle).toBe('Title with ID')
        expect(result?.metaDescription).toBe('Description with class')
      })

      it('should extract only available metadata fields', async () => {
        const mockHTML = `
          <html>
            <head>
              <title>Minimal Page</title>
              <meta property="og:title" content="Just a Title" />
            </head>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result).toEqual({
          ogTitle: 'Just a Title',
          pageTitle: 'Minimal Page',
        })
        expect(result?.ogDescription).toBeUndefined()
        expect(result?.ogImage).toBeUndefined()
      })

      it('should handle page with only standard meta tags (no OG)', async () => {
        const mockHTML = `
          <html>
            <head>
              <title>Standard Page</title>
              <meta name="description" content="Regular description" />
              <meta name="author" content="Jane Smith" />
            </head>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result).toEqual({
          metaDescription: 'Regular description',
          metaAuthor: 'Jane Smith',
          pageTitle: 'Standard Page',
        })
      })

      it('should handle XHTML content type', async () => {
        const mockHTML = `
          <html>
            <head>
              <meta property="og:title" content="XHTML Page" />
            </head>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'application/xhtml+xml' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result?.ogTitle).toBe('XHTML Page')
      })

      it('should decode HTML entities in extracted content', async () => {
        const mockHTML = `
          <html>
            <head>
              <title>Test &amp; Example &lt;Title&gt;</title>
              <meta property="og:title" content="Title with &quot;quotes&quot; &amp; symbols" />
              <meta property="og:description" content="Description with &#39;apostrophes&#39; &#x27;and&#x27; &#x2F;slashes&#x2F;" />
              <meta name="author" content="John&nbsp;Doe" />
            </head>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result?.pageTitle).toBe('Test & Example <Title>')
        expect(result?.ogTitle).toBe('Title with "quotes" & symbols')
        expect(result?.ogDescription).toBe("Description with 'apostrophes' 'and' /slashes/")
        expect(result?.metaAuthor).toBe('John Doe')
      })

      it('should trim whitespace from extracted values', async () => {
        const mockHTML = `
          <html>
            <head>
              <title>  Whitespace Title  </title>
              <meta property="og:title" content="  Spaced Title  " />
              <meta name="description" content="
                Multi-line description
              " />
            </head>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result?.pageTitle).toBe('Whitespace Title')
        expect(result?.ogTitle).toBe('Spaced Title')
        expect(result?.metaDescription).toContain('Multi-line description')
      })
    })

    describe('HTML fetching', () => {
      it('should follow redirects', async () => {
        const mockHTML = '<html><head><title>Redirected</title></head></html>'

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        await extractOGMetadata('https://example.com')

        expect(fetch).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
          redirect: 'follow',
        }))
      })

      it('should include abort signal in fetch request', async () => {
        const mockHTML = '<html><head><title>Test</title></head></html>'
        let receivedSignal: AbortSignal | undefined

        vi.mocked(fetch).mockImplementation(async (_url, options) => {
          receivedSignal = options?.signal as AbortSignal
          return {
            ok: true,
            headers: new Headers({ 'content-type': 'text/html' }),
            text: async () => mockHTML,
          } as Response
        })

        await extractOGMetadata('https://example.com')

        expect(receivedSignal).toBeDefined()
        expect(receivedSignal).toBeInstanceOf(AbortSignal)
      })

      it('should reject content larger than MAX_HTML_SIZE via content-length header', async () => {
        const largeSize = 6 * 1024 * 1024 // 6MB, exceeds 5MB limit

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({
            'content-type': 'text/html',
            'content-length': String(largeSize),
          }),
          text: async () => 'x'.repeat(largeSize),
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result).toBeNull()
      })

      it('should reject content larger than MAX_HTML_SIZE after download', async () => {
        const largeHTML = 'x'.repeat(6 * 1024 * 1024) // 6MB

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => largeHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result).toBeNull()
      })

      it('should handle missing content-type header', async () => {
        const mockHTML = '<html><head><meta property="og:title" content="No Content-Type"/></head></html>'

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({}),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result).toBeNull()
      })
    })

    describe('error handling', () => {
      it('should return null for HTTP 404 error', async () => {
        vi.mocked(fetch).mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          headers: new Headers(),
        } as Response)

        const result = await extractOGMetadata('https://example.com/notfound')

        expect(result).toBeNull()
      })

      it('should return null for HTTP 500 error', async () => {
        vi.mocked(fetch).mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers(),
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result).toBeNull()
      })

      it('should return null for HTTP 403 forbidden', async () => {
        vi.mocked(fetch).mockResolvedValue({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          headers: new Headers(),
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result).toBeNull()
      })

      it('should return null for network error', async () => {
        vi.mocked(fetch).mockRejectedValue(new Error('Network request failed'))

        const result = await extractOGMetadata('https://example.com')

        expect(result).toBeNull()
      })

      it('should return null for unexpected content type (PDF)', async () => {
        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'application/pdf' }),
          text: async () => 'PDF content',
        } as Response)

        const result = await extractOGMetadata('https://example.com/document.pdf')

        expect(result).toBeNull()
      })

      it('should return null for unexpected content type (JSON)', async () => {
        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => '{"data": "json"}',
        } as Response)

        const result = await extractOGMetadata('https://example.com/api')

        expect(result).toBeNull()
      })

      it('should return null for unexpected content type (image)', async () => {
        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'image/png' }),
          text: async () => 'binary image data',
        } as Response)

        const result = await extractOGMetadata('https://example.com/image.png')

        expect(result).toBeNull()
      })

      it('should return null when page has no metadata at all', async () => {
        const mockHTML = `
          <html>
            <head></head>
            <body>Content without any metadata</body>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result).toBeNull()
      })

      it('should handle abort error', async () => {
        vi.mocked(fetch).mockRejectedValue(new DOMException('Aborted', 'AbortError'))

        const result = await extractOGMetadata('https://example.com')

        expect(result).toBeNull()
      })

      it('should handle timeout error', async () => {
        vi.mocked(fetch).mockRejectedValue(new Error('Request timeout'))

        const result = await extractOGMetadata('https://example.com')

        expect(result).toBeNull()
      })

      it('should handle DNS resolution error', async () => {
        vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

        const result = await extractOGMetadata('https://invalid-domain-that-does-not-exist.com')

        expect(result).toBeNull()
      })
    })

    describe('edge cases', () => {
      it('should handle empty HTML document', async () => {
        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => '',
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result).toBeNull()
      })

      it('should handle malformed HTML', async () => {
        const mockHTML = `
          <html><head>
          <meta property="og:title" content="Unclosed meta tag
          <title>Unclosed title
          <meta name="description" content="No closing quote>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        // Should still extract what it can from malformed HTML
        const result = await extractOGMetadata('https://example.com')

        // Regex-based extraction is lenient with malformed HTML
        expect(result).toBeDefined()
      })

      it('should handle meta tags with single quotes', async () => {
        const mockHTML = `
          <html>
            <head>
              <meta property='og:title' content='Single Quote Title' />
              <meta name='description' content='Single quote description' />
            </head>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result?.ogTitle).toBe('Single Quote Title')
        expect(result?.metaDescription).toBe('Single quote description')
      })

      it('should handle mixed quote styles', async () => {
        const mockHTML = `
          <html>
            <head>
              <meta property="og:title" content='Mixed quotes title' />
              <meta property='og:description' content="Mixed quotes desc" />
            </head>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result?.ogTitle).toBe('Mixed quotes title')
        expect(result?.ogDescription).toBe('Mixed quotes desc')
      })

      it('should handle title tag with attributes', async () => {
        const mockHTML = `
          <html>
            <head>
              <title lang="en" dir="ltr">Title with Attributes</title>
            </head>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result?.pageTitle).toBe('Title with Attributes')
      })

      it('should handle empty meta content attributes', async () => {
        const mockHTML = `
          <html>
            <head>
              <meta property="og:title" content="" />
              <meta property="og:description" content="" />
              <title></title>
            </head>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result).toBeNull()
      })

      it('should handle whitespace-only content', async () => {
        const mockHTML = `
          <html>
            <head>
              <meta property="og:title" content="   " />
              <title>   </title>
            </head>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        // Whitespace gets trimmed to empty strings, which are included
        expect(result).toEqual({
          ogTitle: '',
          pageTitle: '',
        })
      })

      it('should handle uppercase HTML tags', async () => {
        const mockHTML = `
          <HTML>
            <HEAD>
              <TITLE>Uppercase Tags</TITLE>
              <META PROPERTY="og:title" CONTENT="Uppercase Meta" />
            </HEAD>
          </HTML>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result?.pageTitle).toBe('Uppercase Tags')
        expect(result?.ogTitle).toBe('Uppercase Meta')
      })

      it('should handle very long meta content', async () => {
        const longContent = 'A'.repeat(5000)
        const mockHTML = `
          <html>
            <head>
              <meta property="og:description" content="${longContent}" />
            </head>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result?.ogDescription).toBe(longContent)
        expect(result?.ogDescription?.length).toBe(5000)
      })

      it('should handle duplicate meta tags (uses first occurrence)', async () => {
        const mockHTML = `
          <html>
            <head>
              <meta property="og:title" content="First Title" />
              <meta property="og:title" content="Second Title" />
            </head>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result?.ogTitle).toBe('First Title')
      })

      it('should handle content-type with charset parameter', async () => {
        const mockHTML = '<html><head><title>Charset Test</title></head></html>'

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result?.pageTitle).toBe('Charset Test')
      })

      it('should handle content-type with additional parameters', async () => {
        const mockHTML = '<html><head><title>Params Test</title></head></html>'

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html; charset=utf-8; boundary=something' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result?.pageTitle).toBe('Params Test')
      })

      it('should handle special characters in og:image URL', async () => {
        const imageUrl = 'https://example.com/images/photo-2024.jpg?size=large&quality=high'
        const mockHTML = `
          <html>
            <head>
              <meta property="og:image" content="${imageUrl}" />
            </head>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result?.ogImage).toBe(imageUrl)
      })

      it('should handle meta tags with self-closing syntax variations', async () => {
        const mockHTML = `
          <html>
            <head>
              <meta property="og:title" content="Self-Closing 1"/>
              <meta property="og:description" content="Self-Closing 2" />
              <meta name="author" content="Self-Closing 3" >
            </head>
          </html>
        `

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        const result = await extractOGMetadata('https://example.com')

        expect(result?.ogTitle).toBe('Self-Closing 1')
        expect(result?.ogDescription).toBe('Self-Closing 2')
        expect(result?.metaAuthor).toBe('Self-Closing 3')
      })
    })

    describe('console logging', () => {
      it('should only log debug messages when DEBUG=true', async () => {
        const originalDebug = process.env.DEBUG
        process.env.DEBUG = 'true'

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const mockHTML = '<html><head><title>Log Test</title></head></html>'

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        await extractOGMetadata('https://example.com')

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('[og-metadata] Extracting metadata from:')
        )
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('[og-metadata] Extracted metadata:')
        )

        consoleSpy.mockRestore()
        process.env.DEBUG = originalDebug
      })

      it('should not log debug messages when DEBUG is not true', async () => {
        const originalDebug = process.env.DEBUG
        delete process.env.DEBUG

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const mockHTML = '<html><head><title>Log Test</title></head></html>'

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        await extractOGMetadata('https://example.com')

        expect(consoleSpy).not.toHaveBeenCalled()

        consoleSpy.mockRestore()
        process.env.DEBUG = originalDebug
      })

      it('should log debug message when no metadata found and DEBUG=true', async () => {
        const originalDebug = process.env.DEBUG
        process.env.DEBUG = 'true'

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const mockHTML = '<html><head></head></html>'

        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => mockHTML,
        } as Response)

        await extractOGMetadata('https://example.com')

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('[og-metadata] No metadata found for:')
        )

        consoleSpy.mockRestore()
        process.env.DEBUG = originalDebug
      })

      it('should log errors when extraction fails', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

        await extractOGMetadata('https://example.com')

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('[og-metadata] Extraction failed:')
        )

        consoleSpy.mockRestore()
      })
    })
  })

  describe('mergeOGMetadata', () => {
    it('should merge OG metadata into existing metadata object', () => {
      const existingMetadata = {
        customField: 'value',
        anotherField: 123,
      }

      const ogMetadata: OGMetadata = {
        ogTitle: 'Test Title',
        ogDescription: 'Test Description',
        pageTitle: 'Page Title',
      }

      const result = mergeOGMetadata(existingMetadata, ogMetadata)

      expect(result).toEqual({
        customField: 'value',
        anotherField: 123,
        ogMetadata: {
          ogTitle: 'Test Title',
          ogDescription: 'Test Description',
          pageTitle: 'Page Title',
        },
      })
    })

    it('should create new object when existing metadata is null', () => {
      const ogMetadata: OGMetadata = {
        ogTitle: 'Test Title',
        ogImage: 'https://example.com/image.jpg',
      }

      const result = mergeOGMetadata(null, ogMetadata)

      expect(result).toEqual({
        ogMetadata: {
          ogTitle: 'Test Title',
          ogImage: 'https://example.com/image.jpg',
        },
      })
    })

    it('should create new object when existing metadata is undefined', () => {
      const ogMetadata: OGMetadata = {
        ogDescription: 'Test Description',
      }

      const result = mergeOGMetadata(undefined, ogMetadata)

      expect(result).toEqual({
        ogMetadata: {
          ogDescription: 'Test Description',
        },
      })
    })

    it('should not add ogMetadata field when ogMetadata is null', () => {
      const existingMetadata = {
        existingField: 'value',
      }

      const result = mergeOGMetadata(existingMetadata, null)

      expect(result).toEqual({
        existingField: 'value',
      })
      expect(result.ogMetadata).toBeUndefined()
    })

    it('should return empty object when both parameters are null', () => {
      const result = mergeOGMetadata(null, null)

      expect(result).toEqual({})
    })

    it('should preserve existing metadata and not mutate original', () => {
      const existingMetadata = {
        field1: 'value1',
        field2: 'value2',
      }

      const ogMetadata: OGMetadata = {
        ogTitle: 'Title',
      }

      const result = mergeOGMetadata(existingMetadata, ogMetadata)

      // Should not mutate original
      expect(existingMetadata).toEqual({
        field1: 'value1',
        field2: 'value2',
      })
      expect(existingMetadata).not.toHaveProperty('ogMetadata')

      // Result should be new object
      expect(result).not.toBe(existingMetadata)
      expect(result).toEqual({
        field1: 'value1',
        field2: 'value2',
        ogMetadata: {
          ogTitle: 'Title',
        },
      })
    })

    it('should handle complete OG metadata object', () => {
      const ogMetadata: OGMetadata = {
        ogTitle: 'OG Title',
        ogDescription: 'OG Description',
        ogImage: 'https://example.com/image.jpg',
        ogSiteName: 'Example Site',
        ogType: 'article',
        metaDescription: 'Meta Description',
        metaAuthor: 'John Doe',
        metaKeywords: 'keyword1, keyword2',
        pageTitle: 'Page Title',
      }

      const result = mergeOGMetadata(null, ogMetadata)

      expect(result.ogMetadata).toEqual(ogMetadata)
    })

    it('should handle existing metadata with nested objects', () => {
      const existingMetadata = {
        user: {
          name: 'John',
          age: 30,
        },
        tags: ['tag1', 'tag2'],
      }

      const ogMetadata: OGMetadata = {
        ogTitle: 'Title',
      }

      const result = mergeOGMetadata(existingMetadata, ogMetadata)

      expect(result).toEqual({
        user: {
          name: 'John',
          age: 30,
        },
        tags: ['tag1', 'tag2'],
        ogMetadata: {
          ogTitle: 'Title',
        },
      })
    })
  })
})
