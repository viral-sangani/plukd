import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import type { ModelMessage, ImagePart, TextPart } from 'ai'

import type { ExtractedContent, ProcessingResult, ExtractedResource } from '@plukd/shared'

/**
 * Minimum content length required for AI processing.
 * Content shorter than this is considered insufficient.
 */
const MINIMUM_CONTENT_LENGTH = 100

/**
 * Minimum content length for carousel posts.
 * Carousels often have short captions but rich visual content.
 */
const MINIMUM_CAROUSEL_CONTENT_LENGTH = 20

/**
 * Minimum number of images required for carousel relaxed processing.
 */
const MINIMUM_CAROUSEL_IMAGES = 2

/**
 * Placeholder message shown when content extraction fails or returns minimal content.
 * This is user-friendly and actionable.
 */
export const INSUFFICIENT_CONTENT_BLURB =
  'Content extraction in progress. Please check back later or visit the URL directly.'

/**
 * Symbol indicating that content was insufficient for AI processing.
 * Used by the bookmark processor to handle this case specially.
 */
export const INSUFFICIENT_CONTENT_MARKER = '__INSUFFICIENT_CONTENT__'

/**
 * Result type for content sufficiency check.
 */
export interface ContentSufficiencyResult {
  isSufficient: boolean
  reason?: string
  isCarouselRelaxed?: boolean
}

/**
 * Detect if content is an Instagram carousel from rawMetadata.
 * Returns the number of carousel images if detected, 0 otherwise.
 *
 * @param content - The extracted content
 * @returns Number of carousel images (0 if not a carousel)
 */
function detectCarouselImageCount(content: ExtractedContent): number {
  const instagram = content.rawMetadata?.instagram
  if (!instagram || typeof instagram !== 'object') {
    return 0
  }

  const instagramMeta = instagram as {
    isCarousel?: boolean
    carouselItems?: Array<{ url?: string }>
  }

  if (!instagramMeta.isCarousel || !instagramMeta.carouselItems) {
    return 0
  }

  return instagramMeta.carouselItems.length
}

/**
 * Check if extracted content has sufficient information for AI processing.
 *
 * Content is considered insufficient if:
 * 1. Content text is shorter than MINIMUM_CONTENT_LENGTH characters
 *    (or MINIMUM_CAROUSEL_CONTENT_LENGTH for carousel posts with 2+ images)
 * 2. Content matches the fallback pattern "Content from {url}"
 * 3. Content is just the URL itself
 * 4. Content is empty or only whitespace
 *
 * Carousel posts get relaxed requirements because:
 * - They often have minimal captions but rich visual content
 * - The AI can analyze images to extract information
 * - Short captions like "Save these!" are common but still valuable
 *
 * @param content - The extracted content to check
 * @returns Object indicating if content is sufficient and reason if not
 */
