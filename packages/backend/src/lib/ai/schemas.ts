import { z } from 'zod'
import type { Category, Tag, ContentType, ExtractedResource, ResourceLayoutHint } from '@plukd/shared'
import { CATEGORIES, TAGS, CONTENT_TYPES, RESOURCE_LAYOUT_HINTS } from '@plukd/shared'

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
 * Schema for Pass 2: Summarization
 *
 * Uses Gemini Pro for high-quality, nuanced summarization:
 * - Blurb: A concise summary for list view display
 * - Summary: A detailed summary with key insights and takeaways
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
 * Combined result from both passes.
 * This is the final output of the two-pass AI processing pipeline.
 */
export interface TwoPassProcessingResult {
  // From Pass 1 (Classification)
  category: Category
  tags: Tag[]
  contentType: ContentType
  // From Pass 2 (Summarization)
  blurb: string
  summary: string
  extractedResources?: ExtractedResource[]
  resourceLayoutHint?: ResourceLayoutHint
}
