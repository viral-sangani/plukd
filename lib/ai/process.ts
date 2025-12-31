import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'

import type { ExtractedContent, ProcessingResult } from '@/types'
import { buildClassificationPrompt, buildSummarizationPrompt } from './prompts'
import {
  classificationSchema,
  summarizationSchema,
  type ClassificationResult,
  type SummarizationResult,
} from './schemas'

/**
 * Pass 1: Classify content using Gemini Flash.
 *
 * Uses a fast, efficient model to determine:
 * - Category: The primary topic/domain of the content
 * - Tags: Descriptive labels for content format and type
 * - Content Type: The structural format of the content
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
  const prompt = buildClassificationPrompt(content)

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
  const prompt = buildSummarizationPrompt(content, classification)

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