export function isContentSufficient(content: ExtractedContent): ContentSufficiencyResult {
  const contentText = content.content?.trim() || ''

  // Detect carousel content for relaxed requirements
  const carouselImageCount = detectCarouselImageCount(content)
  const isCarousel = carouselImageCount >= MINIMUM_CAROUSEL_IMAGES
  const minimumLength = isCarousel ? MINIMUM_CAROUSEL_CONTENT_LENGTH : MINIMUM_CONTENT_LENGTH

  // TEMPORARY DEBUG: Log content sufficiency check
  console.log(`[DEBUG:AI] Content sufficiency check:`)
  console.log(`[DEBUG:AI]   content length: ${contentText.length} chars`)
  console.log(`[DEBUG:AI]   content (first 100): "${contentText.slice(0, 100)}"`)
  console.log(`[DEBUG:AI]   isCarousel: ${isCarousel} (${carouselImageCount} images)`)
  console.log(`[DEBUG:AI]   minimum required: ${minimumLength} chars${isCarousel ? ' (carousel relaxed)' : ''}`)

  // Check for empty or whitespace-only content
  if (contentText.length === 0) {
    console.log(`[DEBUG:AI]   result: INSUFFICIENT - content is empty`)
    return { isSufficient: false, reason: 'Content is empty' }
  }

  // Check for content that's just the URL
  if (contentText === content.url) {
    console.log(`[DEBUG:AI]   result: INSUFFICIENT - content is just the URL`)
    return { isSufficient: false, reason: 'Content is just the URL' }
  }

  // Check for fallback placeholder pattern
  if (contentText.startsWith('Content from ')) {
    console.log(`[DEBUG:AI]   result: INSUFFICIENT - content is a fallback placeholder`)
    return { isSufficient: false, reason: 'Content is a fallback placeholder' }
  }

  // Check for minimum length (after trimming)
  // Use relaxed minimum for carousel posts with sufficient images
  if (contentText.length < minimumLength) {
    console.log(`[DEBUG:AI]   result: INSUFFICIENT - content too short`)
    return {
      isSufficient: false,
      reason: `Content too short (${contentText.length} chars, minimum ${minimumLength}${isCarousel ? ' for carousel' : ''})`,
    }
  }

  // Log if using carousel relaxed processing
  if (isCarousel && contentText.length < MINIMUM_CONTENT_LENGTH) {
    console.log(`[DEBUG:AI]   result: SUFFICIENT (carousel relaxed - ${carouselImageCount} images allow shorter content)`)
    return { isSufficient: true, isCarouselRelaxed: true }
  }

  console.log(`[DEBUG:AI]   result: SUFFICIENT`)
  return { isSufficient: true }
}
import {
  buildClassificationPrompt,
  buildSummarizationPrompt,
  buildListExtractionPrompt,
  getValidImageUrls,
  detectListIndicators,
  validateListExtraction,
  normalizeCategory,
  MAX_CAROUSEL_IMAGES,
  type ListIndicators,
  type ListExtractionResult,
  type CarouselInfo,
} from './prompts'
import {
  classificationSchema,
  summarizationSchema,
  listExtractionSchema,
  batchExtractionSchema,
  type ClassificationResult,
  type SummarizationResult,
  type BatchExtractionResult,
} from './schemas'

/**
 * Detect if content is an Instagram carousel and return carousel info.
 * Checks rawMetadata.instagram.isCarousel and carouselItems.
 *
 * @param content - The extracted content
 * @returns CarouselInfo if carousel detected, undefined otherwise
 */
function detectCarouselContent(content: ExtractedContent): CarouselInfo | undefined {
  const instagram = content.rawMetadata?.instagram
  if (!instagram || typeof instagram !== 'object') {
    return undefined
  }

  const instagramMeta = instagram as {
    isCarousel?: boolean
    carouselItems?: Array<{ url?: string }>
  }

  if (!instagramMeta.isCarousel) {
    return undefined
  }

  const totalImages = instagramMeta.carouselItems?.length ?? 0
  if (totalImages === 0) {
    return undefined
  }

  // Calculate how many images we can actually analyze (capped at MAX_CAROUSEL_IMAGES)
  const visibleImages = Math.min(totalImages, MAX_CAROUSEL_IMAGES)

  return {
    isCarousel: true,
    totalImages,
    visibleImages,
  }
}

/**
 * Get the appropriate image limit based on carousel detection.
 *
 * @param carouselInfo - Optional carousel information
 * @returns Image limit to use for multimodal prompts
 */
function getImageLimit(carouselInfo?: CarouselInfo): number {
  if (carouselInfo?.isCarousel) {
    return MAX_CAROUSEL_IMAGES
  }
  return 4 // Default MAX_IMAGES
}

/**
 * Batch extraction prompt for additional carousel images.
 * Used when carousel has more than MAX_CAROUSEL_IMAGES slides.
 */
function buildBatchExtractionPrompt(
  content: ExtractedContent,
  batchNumber: number,
  totalBatches: number,
  imagesInBatch: number
): string {
  return `You are extracting resources from carousel images (batch ${batchNumber} of ${totalBatches}).

CONTEXT:
- Title: ${content.title}
- Source: Instagram carousel
- This batch contains images ${(batchNumber - 1) * MAX_CAROUSEL_IMAGES + 1} to ${(batchNumber - 1) * MAX_CAROUSEL_IMAGES + imagesInBatch}

TASK: Extract ALL items visible in these ${imagesInBatch} carousel images.

For each item found:
- name: The exact name shown (e.g., "Mixo.io", "Claude")
- description: The tagline or description visible (e.g., "Launch websites in seconds")
- category: Classify as tool, app, book, movie, show, podcast, course, or resource

CRITICAL INSTRUCTIONS:
1. READ ALL TEXT from every image using OCR
2. Each slide typically shows 1-3 items with format: "Number. Name - Description"
3. Extract from ALL ${imagesInBatch} images - do not skip any slides
4. Include item numbers if visible (e.g., "#15", "15/")

Respond in JSON only:
{"extractedResources":[{"name":"...","description":"...","category":"..."}]}`
}

