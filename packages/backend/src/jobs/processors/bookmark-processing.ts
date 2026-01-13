import { Job } from 'bullmq'
import { BookmarkProcessingJob } from '../queue'
import { supabaseAdmin } from '../../config/supabase'
import { extractContent } from '../../lib/extractors'
import { extractOGMetadata } from '../../lib/extractors/og-metadata'
import {
  processContentWithRetry,
  INSUFFICIENT_CONTENT_MARKER,
  INSUFFICIENT_CONTENT_BLURB,
} from '../../lib/ai/process'
import {
  generateBookmarkEmbedding,
  formatEmbeddingForPostgres,
  EXPECTED_EMBEDDING_DIMENSION,
} from '../../lib/ai/embeddings'
import { detectSource, generateFallbackTitle } from '@plukd/shared'
import type { ProcessingStatus, ContentSource, ExtractedContent, RawMetadata } from '@plukd/shared'

/**
 * Log debug message only when DEBUG=true
 */
function debugLog(message: string): void {
  if (process.env.DEBUG === 'true') {
    console.log(message)
  }
}

/**
 * Create a fallback ExtractedContent when extraction fails.
 * Provides minimal context for AI processing with a smart title
 * generated from the URL instead of just "Untitled".
 */
function createFallbackContent(url: string, source: ContentSource): ExtractedContent {
  return {
    url,
    source,
    title: generateFallbackTitle(url, source),
    content: `Content from ${url}`,
  }
}

/**
 * Extraction error types for categorization.
 */
export type ExtractionErrorType =
  | 'parallel_ai_extraction_failed'
  | 'og_metadata_extraction_failed'
  | 'complete_extraction_failure'

/**
 * Result of OG metadata enhancement, including any errors encountered.
 */
