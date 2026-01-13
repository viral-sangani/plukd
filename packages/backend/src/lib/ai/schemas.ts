import { z } from 'zod'
import type { Category, Tag, ContentType, ExtractedResource, ResourceLayoutHint, KeyTakeaway, TakeawayType } from '@plukd/shared'
import { CATEGORIES, TAGS, CONTENT_TYPES, RESOURCE_LAYOUT_HINTS } from '@plukd/shared'

// Takeaway types for validation
const TAKEAWAY_TYPES = ['action', 'idea', 'reminder', 'reference'] as const

// Re-export from shared for backward compatibility
export type { ContentType } from '@plukd/shared'

/**
 * Schema for Pass 1: Classification
 *
 * Uses Gemini Flash for fast, efficient classification of content into:
 * - Category: The primary topic/domain of the content
 * - Tags: Descriptive labels for content format and type
 * - Content Type: The structural format of the content
 */
export const classificationSchema = z.object({
  category: z.enum(CATEGORIES as unknown as [Category, ...Category[]]),
  tags: z
    .array(z.enum(TAGS as unknown as [Tag, ...Tag[]]))
    .min(2)
    .max(5)
    .describe('2-5 tags that describe the content type and format'),
  contentType: z
    .enum(CONTENT_TYPES as unknown as [ContentType, ...ContentType[]])
    .describe('The structural format of the content'),
})

export type ClassificationResult = z.infer<typeof classificationSchema>

/**
 * Schema for extracted resource (for list-type content)
 */
export const extractedResourceSchema = z.object({
  name: z.string().describe('Name of the resource/item'),
  description: z.string().optional().describe('Brief description (1-2 sentences)'),
  url: z.string().optional().describe('URL if mentioned in content'),
  category: z.string().optional().describe('Type: book, tool, app, movie, show, podcast, course, resource, other'),
})

/**
 * Schema for key takeaway (actionable item)
 */
export const keyTakeawaySchema = z.object({
  text: z
    .string()
    .max(100)
    .describe('Short, actionable takeaway (under 100 chars)'),
  type: z
    .enum(TAKEAWAY_TYPES)
    .describe('Type of takeaway: action (try/do), idea (post/content), reminder (revisit), reference (keep)'),
})

/**
 * Schema for Pass 2: Summarization
 *
 * Uses Gemini Pro for high-quality, nuanced summarization:
 * - Blurb: A concise summary for list view display
 * - Summary: A detailed summary with key insights and takeaways
 * - KeyTakeaways: 3-5 actionable items for quick reference
 * - ExtractedResources: Array of structured resources (for list-type content)
 */
export const summarizationSchema = z.object({
  blurb: z
    .string()
    .min(50)
    .max(300)
    .describe(
      'A concise 2-3 sentence summary for list view display. Should capture the essence of the content.'
    ),
  summary: z
    .string()
    .min(200)
    .max(1500)
    .describe(
      'A concise bullet-point summary with **bold emphasis** on key phrases. 5-10 short bullet points, each 1-2 sentences max.'
    ),
  keyTakeaways: z
    .array(keyTakeawaySchema)
    .min(3)
    .max(5)
    .describe('3-5 actionable takeaways: things to try, post ideas, things to remember, or useful references'),
  extractedResources: z
    .array(extractedResourceSchema)
    .optional()
    .describe('For list-type content: all items/resources mentioned, extracted as structured data'),
  resourceLayoutHint: z
    .enum(RESOURCE_LAYOUT_HINTS as unknown as [ResourceLayoutHint, ...ResourceLayoutHint[]])
    .optional()
    .describe(
      'Suggested layout for displaying extracted resources: ' +
        'numbered-steps (sequential guides), grid (tools/products), ' +
        'accordion (grouped by category), checklist (actionable tips), ' +
        'cards (rich media), table (comparison data), simple-list (default)'
    ),
})

export type SummarizationResult = z.infer<typeof summarizationSchema>

/**
 * Schema for Pass 3: Dedicated List Extraction
 *
 * Uses Gemini Pro with FULL content (no truncation) for maximum extraction accuracy.
 * Only runs for content classified as "list" type.
 * Includes validation metadata for extraction completeness.
 */
export const listExtractionSchema = z.object({
  totalItemsMentioned: z
    .number()
    .int()
    .min(0)
    .describe('Total number of distinct items/resources mentioned in the content'),
  extractedResources: z
    .array(extractedResourceSchema)
    .min(1)
    .describe('All items/resources extracted from the content'),
  resourceLayoutHint: z
    .enum(RESOURCE_LAYOUT_HINTS as unknown as [ResourceLayoutHint, ...ResourceLayoutHint[]])
    .describe('Best layout for displaying these resources'),
  extractionConfidence: z
    .enum(['complete', 'partial', 'uncertain'])
    .describe('Confidence in extraction completeness: complete (all items found), partial (some may be missing), uncertain (difficult to determine)'),
})

export type ListExtractionResult = z.infer<typeof listExtractionSchema>

/**
 * Schema for batch extraction (additional carousel images).
 * Used when carousel has more than MAX_CAROUSEL_IMAGES slides.
 */
export const batchExtractionSchema = z.object({
  extractedResources: z
    .array(extractedResourceSchema)
    .describe('Resources extracted from this batch of carousel images'),
})

export type BatchExtractionResult = z.infer<typeof batchExtractionSchema>

/**
 * Combined result from all passes.
 * This is the final output of the multi-pass AI processing pipeline.
 */
export interface MultiPassProcessingResult {
  // From Pass 1 (Classification)
  category: Category
  tags: Tag[]
  contentType: ContentType
  // From Pass 2 (Summarization)
  blurb: string
  summary: string
  keyTakeaways?: KeyTakeaway[]
  // From Pass 2 or Pass 3 (whichever extracted more)
  extractedResources?: ExtractedResource[]
  resourceLayoutHint?: ResourceLayoutHint
}

/**
 * @deprecated Use MultiPassProcessingResult instead
 */
export interface TwoPassProcessingResult extends MultiPassProcessingResult {}
