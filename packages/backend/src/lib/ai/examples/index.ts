import type { ContentSource } from '@plukd/shared'
import { twitterExamples, type FewShotExample } from './twitter'
import { redditExamples } from './reddit'
import { articleExamples } from './article'
import { videoExamples } from './video'

export type { FewShotExample }

/**
 * Map of content sources to their corresponding few-shot examples.
 * Web and LinkedIn sources use article examples as the closest match.
 */
const examplesBySource: Record<ContentSource, FewShotExample[]> = {
  twitter: twitterExamples,
  reddit: redditExamples,
  youtube: videoExamples,
  web: articleExamples,
  linkedin: articleExamples, // LinkedIn posts are similar to articles in structure
}

/**
 * Retrieves few-shot examples for a given content source.
 * These examples help guide AI categorization and summarization
 * by demonstrating expected input/output patterns for each source type.
 *
 * @param source - The content source type (twitter, reddit, youtube, web, linkedin)
 * @returns Array of few-shot examples appropriate for the source
 *
 * @example
 * ```typescript
 * const examples = getExamplesBySource('twitter')
 * // Returns 2 Twitter thread examples with input/output pairs
 *
 * const videoExamples = getExamplesBySource('youtube')
 * // Returns 2 YouTube video examples with transcript-based processing
 * ```
 */
export function getExamplesBySource(source: ContentSource): FewShotExample[] {
  return examplesBySource[source] ?? articleExamples
}

/**
 * Retrieves all available few-shot examples across all sources.
 * Useful for training or when source type is unknown.
 *
 * @returns Array of all few-shot examples
 */
export function getAllExamples(): FewShotExample[] {
  return [
    ...twitterExamples,
    ...redditExamples,
    ...articleExamples,
    ...videoExamples,
  ]
}

/**
 * Formats few-shot examples into a prompt-friendly string.
 * Creates a structured representation that can be injected into AI prompts.
 *
 * @param examples - Array of few-shot examples to format
 * @returns Formatted string suitable for prompt injection
 *
 * @example
 * ```typescript
 * const examples = getExamplesBySource('twitter')
 * const formattedExamples = formatExamplesForPrompt(examples)
 * // Returns structured text showing input -> output mappings
 * ```
 */
export function formatExamplesForPrompt(examples: FewShotExample[]): string {
  return examples
    .map(
      (example, index) => `
--- Example ${index + 1} ---

INPUT:
Title: ${example.input.title}
Author: ${example.input.author ?? 'Unknown'}
Source: ${example.input.source}
Content: ${example.input.content}

OUTPUT:
Category: ${example.output.category}
Tags: ${example.output.tags.join(', ')}
Blurb: ${example.output.blurb}
Summary: ${example.output.summary}
`
    )
    .join('\n')
}

// Re-export individual example arrays for direct access
export { twitterExamples } from './twitter'
export { redditExamples } from './reddit'
export { articleExamples } from './article'
export { videoExamples } from './video'