interface OGEnhancementResult {
  content: ExtractedContent | null
  error: string | null
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
 */
async function enhanceWithOGMetadata(
  url: string,
  content: ExtractedContent | null,
  source: ContentSource
): Promise<OGEnhancementResult> {
  // Only attempt OG enhancement for web sources
  // Platform-specific sources (twitter, reddit, etc.) have their own metadata
  if (source !== 'web') {
    return { content, error: null }
  }

  // If we already have content from the web extractor, it includes OG metadata
  if (content) {
    return { content, error: null }
  }

  // No content yet - try to extract OG metadata as a last resort
  try {
    debugLog(`[processor] Attempting OG metadata extraction for: ${url}`)
    const ogMetadata = await extractOGMetadata(url)

    if (!ogMetadata) {
      return { content: null, error: 'OG metadata extraction returned null' }
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
      content: {
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
      },
      error: null,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[processor] OG metadata extraction failed: ${errorMessage}`)
    return { content: null, error: `OG metadata extraction failed: ${errorMessage}` }
  }
}

/**
 * Build extraction error message based on what failed.
 * Categorizes errors for easier debugging and admin dashboard filtering.
 */
function buildExtractionError(
  primaryError: string | null,
  ogError: string | null,
  source: ContentSource
): string | null {
  // No errors occurred
  if (!primaryError && !ogError) {
    return null
  }

  // Primary extraction failed but OG succeeded (for web sources)
  if (primaryError && !ogError && source === 'web') {
    return `Parallel AI extraction failed: ${primaryError}`
  }

  // Primary extraction failed and OG also failed
  if (primaryError && ogError) {
    return `Complete extraction failure: Primary extraction failed (${primaryError}), OG metadata failed (${ogError})`
  }

  // Only primary extraction failed (for non-web sources, there's no OG fallback)
  if (primaryError) {
    return `Parallel AI extraction failed: ${primaryError}`
  }

  // Only OG extraction failed (shouldn't happen if primary succeeded)
  if (ogError) {
    return `OG metadata extraction failed: ${ogError}`
  }

  return null
}

/**
 * Update the processing status of a bookmark in the database.
 */
async function updateStatus(
  bookmarkId: string,
  status: ProcessingStatus,
  error?: string,
  extractionError?: string | null
): Promise<void> {
  const updateData: Record<string, unknown> = {
    processing_status: status,
    processing_error: error ?? null,
    updated_at: new Date().toISOString(),
  }

  // Only include extraction_error if it's explicitly provided
  if (extractionError !== undefined) {
    updateData.extraction_error = extractionError
  }

  const { error: updateError } = await supabaseAdmin
    .from('bookmarks')
    .update(updateData as never)
    .eq('id', bookmarkId)

  if (updateError) {
    console.error(`[processor] Failed to update bookmark status:`, updateError.message)
  }
}

/**
 * Process a bookmark job through the extraction and AI pipeline.
 *
 * This processor:
 * 1. Updates status to 'processing'
 * 2. Extracts content from the URL (continues with fallback if fails)
 * 3. Processes content with AI to generate category, tags, blurb, and summary
 * 4. Updates the bookmark with all processed data
 * 5. Sets status to 'completed' or 'failed'
 */
export async function processBookmarkJob(job: Job<BookmarkProcessingJob>): Promise<void> {
  const { bookmarkId, url } = job.data

  console.log(`[processor] Processing bookmark ${bookmarkId}`)

  // Step 1: Update status to processing
  await updateStatus(bookmarkId, 'processing')
  await job.updateProgress(10)

  const source = detectSource(url)
  let extractedContent: ExtractedContent | null = null
  let primaryExtractionError: string | null = null
  let ogExtractionError: string | null = null

  // Step 2: Extract content from URL
  try {
    debugLog(`[processor] Extracting content from ${url} (source: ${source})`)
    await job.updateProgress(20)
    extractedContent = await extractContent(url)
    await job.updateProgress(40)

    if (extractedContent) {
      debugLog(`[processor] Extracted content: "${extractedContent.title}"`)
    } else {
      debugLog(`[processor] Extraction returned null, will try OG metadata extraction`)
      primaryExtractionError = 'Extraction returned null'
    }
  } catch (extractionError) {
    // Log extraction error but continue with fallback for AI processing
    const errorMessage =
      extractionError instanceof Error ? extractionError.message : String(extractionError)
    debugLog(`[processor] Extraction failed, continuing with fallback: ${errorMessage}`)
    primaryExtractionError = errorMessage
  }

  // Step 2b: Try to enhance with OG metadata for web URLs
  // This handles the case where primary extraction failed or returned null
  if (!extractedContent && source === 'web') {
    const ogResult = await enhanceWithOGMetadata(url, extractedContent, source)
    extractedContent = ogResult.content
    ogExtractionError = ogResult.error
    if (extractedContent) {
      debugLog(`[processor] Enhanced with OG metadata: "${extractedContent.title}"`)
    }
  }

  // Build extraction error message for tracking
  const extractionError = buildExtractionError(primaryExtractionError, ogExtractionError, source)

  // Step 3: Process content with AI
  try {
    // Use extracted content or fallback
    const contentForAI = extractedContent ?? createFallbackContent(url, source)

    // TEMPORARY DEBUG: Log contentForAI before passing to AI
    console.log(`[DEBUG:PROCESSOR] contentForAI before AI processing:`)
    console.log(`[DEBUG:PROCESSOR]   title: "${contentForAI.title?.slice(0, 60) ?? 'null'}"`)
    console.log(`[DEBUG:PROCESSOR]   mediaUrls: ${contentForAI.mediaUrls ? JSON.stringify(contentForAI.mediaUrls.slice(0, 3).map(u => u.slice(0, 60) + '...')) : 'undefined'}`)
    console.log(`[DEBUG:PROCESSOR]   mediaUrls count: ${contentForAI.mediaUrls?.length ?? 0}`)
    if (contentForAI.rawMetadata?.instagram) {
      const igMeta = contentForAI.rawMetadata.instagram as { isCarousel?: boolean; carouselItems?: unknown[] }
      console.log(`[DEBUG:PROCESSOR]   instagram.isCarousel: ${igMeta.isCarousel ?? false}`)
      console.log(`[DEBUG:PROCESSOR]   instagram.carouselItems count: ${igMeta.carouselItems?.length ?? 0}`)
    }

    debugLog(`[processor] Processing content with AI`)
    await job.updateProgress(50)
    const aiResult = await processContentWithRetry(contentForAI)
    await job.updateProgress(80)

    // Check if AI returned insufficient content marker
    const isInsufficientContent = aiResult.summary === INSUFFICIENT_CONTENT_MARKER

    if (isInsufficientContent) {
      debugLog(`[processor] Content insufficient for AI processing, saving with placeholder`)
    } else {
      debugLog(
        `[processor] AI processing complete: category=${aiResult.category}, tags=${aiResult.tags.join(', ')}`
      )
    }

    // Step 4: Update bookmark with all processed data
    // Use extracted title, or fall back to a smart title from the URL
    const finalTitle = extractedContent?.title ?? generateFallbackTitle(url, source)
    // Use the detected source (may differ from stored source, e.g., 'instagram' vs 'web')
    const finalSource = extractedContent?.source ?? source

    // TEMPORARY DEBUG: Log data being saved
    console.log(`[DEBUG:SAVE] Saving bookmark ${bookmarkId}:`)
    console.log(`[DEBUG:SAVE]   title: "${finalTitle?.slice(0, 60) ?? 'null'}"`)
    console.log(`[DEBUG:SAVE]   source: "${finalSource}"`)
    console.log(`[DEBUG:SAVE]   content length: ${extractedContent?.content?.length ?? 0} chars`)
    console.log(`[DEBUG:SAVE]   mediaUrls count: ${extractedContent?.mediaUrls?.length ?? 0}`)
    console.log(`[DEBUG:SAVE]   category: "${aiResult.category ?? 'null'}"`)
    console.log(`[DEBUG:SAVE]   tags: ${JSON.stringify(aiResult.tags)}`)
    console.log(`[DEBUG:SAVE]   blurb length: ${aiResult.blurb?.length ?? 0} chars`)
    console.log(`[DEBUG:SAVE]   extractedResources count: ${aiResult.extractedResources?.length ?? 0}`)
    console.log(`[DEBUG:SAVE]   isInsufficientContent: ${isInsufficientContent}`)
    if (extractedContent?.rawMetadata?.instagram) {
      const igMeta = extractedContent.rawMetadata.instagram as { isCarousel?: boolean; carouselItems?: unknown[] }
      console.log(`[DEBUG:SAVE]   instagram.isCarousel: ${igMeta.isCarousel ?? false}`)
      console.log(`[DEBUG:SAVE]   instagram.carouselItems count: ${igMeta.carouselItems?.length ?? 0}`)
    }

    // When content is insufficient, save with user-friendly placeholder instead of AI-generated content
    const updateData = isInsufficientContent
      ? {
          // Extracted content (or defaults if extraction failed)
          title: finalTitle,
          source: finalSource,
          author: extractedContent?.author ?? null,
          author_url: extractedContent?.authorUrl ?? null,
          content: extractedContent?.content ?? null,
          media_urls: extractedContent?.mediaUrls ?? null,
          published_at: extractedContent?.publishedAt?.toISOString() ?? null,
          raw_metadata: extractedContent?.rawMetadata ?? null,
          // Set user-friendly placeholder - leave category, tags, summary null
          blurb: INSUFFICIENT_CONTENT_BLURB,
          summary: null,
          category: null,
          tags: [],
          content_type: null,
          extracted_resources: null,
          resource_layout_hint: null,
          key_takeaways: null,
          // Status - mark as completed since we've done what we can
          processing_status: 'completed' as ProcessingStatus,
          processing_error: null,
          extraction_error: extractionError ?? 'Content insufficient for AI processing',
          updated_at: new Date().toISOString(),
        }
      : {
          // Extracted content (or defaults if extraction failed)
          title: finalTitle,
          source: finalSource,
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
          content_type: aiResult.contentType,
          extracted_resources: aiResult.extractedResources ?? null,
          resource_layout_hint: aiResult.resourceLayoutHint ?? null,
          key_takeaways: aiResult.keyTakeaways ?? null,
          // Status
          processing_status: 'completed' as ProcessingStatus,
          processing_error: null,
          extraction_error: extractionError,
          updated_at: new Date().toISOString(),
        }

    const { error: updateError } = await supabaseAdmin
      .from('bookmarks')
      .update(updateData as never)
      .eq('id', bookmarkId)

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`)
    }

    // Log if there was an extraction error but processing continued
    if (extractionError) {
      debugLog(`[processor] Bookmark ${bookmarkId} completed with extraction error: ${extractionError}`)
    }

    await job.updateProgress(90)

    // Step 5: Generate and save embedding for semantic search (non-blocking)
    // Skip embedding for insufficient content since there's nothing meaningful to embed
    if (isInsufficientContent) {
      debugLog(`[processor] Skipping embedding generation for insufficient content`)
      await job.updateProgress(100)
      console.log(`[processor] Successfully processed bookmark ${bookmarkId}`)
      return
    }

    try {
      debugLog(`[processor] Generating embedding for bookmark ${bookmarkId}`)
      const embedding = await generateBookmarkEmbedding(
        finalTitle,
        aiResult.blurb,
        aiResult.summary,
        aiResult.keyTakeaways
      )

      // Validate embedding dimension before saving to database
      // This is a safety check in case the validation in generateBookmarkEmbedding
      // is bypassed or the model returns unexpected dimensions
      if (embedding.length !== EXPECTED_EMBEDDING_DIMENSION) {
        console.warn(
          `[processor] Invalid embedding dimension for bookmark ${bookmarkId}: expected ${EXPECTED_EMBEDDING_DIMENSION}, got ${embedding.length}. Skipping embedding save.`
        )
        // Continue without embedding rather than failing the entire processing
        await job.updateProgress(100)
        console.log(`[processor] Successfully processed bookmark ${bookmarkId} (without embedding)`)
        return
      }

      const embeddingLiteral = formatEmbeddingForPostgres(embedding)
      // RPC function defined in migration 013_add_semantic_search.sql
      const { error: embeddingError } = await supabaseAdmin.rpc(
        'update_bookmark_embedding' as never,
        {
          bookmark_id: bookmarkId,
          embedding_value: embeddingLiteral,
        } as never
      )

      if (embeddingError) {
        // Non-fatal: log and continue
        console.warn(`[processor] Failed to save embedding: ${embeddingError.message}`)
      } else {
        debugLog(`[processor] Embedding saved for bookmark ${bookmarkId}`)
      }
    } catch (embeddingError) {
      // Non-fatal: log and continue
      const errorMessage = embeddingError instanceof Error ? embeddingError.message : String(embeddingError)
      console.warn(`[processor] Embedding generation failed: ${errorMessage}`)
    }

    await job.updateProgress(100)
    console.log(`[processor] Successfully processed bookmark ${bookmarkId}`)
  } catch (aiError) {
    // AI processing failed
    const errorMessage = aiError instanceof Error ? aiError.message : String(aiError)
    console.error(`[processor] Failed to process bookmark ${bookmarkId}: ${errorMessage}`)

    // If we have extracted content, save it even without AI results
    if (extractedContent) {
      debugLog(`[processor] Saving extracted content despite AI failure`)
      const { error: partialUpdateError } = await supabaseAdmin
        .from('bookmarks')
        .update({
          title: extractedContent.title,
          source: extractedContent.source ?? source, // Update source if re-detected
          author: extractedContent.author ?? null,
          author_url: extractedContent.authorUrl ?? null,
          content: extractedContent.content ?? null,
          media_urls: extractedContent.mediaUrls ?? null,
          published_at: extractedContent.publishedAt?.toISOString() ?? null,
          raw_metadata: extractedContent.rawMetadata ?? null,
          processing_status: 'failed' as ProcessingStatus,
          processing_error: `AI processing failed: ${errorMessage}`,
          extraction_error: extractionError,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', bookmarkId)

      if (partialUpdateError) {
        console.error(`[processor] Failed to process bookmark ${bookmarkId}: ${partialUpdateError.message}`)
        throw aiError
      }

      // Content was saved successfully - don't re-throw
      // The bookmark has useful content even without AI categorization
      await job.updateProgress(100)
      console.log(`[processor] Successfully processed bookmark ${bookmarkId}`)
      return
    }

    // No extracted content and AI failed - mark as failed and throw
    await updateStatus(bookmarkId, 'failed', `Processing failed: ${errorMessage}`, extractionError)
    throw aiError
  }
}
