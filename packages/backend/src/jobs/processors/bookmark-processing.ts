import { Job } from 'bullmq'
import { BookmarkProcessingJob } from '../queue'
import { supabaseAdmin } from '../../config/supabase'
import { extractContent } from '../../lib/extractors'
import { extractOGMetadata } from '../../lib/extractors/og-metadata'
import { processContentWithRetry } from '../../lib/ai/process'
import {
  generateBookmarkEmbedding,
  formatEmbeddingForPostgres,
  EXPECTED_EMBEDDING_DIMENSION,
} from '../../lib/ai/embeddings'
import { detectSource, generateFallbackTitle } from '@plukd/shared'
import type { ProcessingStatus, ContentSource, ExtractedContent, RawMetadata } from '@plukd/shared'

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
    console.log(`[processor] Attempting OG metadata extraction for: ${url}`)
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
    console.error(`[processor] OG metadata extraction failed: ${errorMessage}`)
    return null
  }
}

/**
 * Update the processing status of a bookmark in the database.
 */
async function updateStatus(
  bookmarkId: string,
  status: ProcessingStatus,
  error?: string
): Promise<void> {
  const { error: updateError } = await supabaseAdmin
    .from('bookmarks')
    .update({
      processing_status: status,
      processing_error: error ?? null,
      updated_at: new Date().toISOString(),
    } as never)
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

  console.log(`[processor] Starting processing for bookmark ${bookmarkId}: ${url}`)

  // Step 1: Update status to processing
  await updateStatus(bookmarkId, 'processing')
  await job.updateProgress(10)

  const source = detectSource(url)
  let extractedContent: ExtractedContent | null = null

  // Step 2: Extract content from URL
  try {
    console.log(`[processor] Extracting content from ${url} (source: ${source})`)
    await job.updateProgress(20)
    extractedContent = await extractContent(url)
    await job.updateProgress(40)

    if (extractedContent) {
      console.log(`[processor] Extracted content: "${extractedContent.title}"`)
    } else {
      console.log(`[processor] Extraction returned null, will try OG metadata extraction`)
    }
  } catch (extractionError) {
    // Log extraction error but continue with fallback for AI processing
    const errorMessage =
      extractionError instanceof Error ? extractionError.message : String(extractionError)
    console.error(`[processor] Extraction failed, continuing with fallback: ${errorMessage}`)
  }

  // Step 2b: Try to enhance with OG metadata for web URLs
  // This handles the case where primary extraction failed or returned null
  if (!extractedContent && source === 'web') {
    extractedContent = await enhanceWithOGMetadata(url, extractedContent, source)
    if (extractedContent) {
      console.log(`[processor] Enhanced with OG metadata: "${extractedContent.title}"`)
    }
  }

  // Step 3: Process content with AI
  try {
    // Use extracted content or fallback
    const contentForAI = extractedContent ?? createFallbackContent(url, source)

    console.log(`[processor] Processing content with AI`)
    await job.updateProgress(50)
    const aiResult = await processContentWithRetry(contentForAI)
    await job.updateProgress(80)

    console.log(
      `[processor] AI processing complete: category=${aiResult.category}, tags=${aiResult.tags.join(', ')}`
    )

    // Step 4: Update bookmark with all processed data
    // Use extracted title, or fall back to a smart title from the URL
    const finalTitle = extractedContent?.title ?? generateFallbackTitle(url, source)
    // Use the detected source (may differ from stored source, e.g., 'instagram' vs 'web')
    const finalSource = extractedContent?.source ?? source
    const { error: updateError } = await supabaseAdmin
      .from('bookmarks')
      .update({
        // Extracted content (or defaults if extraction failed)
        title: finalTitle,
        source: finalSource, // Update source in case it was re-detected (e.g., 'web' -> 'instagram')
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
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', bookmarkId)

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`)
    }

    await job.updateProgress(90)

    // Step 5: Generate and save embedding for semantic search (non-blocking)
    try {
      console.log(`[processor] Generating embedding for bookmark ${bookmarkId}`)
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
        console.log(`[processor] Embedding saved for bookmark ${bookmarkId}`)
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
    console.error(`[processor] AI processing failed: ${errorMessage}`)

    // If we have extracted content, save it even without AI results
    if (extractedContent) {
      console.log(`[processor] Saving extracted content despite AI failure`)
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
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', bookmarkId)

      if (partialUpdateError) {
        console.error(`[processor] Failed to save extracted content: ${partialUpdateError.message}`)
        throw aiError
      }

      // Content was saved successfully - don't re-throw
      // The bookmark has useful content even without AI categorization
      await job.updateProgress(100)
      console.log(`[processor] Saved extracted content for bookmark ${bookmarkId} (AI failed but extraction succeeded)`)
      return
    }

    // No extracted content and AI failed - mark as failed and throw
    await updateStatus(bookmarkId, 'failed', `Processing failed: ${errorMessage}`)
    throw aiError
  }
}
