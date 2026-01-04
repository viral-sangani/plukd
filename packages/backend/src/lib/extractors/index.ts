import { detectSource, generateFallbackTitle } from '@plukd/shared'
import type { ContentSource, ExtractedContent, RawMetadata } from '@plukd/shared'
import { extractTwitterContent } from './twitter'
import { extractInstagramContent } from './instagram'
import { extractYouTubeContent } from './youtube'
import { extractOGMetadata } from './og-metadata'
import { extractWithParallel } from './parallel-client'
import { downloadInstagramVideo, isInstagramVideoUrl } from './instagram-video'
import { transcribeBuffer, isTranscriptionAvailable } from '../transcription'

// Re-export the ExtractedContent type for convenience
export type { ExtractedContent } from '@plukd/shared'

// Re-export individual extractors
export { extractTwitterContent } from './twitter'
export { extractInstagramContent } from './instagram'
export { extractYouTubeContent } from './youtube'
export { extractOGMetadata } from './og-metadata'
export { extractWithParallel } from './parallel-client'
export { downloadInstagramVideo, isInstagramVideoUrl } from './instagram-video'

/**
 * Extract content using OG metadata as a fallback.
 *
 * This is used when platform-specific extractors fail or are unavailable.
 * Works for any URL that has Open Graph or standard meta tags.
 *
 * @param url - The URL to extract content from
 * @param source - The content source type
 * @returns Extracted content or null if extraction fails
 */
async function extractWithOGFallback(
  url: string,
  source: ContentSource
): Promise<ExtractedContent | null> {
  console.log(`[extractors] Attempting OG metadata extraction for ${source}: ${url}`)

  const ogMetadata = await extractOGMetadata(url)

  if (!ogMetadata) {
    console.log(`[extractors] OG metadata extraction failed for: ${url}`)
    return null
  }

  // Prefer og:title, then page title, then generate from URL
  const title =
    ogMetadata.ogTitle || ogMetadata.pageTitle || generateFallbackTitle(url, source)

  // Build content from available descriptions
  const content = ogMetadata.ogDescription || ogMetadata.metaDescription || ''

  const rawMetadata: RawMetadata = {
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
  }

  return {
    url,
    source,
    title,
    content,
    author: ogMetadata.metaAuthor,
    mediaUrls: ogMetadata.ogImage ? [ogMetadata.ogImage] : undefined,
    ogTitle: ogMetadata.ogTitle,
    ogDescription: ogMetadata.ogDescription,
    ogImage: ogMetadata.ogImage,
    ogSiteName: ogMetadata.ogSiteName,
    ogType: ogMetadata.ogType,
    metaDescription: ogMetadata.metaDescription,
    metaAuthor: ogMetadata.metaAuthor,
    metaKeywords: ogMetadata.metaKeywords,
    rawMetadata,
  }
}

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

  // Use extracted title, or generate a fallback from URL
  const title = result.title || generateFallbackTitle(url, source)

  return {
    url,
    source,
    title,
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
 * Uses a fallback chain:
 * 1. Platform-specific extractor (Twitter/Gopher, Parallel AI)
 * 2. OG metadata extraction as fallback
 * 3. Returns null if all extractors fail
 *
 * @param url - The URL to extract content from
 * @returns Extracted content or null if all extraction methods fail
 */
export async function extractContent(url: string): Promise<ExtractedContent | null> {
  const source = detectSource(url)
  let result: ExtractedContent | null = null

  switch (source) {
    case 'twitter':
      // Twitter uses existing Gopher API extractor
      try {
        result = await extractTwitterContent(url)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.log(`[extractors] Twitter extraction failed: ${message}`)
      }
      // Fall back to OG metadata if Gopher fails
      if (!result) {
        result = await extractWithOGFallback(url, source)
      }
      break

    case 'youtube':
      // YouTube: use dedicated extractor that fetches transcripts
      console.log('[extractors] Extracting YouTube content with transcript')
      try {
        result = await extractYouTubeContent(url)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.log(`[extractors] YouTube extraction failed: ${message}`)
      }
      // Fall back to OG metadata if YouTube extractor fails
      if (!result) {
        result = await extractWithOGFallback(url, source)
      }
      break

    case 'instagram':
      // Instagram: use dedicated extractor with AI title generation
      console.log('[extractors] Extracting Instagram content')
      try {
        result = await extractInstagramContent(url)

        // If it's a reel/video and transcription is available, try to transcribe
        if (result && isInstagramVideoUrl(url) && isTranscriptionAvailable()) {
          console.log('[extractors] Attempting to transcribe Instagram reel')
          console.log(`[extractors] Video URL check: isInstagramVideoUrl=${isInstagramVideoUrl(url)}, transcriptionAvailable=${isTranscriptionAvailable()}`)
          try {
            console.log('[extractors] Downloading Instagram video...')
            const videoResult = await downloadInstagramVideo(url)
            console.log(`[extractors] Video downloaded: ${videoResult.buffer.length} bytes, mimeType: ${videoResult.mimeType}`)

            console.log('[extractors] Starting transcription...')
            const transcription = await transcribeBuffer(
              videoResult.buffer,
              videoResult.mimeType
            )

            // Add transcript to the extracted content
            result.transcript = transcription.text
            result.transcriptLanguage = transcription.language

            // Append transcript to content for AI processing
            if (transcription.text) {
              result.content = `${result.content || ''}\n\n---\n\nTranscript:\n${transcription.text}`
              console.log(`[extractors] Transcript appended to content. Final content length: ${result.content.length}`)
            }

            console.log(
              `[extractors] Instagram reel transcribed successfully:`
            )
            console.log(`[extractors]   - Length: ${transcription.text.length} chars`)
            console.log(`[extractors]   - Language: ${transcription.language}`)
            console.log(`[extractors]   - Duration: ${transcription.duration || 'unknown'}s`)
            console.log(`[extractors]   - Preview: "${transcription.text.slice(0, 200)}..."`)
          } catch (transcriptionError) {
            const message =
              transcriptionError instanceof Error
                ? transcriptionError.message
                : String(transcriptionError)
            console.log(`[extractors] Instagram transcription failed (continuing without): ${message}`)
            if (transcriptionError instanceof Error && transcriptionError.stack) {
              console.log(`[extractors] Stack trace: ${transcriptionError.stack}`)
            }
            // Continue without transcript - we still have the other metadata
          }
        } else {
          console.log(`[extractors] Skipping transcription: result=${!!result}, isVideoUrl=${isInstagramVideoUrl(url)}, transcriptionAvailable=${isTranscriptionAvailable()}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.log(`[extractors] Instagram extraction failed: ${message}`)
      }
      // Fall back to OG metadata if Instagram extractor fails
      if (!result) {
        result = await extractWithOGFallback(url, source)
      }
      break

    case 'reddit':
    case 'linkedin':
    case 'web':
      // Try Parallel AI extractor first
      result = await extractWithParallelAI(url, source)
      // Fall back to OG metadata if Parallel AI fails
      if (!result) {
        result = await extractWithOGFallback(url, source)
      }
      break

    default:
      console.log(`[extractors] Unknown source: ${source}`)
      result = await extractWithOGFallback(url, source)
  }

  return result
}
