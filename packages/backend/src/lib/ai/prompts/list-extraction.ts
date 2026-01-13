import type { ExtractedContent, ExtractedResource, ResourceLayoutHint } from '@plukd/shared'
import type { ListIndicators } from './classification'

/**
 * Result from dedicated list extraction pass
 */
export interface ListExtractionResult {
  totalItemsMentioned: number
  extractedResources: ExtractedResource[]
  resourceLayoutHint: ResourceLayoutHint
  extractionConfidence: 'complete' | 'partial' | 'uncertain'
}

/**
 * Category normalization map for consistent resource categorization
 */
const CATEGORY_NORMALIZATION: Record<string, string> = {
  // Books
  ebook: 'book',
  audiobook: 'book',
  paperback: 'book',
  hardcover: 'book',
  novel: 'book',
  // Apps/Tools
  webapp: 'tool',
  saas: 'tool',
  website: 'tool',
  software: 'tool',
  extension: 'tool',
  plugin: 'tool',
  // Shows
  'tv show': 'show',
  series: 'show',
  docuseries: 'show',
  documentary: 'show',
  // Movies
  film: 'movie',
  // Podcasts
  'podcast episode': 'podcast',
  // Courses
  tutorial: 'course',
  workshop: 'course',
  bootcamp: 'course',
}

/**
 * Normalizes a resource category to a standard form.
 *
 * @param category - Raw category from extraction
 * @returns Normalized category
 */
export function normalizeCategory(category: string): string {
  const lower = category.toLowerCase().trim()
  return CATEGORY_NORMALIZATION[lower] || lower
}

/**
 * Builds the dedicated list extraction prompt.
 * Uses FULL content (no truncation) for maximum extraction accuracy.
 * Only used for content classified as "list" type.
 *
 * @param content - Extracted content (full, not truncated)
 * @param listIndicators - Pre-computed list indicators with estimated count
 * @param hasImages - Whether the content includes images for multimodal analysis
 * @returns Prompt string for list extraction
 */
export function buildListExtractionPrompt(
  content: ExtractedContent,
  listIndicators: ListIndicators,
  hasImages?: boolean
): string {
  // Use full content - no truncation for list extraction
  const fullContent = content.content
  const transcript = content.transcript || ''

  // Determine expected count message
  const countHint = listIndicators.estimatedItemCount > 0
    ? `EXPECTED ITEMS: Approximately ${listIndicators.estimatedItemCount} items were detected. Ensure you extract ALL of them.`
    : 'EXPECTED ITEMS: Unknown count. Extract every item mentioned.'

  // Add image/carousel-specific OCR instructions
  const imageInstructions = hasImages ? `
IMAGE/CAROUSEL OCR INSTRUCTIONS (CRITICAL):
- If content includes carousel images, you MUST read text from EACH image using OCR
- For "Top X Tools/Books/Movies" posts, each slide typically shows:
  * Item number (e.g., "1/", "2/", "#1", "#2")
  * Tool/item name (e.g., "Mixo.io", "Fireflies.ai")
  * Description/tagline (e.g., "Launch websites in seconds")
  * Sometimes a URL or category tag
- Extract items from ALL visible images - do NOT skip any slides
- If a title says "Top 10 AI Tools" and you only see 8 in text, check images for remaining items

CAROUSEL EXTRACTION EXAMPLE:
For an Instagram carousel titled "Top 10 AI Tools":
- Slide 1 shows: "1/ Mixo.io - Launch websites in seconds"
- Slide 2 shows: "2/ Fireflies.ai - Take online meeting notes"
- Slide 3 shows: "3/ Perplexity - AI-powered search engine"

Extract as:
[
  { "name": "Mixo.io", "description": "Launch websites in seconds", "category": "tool", "url": "https://mixo.io" },
  { "name": "Fireflies.ai", "description": "Take online meeting notes", "category": "tool", "url": "https://fireflies.ai" },
  { "name": "Perplexity", "description": "AI-powered search engine", "category": "tool", "url": "https://perplexity.ai" }
]

` : ''

  return `You are an expert at extracting structured lists from content. Your job is to extract EVERY item mentioned.

TITLE: ${content.title}
SOURCE: ${content.source}
AUTHOR: ${content.author || 'Unknown'}

${countHint}
${imageInstructions}
---
MAIN CONTENT:
${fullContent}
${transcript ? `\n---\nTRANSCRIPT:\n${transcript}` : ''}
---

EXTRACTION TASK:
1. First, COUNT all distinct items/recommendations mentioned in the content AND images
2. Then, extract EACH item with the following structure:
   - name (REQUIRED): The exact name of the item as mentioned
   - description (REQUIRED): 1-2 sentences explaining what it is and WHY it's recommended
   - category: Normalize to one of: book, tool, app, movie, show, podcast, course, game, resource, tip, other
   - url: Only include if explicitly mentioned in the content or visible in images

CATEGORY NORMALIZATION RULES:
- ebook/audiobook/paperback → "book"
- webapp/saas/website/software → "tool"
- tv show/series/docuseries → "show"
- film → "movie"
- tutorial/workshop → "course"

LAYOUT SELECTION (choose ONE that best fits):
- "numbered-steps": For sequential guides, step-by-step processes, ordered tutorials
- "grid": For tools, apps, products with visual elements (icons, logos)
- "accordion": For items naturally grouped by category (e.g., "Books" section, "Tools" section)
- "checklist": For actionable tips, best practices, to-do items
- "cards": For rich media like movies, TV shows, books, podcasts with metadata
- "table": For comparison data, specs, pricing across items
- "simple-list": Default when items are mixed or no clear pattern

EXTRACTION CONFIDENCE:
- "complete": You found all items mentioned (count matches expectation)
- "partial": Some items may be missing (count is less than expected)
- "uncertain": Difficult to determine completeness

CRITICAL RULES:
1. Extract EVERY item - do NOT summarize or skip any
2. If content says "10 tools" or "7 movies", you MUST extract exactly that many
3. READ TEXT FROM ALL IMAGES - carousel slides often contain the actual item names
4. Include context for WHY each item is recommended when available
5. Do NOT invent items not mentioned in the content or images
6. If an item appears multiple times, include it only once
7. For tools/apps, infer URLs from names if obvious (e.g., "Mixo" → "https://mixo.io")

Respond in JSON only:
{
  "totalItemsMentioned": <number>,
  "extractedResources": [
    {"name": "...", "description": "...", "category": "...", "url": "..."},
    ...
  ],
  "resourceLayoutHint": "...",
  "extractionConfidence": "complete|partial|uncertain"
}`
}

/**
 * Validates list extraction results against expected count.
 *
 * @param expected - Expected item count from list indicators
 * @param extracted - Array of extracted resources
 * @returns Validation result with warning if extraction seems incomplete
 */
export function validateListExtraction(
  expected: number,
  extracted: ExtractedResource[]
): { isValid: boolean; warning?: string; completeness: number } {
  const extractedCount = extracted.length

  if (expected <= 0) {
    // No expected count, can't validate
    return { isValid: true, completeness: 1 }
  }

  const completeness = extractedCount / expected

  if (completeness < 0.7) {
    return {
      isValid: false,
      warning: `Expected ~${expected} items but only extracted ${extractedCount} (${Math.round(completeness * 100)}% complete)`,
      completeness,
    }
  }

  if (completeness < 0.9) {
    return {
      isValid: true,
      warning: `Extracted ${extractedCount} of ~${expected} expected items (${Math.round(completeness * 100)}% complete)`,
      completeness,
    }
  }

  return { isValid: true, completeness }
}