/**
 * Extract resources from a batch of carousel images.
 * Used for large carousels that exceed MAX_CAROUSEL_IMAGES.
 *
 * @param content - The extracted content
 * @param imageUrls - Array of image URLs for this batch
 * @param batchNumber - Current batch number (1-indexed)
 * @param totalBatches - Total number of batches
 * @returns Extracted resources from this batch
 */
async function extractBatchResources(
  content: ExtractedContent,
  imageUrls: string[],
  batchNumber: number,
  totalBatches: number
): Promise<BatchExtractionResult> {
  const prompt = buildBatchExtractionPrompt(
    content,
    batchNumber,
    totalBatches,
    imageUrls.length
  )

  const messages = buildMultimodalMessage(prompt, imageUrls)

  const { object } = await generateObject({
    model: google('gemini-3-pro-preview'),
    schema: batchExtractionSchema,
    messages,
  })

  return object
}

/**
 * Process additional carousel batches for large carousels (>10 images).
 * Extracts resources from images beyond the first batch.
 *
 * @param content - The extracted content
 * @param carouselInfo - Carousel information with total image count
 * @returns Array of extracted resources from additional batches
 */
async function processAdditionalCarouselBatches(
  content: ExtractedContent,
  carouselInfo: CarouselInfo
): Promise<ExtractedResource[]> {
  if (!carouselInfo.isCarousel || carouselInfo.totalImages <= MAX_CAROUSEL_IMAGES) {
    return []
  }

  const allImageUrls = getValidImageUrls(content.mediaUrls, carouselInfo.totalImages)

  // Calculate batches needed for remaining images
  const remainingImages = allImageUrls.slice(MAX_CAROUSEL_IMAGES)
  if (remainingImages.length === 0) {
    return []
  }

  const totalBatches = Math.ceil(carouselInfo.totalImages / MAX_CAROUSEL_IMAGES)
  const additionalResources: ExtractedResource[] = []

  console.log(
    `[AI] Processing ${remainingImages.length} additional carousel images ` +
      `in ${totalBatches - 1} batch(es)`
  )

  // Process each additional batch
  for (let batchIndex = 1; batchIndex < totalBatches; batchIndex++) {
    const startIdx = (batchIndex - 1) * MAX_CAROUSEL_IMAGES
    const batchUrls = remainingImages.slice(startIdx, startIdx + MAX_CAROUSEL_IMAGES)

    if (batchUrls.length === 0) continue

    try {
      console.log(`[AI] Processing batch ${batchIndex + 1}/${totalBatches} (${batchUrls.length} images)`)

      const batchResult = await extractBatchResources(
        content,
        batchUrls,
        batchIndex + 1,
        totalBatches
      )

      if (batchResult.extractedResources?.length > 0) {
        // Normalize categories
        const normalizedResources = batchResult.extractedResources.map((r) => ({
          ...r,
          category: r.category ? normalizeCategory(r.category) : undefined,
        }))
        additionalResources.push(...normalizedResources)
        console.log(`[AI] Batch ${batchIndex + 1} extracted ${normalizedResources.length} resources`)
      }
    } catch (error) {
      console.warn(`[AI] Batch ${batchIndex + 1} extraction failed:`, error)
      // Continue with other batches
    }
  }

  return additionalResources
}

/**
 * Build a multimodal message with text and optional images.
 * Uses the Vercel AI SDK message format for generateObject.
 *
 * @param text - The text prompt
 * @param imageUrls - Optional array of validated image URLs
 * @returns A ModelMessage array with multimodal content
 */
function buildMultimodalMessage(
  text: string,
  imageUrls: string[]
): ModelMessage[] {
  const content: (TextPart | ImagePart)[] = [{ type: 'text', text }]

  // Add image parts for each valid URL
  for (const url of imageUrls) {
    try {
      content.push({
        type: 'image',
        image: new URL(url),
      })
    } catch {
      // Skip invalid URLs silently
      console.warn(`[AI] Skipping invalid image URL: ${url}`)
    }
  }

  return [{ role: 'user', content }]
}

