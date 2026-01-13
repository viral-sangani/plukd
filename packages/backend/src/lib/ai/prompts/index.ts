/**
 * Multi-pass AI processing prompts for content classification, summarization, and extraction
 *
 * Pass 1 (Classification): Uses Flash model for quick categorization
 * - Determines category, tags, and content type
 * - Uses adaptive truncation (2000-4000 chars based on list detection)
 *
 * Pass 2 (Summarization): Uses Pro model for quality summaries
 * - Creates blurb and detailed summary
 * - Uses adaptive truncation (8000-15000 chars based on content type)
 *
 * Pass 3 (List Extraction): Optional dedicated pass for list content
 * - Uses full content (no truncation) for maximum extraction accuracy
 * - Only runs when content is classified as "list" type
 */

export {
  buildClassificationPrompt,
  prepareForClassification,
  getValidImageUrls,
  detectListIndicators,
  MAX_CAROUSEL_IMAGES,
  type ClassificationResult,
  type ContentType,
  type ListIndicators,
  type CarouselInfo,
} from './classification'

export {
  buildSummarizationPrompt,
  prepareForSummarization,
  type SummarizationResult,
} from './summarization'

export {
  buildListExtractionPrompt,
  validateListExtraction,
  normalizeCategory,
  type ListExtractionResult,
} from './list-extraction'
