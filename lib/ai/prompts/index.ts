/**
 * Two-pass AI processing prompts for content classification and summarization
 *
 * Pass 1 (Classification): Uses Flash model for quick categorization
 * - Determines category, tags, and content type
 * - Uses truncated content (2000 chars) for efficiency
 *
 * Pass 2 (Summarization): Uses Pro model for quality summaries
 * - Creates blurb and detailed summary
 * - Uses full content (8000 chars) and classification context
 */

export {
  buildClassificationPrompt,
  prepareForClassification,
  type ClassificationResult,
  type ContentType,
} from './classification'

export {
  buildSummarizationPrompt,
  prepareForSummarization,
  type SummarizationResult,
} from './summarization'
