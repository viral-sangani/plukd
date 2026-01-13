import { detectSource, generateFallbackTitle } from '@plukd/shared'
import type { ContentSource, ExtractedContent, RawMetadata } from '@plukd/shared'
import { extractTwitterContent } from './twitter'
import { extractInstagramContent } from './instagram'
import { extractYouTubeContent } from './youtube'
import { extractOGMetadata } from './og-metadata'
import { extractWithParallel } from './parallel-client'
import {
  downloadInstagramVideo,
  isInstagramVideoUrl,
  isInstagramReelUrl,
  maybeInstagramVideo,
  getInstagramMediaInfo,
  shouldTranscribeInstagram,
} from './instagram-video'
import type { InstagramMediaInfo, CarouselItem } from './instagram-video'
import { transcribeBuffer, isTranscriptionAvailable } from '../transcription'

// Re-export the ExtractedContent type for convenience
export type { ExtractedContent } from '@plukd/shared'

// Re-export individual extractors
export { extractTwitterContent } from './twitter'
export { extractInstagramContent } from './instagram'
export { extractYouTubeContent } from './youtube'
export { extractOGMetadata } from './og-metadata'
export { extractWithParallel } from './parallel-client'
export {
  downloadInstagramVideo,
  isInstagramVideoUrl,
  isInstagramReelUrl,
  maybeInstagramVideo,
  getInstagramMediaInfo,
  shouldTranscribeInstagram,
} from './instagram-video'
export type { InstagramMediaInfo, CarouselItem } from './instagram-video'

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
  const ogMetadata = await extractOGMetadata(url)

  if (!ogMetadata) {
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
  const result = await extractWithParallel(url)

  if (!result) {
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

  console.log(`[extractors] Extracting ${source} content`)

  switch (source) {
    case 'twitter':
      // Twitter uses existing Gopher API extractor
      try {
        result = await extractTwitterContent(url)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[extractors] Twitter extraction failed: ${message}`)
      }
      // Fall back to OG metadata if Gopher fails
      if (!result) {
        result = await extractWithOGFallback(url, source)
      }
      break

    case 'youtube':
      // YouTube: use dedicated extractor that fetches transcripts
      try {
        result = await extractYouTubeContent(url)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[extractors] YouTube extraction failed: ${message}`)
      }
      // Fall back to OG metadata if YouTube extractor fails
      if (!result) {
        result = await extractWithOGFallback(url, source)
      }
      break

    case 'instagram':
      // Instagram: use dedicated extractor with AI title generation
      try {
        result = await extractInstagramContent(url)

        // Handle transcription for Instagram content
        if (result && isTranscriptionAvailable()) {
          await handleInstagramTranscription(url, result)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[extractors] Instagram extraction failed: ${message}`)
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
      result = await extractWithOGFallback(url, source)
  }

  if (result) {
    console.log(`[extractors] Extraction successful: ${result.title}`)
  }

  return result
}

/**
 * Handle Instagram transcription logic
 *
 * - For reels: Always attempt transcription
 * - For posts: Check if it's a video first using GraphQL API
 * - For carousels: Skip transcription, store carousel info in metadata
 */
async function handleInstagramTranscription(
  url: string,
  result: ExtractedContent
): Promise<void> {
  // Check if this is a reel (always a video)
  if (isInstagramReelUrl(url)) {
    await transcribeInstagramVideo(url, result)
    return
  }

  // Check if this might be a video post
  if (maybeInstagramVideo(url)) {
    // Fetch media info to determine content type
    const mediaInfo = await getInstagramMediaInfo(url)

    if (!mediaInfo) {
      // Could not determine content type, skip
      return
    }

    // Handle carousel posts
    if (mediaInfo.isCarousel) {
      // Store carousel info in metadata if not already present
      // Note: extractInstagramContent() already handles carousel metadata and mediaUrls
      // via extractMediaUrls(), so we only update rawMetadata if it's missing
      if (result.rawMetadata && !result.rawMetadata.instagram?.isCarousel) {
        result.rawMetadata.instagram = {
          ...result.rawMetadata.instagram,
          isCarousel: true,
          carouselItems: mediaInfo.carouselItems,
        }
      }
      // mediaUrls are already populated by extractInstagramContent() -> extractMediaUrls()
      // so we don't need to add them again here (which would cause duplication)
      return
    }

    // Handle video post
    if (mediaInfo.isVideo) {
      await transcribeInstagramVideo(url, result)
    }
  }
}

/**
 * Download and transcribe an Instagram video
 */
async function transcribeInstagramVideo(
  url: string,
  result: ExtractedContent
): Promise<void> {
  try {
    const videoResult = await downloadInstagramVideo(url)

    const transcription = await transcribeBuffer(videoResult.buffer, videoResult.mimeType)

    // Add transcript to the extracted content
    result.transcript = transcription.text
    result.transcriptLanguage = transcription.language

    // Append transcript to content for AI processing
    if (transcription.text) {
      result.content = `${result.content || ''}\n\n---\n\nTranscript:\n${transcription.text}`
    }
  } catch (error) {
    // Silently fail for transcription errors - we still have the other metadata
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[extractors] Instagram transcription failed: ${message}`)
  }
}
