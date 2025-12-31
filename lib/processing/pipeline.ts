/**
 * Processing Pipeline
 *
 * Orchestrates the complete bookmark processing flow:
 * 1. Extract content from URL using platform-specific extractors
 * 2. Process extracted content with AI to generate category, tags, blurb, and summary
 * 3. Update bookmark in database with processed data
 *
 * Designed to run in the background without blocking the main request.
 * Handles errors gracefully - logs but does not throw.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database, ProcessingStatus, ContentSource } from '@/types/database'
import type { ExtractedContent, RawMetadata } from '@/types'
import { extractContent, extractOGMetadata } from '@/lib/extractors'
import { processContentWithRetry } from '@/lib/ai/process'
import { detectSource } from '@/lib/utils'

/**
 * Supabase admin client for background processing.
 * Uses service role key to bypass RLS since this runs outside request context.
 */
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Create a fallback ExtractedContent when extraction fails.
 * Provides minimal context for AI processing.
 */
function createFallbackContent(url: string, source: ContentSource): ExtractedContent {
  return {
    url,
    source,
    title: 'Untitled',
    content: `Content from ${url}`,
  }
}

/**
 * Enhance extracted content with OG metadata.
 *
 * For web URLs, attempts to extract OG metadata and merge it into the
 * extracted content. This provides additional context like og:image,
 * og:site_name, etc. that may not be available from the primary extractor.
 *
 * Errors are handled gracefully - if OG extraction fails, the original
 * content is returned unchanged.
 *
 * @param url - The URL being processed
 * @param content - The existing extracted content (may be null)
 * @param source - The detected content source
 * @returns Enhanced content with OG metadata merged in
 */