/**
 * Pass 1: Classify content using Gemini Flash.
 *
 * Uses a fast, efficient model to determine:
 * - Category: The primary topic/domain of the content
 * - Tags: Descriptive labels for content format and type
 * - Content Type: The structural format of the content
 *
 * Supports multimodal content: when images are present in the extracted
 * content, they are included in the prompt for visual analysis.
 *
 * Uses adaptive truncation based on list indicators for better detection.
 * For carousel posts, uses higher image limit (10 instead of 4) to capture
 * more content from multi-slide posts.
 *
 * @param content - The extracted content from a URL
 * @param listIndicators - Optional pre-computed list indicators
 * @returns Classification result with category, tags, and contentType
 * @throws Error if classification fails
 *
 * @example
 * ```typescript
 * const classification = await classifyContent(extractedContent)
 * console.log(classification.category) // 'engineering-devops'
 * console.log(classification.tags) // ['tutorial', 'deep-dive']
 * console.log(classification.contentType) // 'article'
 * ```
 */
export async function classifyContent(
  content: ExtractedContent,
  listIndicators?: ListIndicators
): Promise<ClassificationResult> {
  // TEMPORARY DEBUG: Log content.mediaUrls as it enters classifyContent
  console.log(`[DEBUG:AI:CLASSIFY] classifyContent received:`)
  console.log(`[DEBUG:AI:CLASSIFY]   content.mediaUrls: ${content.mediaUrls ? 'defined' : 'undefined'}`)
  console.log(`[DEBUG:AI:CLASSIFY]   content.mediaUrls length: ${content.mediaUrls?.length ?? 0}`)
  if (content.mediaUrls && content.mediaUrls.length > 0) {
    console.log(`[DEBUG:AI:CLASSIFY]   first URL: "${content.mediaUrls[0]?.slice(0, 80)}..."`)
  }

  // Detect carousel content for higher image limit
  const carouselInfo = detectCarouselContent(content)
  const imageLimit = getImageLimit(carouselInfo)

  console.log(`[DEBUG:AI:CLASSIFY]   carouselInfo: ${carouselInfo ? JSON.stringify(carouselInfo) : 'null'}`)
  console.log(`[DEBUG:AI:CLASSIFY]   imageLimit: ${imageLimit}`)

  if (carouselInfo) {
    console.log(
      `[AI] Carousel detected: ${carouselInfo.totalImages} total images, ` +
        `analyzing ${carouselInfo.visibleImages} images`
    )
  }

  // Get valid image URLs from trusted domains with appropriate limit
  const imageUrls = getValidImageUrls(content.mediaUrls, imageLimit)
  const hasImages = imageUrls.length > 0

  // TEMPORARY DEBUG: Log classification input
  console.log(`[DEBUG:AI] Classification input:`)
  console.log(`[DEBUG:AI]   content length: ${content.content?.length ?? 0} chars`)
  console.log(`[DEBUG:AI]   image count: ${imageUrls.length}`)
  console.log(`[DEBUG:AI]   isCarousel: ${carouselInfo?.isCarousel ?? false}`)
  console.log(`[DEBUG:AI]   title: "${content.title?.slice(0, 60) ?? 'null'}"`)

  // Build prompt with image context hint, list indicators, and carousel info
  const prompt = buildClassificationPrompt(content, hasImages, listIndicators, carouselInfo)

  // Use multimodal messages if images are present
  if (hasImages) {
    const messages = buildMultimodalMessage(prompt, imageUrls)

    const { object } = await generateObject({
      model: google('gemini-3-flash-preview'),
      schema: classificationSchema,
      messages,
    })

    // TEMPORARY DEBUG: Log classification result
    console.log(`[DEBUG:AI] Classification result:`)
    console.log(`[DEBUG:AI]   contentType: "${object.contentType}"`)
    console.log(`[DEBUG:AI]   category: "${object.category}"`)
    console.log(`[DEBUG:AI]   tags: ${JSON.stringify(object.tags)}`)

    return object
  }

  // Fall back to simple prompt for text-only content
  const { object } = await generateObject({
    model: google('gemini-3-flash-preview'),
    schema: classificationSchema,
    prompt,
  })

  // TEMPORARY DEBUG: Log classification result
  console.log(`[DEBUG:AI] Classification result:`)
  console.log(`[DEBUG:AI]   contentType: "${object.contentType}"`)
  console.log(`[DEBUG:AI]   category: "${object.category}"`)
  console.log(`[DEBUG:AI]   tags: ${JSON.stringify(object.tags)}`)

  return object
}

