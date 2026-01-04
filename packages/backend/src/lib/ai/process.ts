import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import type { ModelMessage, ImagePart, TextPart } from 'ai'

import type { ExtractedContent, ProcessingResult } from '@plukd/shared'
import {
  buildClassificationPrompt,
  buildSummarizationPrompt,
  getValidImageUrls,
} from './prompts'
import {
  classificationSchema,
  summarizationSchema,
  type ClassificationResult,
  type SummarizationResult,
} from './schemas'

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
 * @param content - The extracted content from a URL
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
  content: ExtractedContent
): Promise<ClassificationResult> {
  // Get valid image URLs from trusted domains (limited to 4)
  const imageUrls = getValidImageUrls(content.mediaUrls)
  const hasImages = imageUrls.length > 0

  // Build prompt with image context hint
  const prompt = buildClassificationPrompt(content, hasImages)

  // Use multimodal messages if images are present
  if (hasImages) {
    const messages = buildMultimodalMessage(prompt, imageUrls)

    const { object } = await generateObject({
      model: google('gemini-3-flash-preview'),
      schema: classificationSchema,
      messages,
    })

    return object
  }

  // Fall back to simple prompt for text-only content
  const { object } = await generateObject({
    model: google('gemini-3-flash-preview'),
    schema: classificationSchema,
    prompt,
  })

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
 * @param content - The extracted content from a URL
 * @param classification - Results from Pass 1 classification
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
  classification: ClassificationResult
): Promise<SummarizationResult> {
  // Get valid image URLs from trusted domains (limited to 4)
  const imageUrls = getValidImageUrls(content.mediaUrls)
  const hasImages = imageUrls.length > 0

  // Build prompt with image context hint
  const prompt = buildSummarizationPrompt(content, classification, hasImages)

  // Use multimodal messages if images are present
  if (hasImages) {
    const messages = buildMultimodalMessage(prompt, imageUrls)

    const { object } = await generateObject({
      model: google('gemini-3-pro-preview'),
      schema: summarizationSchema,
      messages,
    })

    return object
  }

  // Fall back to simple prompt for text-only content
  const { object } = await generateObject({
    model: google('gemini-3-pro-preview'),
    schema: summarizationSchema,
    prompt,
  })

  return object
}

/**
 * Process extracted content using a two-pass AI pipeline.
 *
 * Pass 1 (Classification): Uses Gemini Flash for fast categorization
 * Pass 2 (Summarization): Uses Gemini Pro for high-quality summaries
 *
 * This two-pass approach optimizes for both speed and quality:
 * - Classification is a simpler task that benefits from a faster model
 * - Summarization is more nuanced and benefits from a more capable model
 * - Pass 2 uses classification context to produce better, targeted summaries
 *
 * @param content - The extracted content from a URL
 * @returns Structured processing result with category, tags, blurb, and summary
 * @throws Error if either AI pass fails
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
  // Pass 1: Classification with Gemini Flash
  const classification = await classifyContent(content)

  // Pass 2: Summarization with Gemini Pro (uses classification context)
  const summarization = await summarizeContent(content, classification)

  // Combine results from both passes
  return {
    category: classification.category,
    tags: classification.tags,
    blurb: summarization.blurb,
    summary: summarization.summary,
    contentType: classification.contentType,
    extractedResources: summarization.extractedResources,
    resourceLayoutHint: summarization.resourceLayoutHint,
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
