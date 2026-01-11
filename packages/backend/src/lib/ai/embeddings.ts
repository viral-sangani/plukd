import { google } from '@ai-sdk/google'
import { embed } from 'ai'
import type { KeyTakeaway } from '@plukd/shared'

/**
 * Maximum length for embedding input text.
 * text-embedding-004 supports up to 2048 tokens, but we use characters as proxy.
 */
const MAX_EMBEDDING_INPUT_LENGTH = 8000

/**
 * Expected dimension for text-embedding-004 embeddings.
 * This is a fixed value for the model and must be validated.
 */
export const EXPECTED_EMBEDDING_DIMENSION = 768

/**
 * Custom error class for embedding dimension validation failures.
 */
export class EmbeddingDimensionError extends Error {
  constructor(actualDimension: number) {
    super(`Invalid embedding dimension: expected ${EXPECTED_EMBEDDING_DIMENSION}, got ${actualDimension}`)
    this.name = 'EmbeddingDimensionError'
  }
}

/**
 * Validate that an embedding has the expected dimension.
 *
 * @param embedding - The embedding vector to validate
 * @throws EmbeddingDimensionError if dimension is incorrect
 */
function validateEmbeddingDimension(embedding: number[]): void {
  if (embedding.length !== EXPECTED_EMBEDDING_DIMENSION) {
    throw new EmbeddingDimensionError(embedding.length)
  }
}

/**
 * Generate an embedding for bookmark content.
 *
 * Combines title, blurb, summary, and key takeaways into a single
 * text representation optimized for semantic search.
 *
 * @param title - Bookmark title
 * @param blurb - Short summary (2-3 sentences)
 * @param summary - Detailed summary
 * @param keyTakeaways - Optional array of key takeaways
 * @returns 768-dimensional embedding vector
 */
export async function generateBookmarkEmbedding(
  title: string,
  blurb: string,
  summary: string,
  keyTakeaways?: KeyTakeaway[] | null
): Promise<number[]> {
  // Build composite text for embedding
  const parts: string[] = []

  // Title is most important - add with emphasis
  if (title) {
    parts.push(`Title: ${title}`)
  }

  // Blurb provides quick context
  if (blurb) {
    parts.push(`Summary: ${blurb}`)
  }

  // Key takeaways are highly searchable
  if (keyTakeaways && keyTakeaways.length > 0) {
    const takeawayTexts = keyTakeaways.map((t) => t.text).join('; ')
    parts.push(`Key points: ${takeawayTexts}`)
  }

  // Full summary provides detail
  if (summary) {
    parts.push(`Details: ${summary}`)
  }

  // Combine and truncate if needed
  let text = parts.join('\n\n')
  if (text.length > MAX_EMBEDDING_INPUT_LENGTH) {
    text = text.slice(0, MAX_EMBEDDING_INPUT_LENGTH)
  }

  // Generate embedding using Google's text-embedding-004 model
  const { embedding } = await embed({
    model: google.textEmbeddingModel('text-embedding-004'),
    value: text,
  })

  // Validate embedding dimension before returning
  validateEmbeddingDimension(embedding)

  return embedding
}

/**
 * Generate an embedding for a search query.
 *
 * Uses the same model as bookmark embeddings for consistent similarity.
 *
 * @param query - Search query text
 * @returns 768-dimensional embedding vector
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  // Truncate if query is too long (unlikely for search queries)
  const text = query.slice(0, MAX_EMBEDDING_INPUT_LENGTH)

  const { embedding } = await embed({
    model: google.textEmbeddingModel('text-embedding-004'),
    value: text,
  })

  // Validate embedding dimension before returning
  validateEmbeddingDimension(embedding)

  return embedding
}

/**
 * Format embedding as a PostgreSQL vector literal.
 *
 * @param embedding - Array of numbers
 * @returns PostgreSQL vector string literal '[0.1,0.2,...]'
 */
export function formatEmbeddingForPostgres(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}