/**
 * Pass 2: Summarize content using Gemini Pro.
 *
 * Uses a more capable model for high-quality, nuanced summarization.
 * Receives classification results from Pass 1 to tailor the summary
 * based on content type and category.
 *
 * Supports multimodal content: when images are present in the extracted
 * content, they are included in the prompt for visual analysis. This is
 * especially useful for infographics, guides, and image-based lists.
 *
 * Uses adaptive truncation for list content type.
 * For carousel posts, uses higher image limit (10 instead of 4) to capture
 * more content from multi-slide posts.
 *
 * @param content - The extracted content from a URL
 * @param classification - Results from Pass 1 classification
 * @param listIndicators - Optional list indicators for enhanced extraction
 * @returns Summarization result with blurb and summary
 * @throws Error if summarization fails
 *
 * @example
 * ```typescript
 * const classification = await classifyContent(extractedContent)
 * const summarization = await summarizeContent(extractedContent, classification)
 * console.log(summarization.blurb) // '2-3 sentence summary...'
 * console.log(summarization.summary) // 'Detailed 3-5 paragraph summary...'
 * ```
 */
export async function summarizeContent(
  content: ExtractedContent,
  classification: ClassificationResult,
  listIndicators?: ListIndicators
): Promise<SummarizationResult> {
  // Detect carousel content for higher image limit
  const carouselInfo = detectCarouselContent(content)
  const imageLimit = getImageLimit(carouselInfo)

  // Get valid image URLs from trusted domains with appropriate limit
  const imageUrls = getValidImageUrls(content.mediaUrls, imageLimit)
  const hasImages = imageUrls.length > 0

  // TEMPORARY DEBUG: Log summarization input
  console.log(`[DEBUG:AI] Summarization input:`)
  console.log(`[DEBUG:AI]   content length: ${content.content?.length ?? 0} chars`)
  console.log(`[DEBUG:AI]   image count: ${imageUrls.length}`)
  console.log(`[DEBUG:AI]   contentType from classification: "${classification.contentType}"`)

  // Build prompt with image context hint and list indicators
  const prompt = buildSummarizationPrompt(content, classification, hasImages, listIndicators, carouselInfo)

  // Use multimodal messages if images are present
  if (hasImages) {
    const messages = buildMultimodalMessage(prompt, imageUrls)

    const { object } = await generateObject({
      model: google('gemini-3-pro-preview'),
      schema: summarizationSchema,
      messages,
    })

    // TEMPORARY DEBUG: Log summarization result
    console.log(`[DEBUG:AI] Summarization result:`)
    console.log(`[DEBUG:AI]   title: "${object.title?.slice(0, 60) ?? 'null'}"`)
    console.log(`[DEBUG:AI]   blurb length: ${object.blurb?.length ?? 0} chars`)
    console.log(`[DEBUG:AI]   summary length: ${object.summary?.length ?? 0} chars`)
    console.log(`[DEBUG:AI]   extractedResources count: ${object.extractedResources?.length ?? 0}`)

    return object
  }

  // Fall back to simple prompt for text-only content
  const { object } = await generateObject({
    model: google('gemini-3-pro-preview'),
    schema: summarizationSchema,
    prompt,
  })

  // TEMPORARY DEBUG: Log summarization result
  console.log(`[DEBUG:AI] Summarization result:`)
  console.log(`[DEBUG:AI]   title: "${object.title?.slice(0, 60) ?? 'null'}"`)
  console.log(`[DEBUG:AI]   blurb length: ${object.blurb?.length ?? 0} chars`)
  console.log(`[DEBUG:AI]   summary length: ${object.summary?.length ?? 0} chars`)
  console.log(`[DEBUG:AI]   extractedResources count: ${object.extractedResources?.length ?? 0}`)

  return object
}

/**
 * Pass 3: Dedicated list extraction using Gemini Pro.
 *
 * Only runs for content classified as "list" type.
 * Uses FULL content (no truncation) for maximum extraction accuracy.
 * Includes multimodal analysis for carousel images.
 * Includes validation to ensure all items were captured.
 *
 * @param content - The extracted content from a URL (full, not truncated)
 * @param listIndicators - List indicators with estimated item count
 * @returns List extraction result with all resources and validation
 * @throws Error if extraction fails
 */