async function enhanceWithOGMetadata(
  url: string,
  content: ExtractedContent | null,
  source: ContentSource
): Promise<ExtractedContent | null> {
  // Only attempt OG enhancement for web sources
  // Platform-specific sources (twitter, reddit, etc.) have their own metadata
  if (source !== 'web') {
    return content
  }

  // If we already have content from the web extractor, it includes OG metadata
  if (content) {
    return content
  }

  // No content yet - try to extract OG metadata as a last resort
  try {
    console.log(`[pipeline] Attempting OG metadata extraction for: ${url}`)
    const ogMetadata = await extractOGMetadata(url)

    if (!ogMetadata) {
      return null
    }

    // Build minimal ExtractedContent from OG metadata
    const title = ogMetadata.ogTitle || ogMetadata.pageTitle || url
    const extractedContent = ogMetadata.ogDescription || ogMetadata.metaDescription || ''

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
      source: 'web',
      title,
      content: extractedContent,
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[pipeline] OG metadata extraction failed: ${errorMessage}`)
    return null
  }
}

/**
 * Update the processing status of a bookmark in the database.
 */
async function updateBookmarkStatus(
  bookmarkId: string,
  status: ProcessingStatus,
  error?: string
): Promise<void> {
  const updateData: Database['public']['Tables']['bookmarks']['Update'] = {
    processing_status: status,
    processing_error: error ?? null,
    updated_at: new Date().toISOString(),
  }

  const { error: updateError } = await supabase
    .from('bookmarks')
    .update(updateData as never)
    .eq('id', bookmarkId)

  if (updateError) {
    console.error(`[pipeline] Failed to update bookmark status:`, updateError.message)
  }
}

/**
 * Save extracted content to the bookmark (used when AI fails but extraction succeeded).
 */
async function saveExtractedContent(
  bookmarkId: string,
  extracted: ExtractedContent,
  errorMessage: string
): Promise<void> {
  const { error } = await supabase
    .from('bookmarks')
    .update({
      title: extracted.title,
      author: extracted.author ?? null,
      author_url: extracted.authorUrl ?? null,
      content: extracted.content ?? null,
      media_urls: extracted.mediaUrls ?? null,
      published_at: extracted.publishedAt?.toISOString() ?? null,
      raw_metadata: extracted.rawMetadata ?? null,
      processing_status: 'failed' as ProcessingStatus,
      processing_error: errorMessage,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', bookmarkId)

  if (error) {
    console.error(`[pipeline] Failed to save extracted content:`, error.message)
  }
}

/**
 * Process a single bookmark through the extraction and AI pipeline.
 *
 * This function:
 * 1. Updates status to 'processing'
 * 2. Extracts content from the URL (continues with fallback if fails)
 * 3. Processes content with AI to generate category, tags, blurb, and summary
 * 4. Updates the bookmark with all processed data
 * 5. Sets status to 'completed' or 'failed'
 *
 * Error handling:
 * - If extraction fails, continues with fallback content for AI processing
 * - If AI fails but extraction succeeded, saves extracted content and marks as failed
 * - Logs errors but does not throw (designed for background processing)
 *
 * @param bookmarkId - The UUID of the bookmark to process
 * @param url - The URL to extract content from
 *
 * @example
 * ```typescript
 * // Trigger processing in the background
 * processBookmark(bookmarkId, url)
 * ```
 */
export async function processBookmark(
  bookmarkId: string,
  url: string
): Promise<void> {
  console.log(`[pipeline] Starting processing for bookmark ${bookmarkId}: ${url}`)

  // Step 1: Update status to processing
  await updateBookmarkStatus(bookmarkId, 'processing')

  const source = detectSource(url)
  let extractedContent: ExtractedContent | null = null

  // Step 2: Extract content from URL
  try {
    console.log(`[pipeline] Extracting content from ${url} (source: ${source})`)
    extractedContent = await extractContent(url)

    if (extractedContent) {
      console.log(`[pipeline] Extracted content: "${extractedContent.title}"`)
    } else {
      console.log(`[pipeline] Extraction returned null, will try OG metadata extraction`)
    }
  } catch (extractionError) {
    // Log extraction error but continue with fallback for AI processing
    const errorMessage =
      extractionError instanceof Error ? extractionError.message : String(extractionError)
    console.error(`[pipeline] Extraction failed, continuing with fallback: ${errorMessage}`)
  }

  // Step 2b: Try to enhance with OG metadata for web URLs
  // This handles the case where primary extraction failed or returned null
  if (!extractedContent && source === 'web') {
    extractedContent = await enhanceWithOGMetadata(url, extractedContent, source)
    if (extractedContent) {
      console.log(`[pipeline] Enhanced with OG metadata: "${extractedContent.title}"`)
    }
  }

  // Step 3: Process content with AI
  try {
    // Use extracted content or fallback
    const contentForAI = extractedContent ?? createFallbackContent(url, source)

    console.log(`[pipeline] Processing content with AI`)
    const aiResult = await processContentWithRetry(contentForAI)

    console.log(
      `[pipeline] AI processing complete: category=${aiResult.category}, tags=${aiResult.tags.join(', ')}`
    )

    // Step 4: Update bookmark with all processed data
    const updateData: Database['public']['Tables']['bookmarks']['Update'] = {
      // Extracted content (or defaults if extraction failed)
      title: extractedContent?.title ?? 'Untitled',
      author: extractedContent?.author ?? null,
      author_url: extractedContent?.authorUrl ?? null,
      content: extractedContent?.content ?? null,
      media_urls: extractedContent?.mediaUrls ?? null,
      published_at: extractedContent?.publishedAt?.toISOString() ?? null,
      raw_metadata: extractedContent?.rawMetadata ?? null,
      // AI-generated content
      category: aiResult.category,
      tags: aiResult.tags,
      blurb: aiResult.blurb,
      summary: aiResult.summary,
      // Status
      processing_status: 'completed' as ProcessingStatus,
      processing_error: null,
      updated_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
      .from('bookmarks')
      .update(updateData as never)
      .eq('id', bookmarkId)

    if (updateError) {
      console.error(`[pipeline] Failed to update bookmark: ${updateError.message}`)
      await updateBookmarkStatus(
        bookmarkId,
        'failed',
        `Database update failed: ${updateError.message}`
      )
      return
    }

    console.log(`[pipeline] Successfully processed bookmark ${bookmarkId}`)
  } catch (aiError) {
    // AI processing failed
    const errorMessage = aiError instanceof Error ? aiError.message : String(aiError)
    console.error(`[pipeline] AI processing failed: ${errorMessage}`)

    // If we have extracted content, save it even without AI results
    if (extractedContent) {
      console.log(`[pipeline] Saving extracted content despite AI failure`)
      await saveExtractedContent(
        bookmarkId,
        extractedContent,
        `AI processing failed: ${errorMessage}`
      )
    } else {
      // No extracted content and AI failed - just mark as failed
      await updateBookmarkStatus(bookmarkId, 'failed', `Processing failed: ${errorMessage}`)
    }
  }
}

/**
 * Batch process multiple bookmarks.
 * Processes bookmarks sequentially to avoid overwhelming external APIs.
 *
 * @param bookmarks - Array of bookmark IDs and URLs to process
 * @returns Object with successful and failed bookmark IDs
 */
export async function processBatchBookmarks(
  bookmarks: Array<{ id: string; url: string }>
): Promise<{ successful: string[]; failed: string[] }> {
  const successful: string[] = []
  const failed: string[] = []

  for (const bookmark of bookmarks) {
    try {
      await processBookmark(bookmark.id, bookmark.url)
      successful.push(bookmark.id)
    } catch {
      // processBookmark handles its own errors and doesn't throw,
      // but catch any unexpected errors just in case
      failed.push(bookmark.id)
    }
  }

  console.log(
    `[pipeline] Batch complete: ${successful.length} succeeded, ${failed.length} failed`
  )

  return { successful, failed }
}

/**
 * Fetch and process all pending bookmarks for a user.
 * Useful for catching up on bookmarks that haven't been processed yet.
 *
 * @param userId - The user ID to process bookmarks for
 * @param limit - Maximum number of bookmarks to process (default: 10)
 * @returns Results summary
 */
export async function processPendingBookmarks(
  userId: string,
  limit: number = 10
): Promise<{ successful: string[]; failed: string[] }> {
  console.log(`[pipeline] Fetching pending bookmarks for user ${userId}`)

  const { data: bookmarks, error } = await supabase
    .from('bookmarks')
    .select('id, url')
    .eq('user_id', userId)
    .eq('processing_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error(`[pipeline] Failed to fetch pending bookmarks:`, error.message)
    return { successful: [], failed: [] }
  }

  if (!bookmarks || bookmarks.length === 0) {
    console.log(`[pipeline] No pending bookmarks found`)
    return { successful: [], failed: [] }
  }

  console.log(`[pipeline] Found ${bookmarks.length} pending bookmarks to process`)
  return processBatchBookmarks(bookmarks)
}