export async function extractListItems(
  content: ExtractedContent,
  listIndicators: ListIndicators
): Promise<ListExtractionResult> {
  // Detect carousel content for higher image limit
  const carouselInfo = detectCarouselContent(content)
  const imageLimit = getImageLimit(carouselInfo)

  // Get valid image URLs with appropriate limit
  const imageUrls = getValidImageUrls(content.mediaUrls, imageLimit)
  const hasImages = imageUrls.length > 0

  // Build dedicated list extraction prompt using full content
  const prompt = buildListExtractionPrompt(content, listIndicators, hasImages)

  let object: ListExtractionResult

  // Use multimodal messages if images are present (for OCR extraction from carousel)
  if (hasImages) {
    const messages = buildMultimodalMessage(prompt, imageUrls)

    const result = await generateObject({
      model: google('gemini-3-pro-preview'),
      schema: listExtractionSchema,
      messages,
    })

    object = result.object
  } else {
    // Fall back to simple prompt for text-only content
    const result = await generateObject({
      model: google('gemini-3-pro-preview'),
      schema: listExtractionSchema,
      prompt,
    })

    object = result.object
  }

  // Normalize categories in extracted resources
  if (object.extractedResources) {
    object.extractedResources = object.extractedResources.map((resource: ExtractedResource) => ({
      ...resource,
      category: resource.category ? normalizeCategory(resource.category) : undefined,
    }))
  }

  // Validate extraction completeness
  const validation = validateListExtraction(
    listIndicators.estimatedItemCount,
    object.extractedResources || []
  )

  if (!validation.isValid) {
    console.warn(`[AI] List extraction incomplete: ${validation.warning}`)
  } else if (validation.warning) {
    console.log(`[AI] List extraction: ${validation.warning}`)
  }

  return object
}

/**
 * Process extracted content using a multi-pass AI pipeline.
 *
 * Pass 0 (Pre-check): Validates content sufficiency before AI processing
 * Pass 1 (Classification): Uses Gemini Flash for fast categorization
 * Pass 2 (Summarization): Uses Gemini Pro for high-quality summaries
 * Pass 3 (List Extraction): Optional dedicated pass for list content using full content
 *
 * This multi-pass approach optimizes for both speed and quality:
 * - Pre-check avoids wasting API calls on insufficient content
 * - Pre-classification list detection enables adaptive truncation
 * - Classification is a simpler task that benefits from a faster model
 * - Summarization is more nuanced and benefits from a more capable model
 * - Dedicated list extraction uses full content for maximum accuracy
 * - Results are compared and the best extraction is used
 *
 * @param content - The extracted content from a URL
 * @returns Structured processing result with category, tags, blurb, and summary.
 *          If content is insufficient, returns a result with INSUFFICIENT_CONTENT_MARKER
 *          in the summary field.
 *
 * @example
 * ```typescript
 * const result = await processContent({
 *   url: 'https://example.com/article',
 *   source: 'web',
 *   title: 'Example Article',
 *   content: 'Article content here...',
 * })
 * console.log(result.category) // 'engineering-devops'
 * console.log(result.tags) // ['tutorial', 'deep-dive']
 * console.log(result.blurb) // 'Concise summary...'
 * console.log(result.summary) // 'Detailed summary...'
 * ```
 */
export async function processContent(
  content: ExtractedContent
): Promise<ProcessingResult> {
  // Pass 0: Check if content is sufficient for AI processing
  const sufficiencyCheck = isContentSufficient(content)
  if (!sufficiencyCheck.isSufficient) {
    console.log(`[AI] Skipping AI processing: ${sufficiencyCheck.reason}`)
    // Return a special result indicating insufficient content
    // The bookmark processor will handle this case specially
    return {
      category: null as unknown as ProcessingResult['category'],
      tags: [],
      blurb: INSUFFICIENT_CONTENT_BLURB,
      summary: INSUFFICIENT_CONTENT_MARKER,
      contentType: 'other',
    }
  }

  // Pre-pass: Detect list indicators from full content (including transcript)
  const fullText = content.content + (content.transcript ? `\n\n${content.transcript}` : '')
  const listIndicators = detectListIndicators(fullText)

  if (listIndicators.isLikelyList) {
    console.log(
      `[AI] List detected: ~${listIndicators.estimatedItemCount} items ` +
        `(${listIndicators.confidence} confidence, patterns: ${listIndicators.patterns.join(', ')})`
    )
  }

  // Pass 1: Classification with Gemini Flash (with list indicators for adaptive truncation)
  const classification = await classifyContent(content, listIndicators)

  // Pass 2: Summarization with Gemini Pro (uses classification context and list indicators)
  const summarization = await summarizeContent(content, classification, listIndicators)

  // Detect carousel for potential batch processing
  const carouselInfo = detectCarouselContent(content)

  // Pass 3 (conditional): Dedicated list extraction for list content
  let extractedResources = summarization.extractedResources
  let resourceLayoutHint = summarization.resourceLayoutHint

  if (classification.contentType === 'list') {
    try {
      console.log('[AI] Running dedicated list extraction pass...')
      // TEMPORARY DEBUG: Log list extraction trigger
      console.log(`[DEBUG:AI] List extraction triggered:`)
      console.log(`[DEBUG:AI]   contentType: "${classification.contentType}"`)
      console.log(`[DEBUG:AI]   estimated items: ${listIndicators.estimatedItemCount}`)
      const listExtraction = await extractListItems(content, listIndicators)
      // TEMPORARY DEBUG: Log list extraction result
      console.log(`[DEBUG:AI] List extraction result:`)
      console.log(`[DEBUG:AI]   extractedResources count: ${listExtraction.extractedResources?.length ?? 0}`)

      // Use dedicated extraction if it found more items or summarization didn't extract any
      const summarizationCount = summarization.extractedResources?.length || 0
      const dedicatedCount = listExtraction.extractedResources?.length || 0

      if (dedicatedCount > summarizationCount) {
        console.log(
          `[AI] Using dedicated extraction (${dedicatedCount} items) ` +
            `over summarization extraction (${summarizationCount} items)`
        )
        extractedResources = listExtraction.extractedResources
        resourceLayoutHint = listExtraction.resourceLayoutHint
      } else {
        console.log(
          `[AI] Keeping summarization extraction (${summarizationCount} items) ` +
            `over dedicated extraction (${dedicatedCount} items)`
        )
      }
    } catch (error) {
      // Log but don't fail - summarization extraction is still usable
      console.warn('[AI] Dedicated list extraction failed, using summarization results:', error)
    }
  }

  // Pass 4 (conditional): Batch processing for large carousels (>10 images)
  if (
    carouselInfo?.isCarousel &&
    carouselInfo.totalImages > MAX_CAROUSEL_IMAGES &&
    classification.contentType === 'list'
  ) {
    try {
      const additionalResources = await processAdditionalCarouselBatches(content, carouselInfo)

      if (additionalResources.length > 0) {
        // Merge with existing resources, avoiding duplicates by name
        const existingNames = new Set(
          (extractedResources || []).map((r) => r.name.toLowerCase().trim())
        )

        const newResources = additionalResources.filter(
          (r) => !existingNames.has(r.name.toLowerCase().trim())
        )

        if (newResources.length > 0) {
          extractedResources = [...(extractedResources || []), ...newResources]
          console.log(
            `[AI] Added ${newResources.length} resources from additional carousel batches ` +
              `(total: ${extractedResources.length})`
          )
        }
      }
    } catch (error) {
      console.warn('[AI] Additional carousel batch processing failed:', error)
    }
  }

  // Combine results from all passes
  return {
    category: classification.category,
    tags: classification.tags,
    blurb: summarization.blurb,
    summary: summarization.summary,
    contentType: classification.contentType,
    keyTakeaways: summarization.keyTakeaways,
    extractedResources,
    resourceLayoutHint,
  }
}

/**
 * Process content with retry logic for transient failures.
 * Useful for production environments where network issues may occur.
 *
 * Retries the entire two-pass pipeline on failure. If only one pass
 * fails, both are retried to ensure consistency between classification
 * and summarization.
 *
 * @param content - The extracted content from a URL
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Structured AI processing result
 * @throws Error if all retry attempts fail
 */
export async function processContentWithRetry(
  content: ExtractedContent,
  maxRetries: number = 3
): Promise<ProcessingResult> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await processContent(content)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw new Error(
    `AI processing failed after ${maxRetries} attempts: ${lastError?.message}`
  )
}

// Re-export types for convenience
export type { ClassificationResult, SummarizationResult } from './schemas'
export type AIProcessingResult = ProcessingResult
