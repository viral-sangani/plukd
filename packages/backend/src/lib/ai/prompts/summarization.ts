import type { ExtractedContent, ContentSource } from '@plukd/shared'
import type { ClassificationResult, ContentType } from './classification'

/**
 * Result from Pass 2 summarization (Pro model)
 */
export interface SummarizationResult {
  blurb: string // 2-3 sentences, 50-200 chars
  summary: string // 3-5 paragraphs, 200-1500 chars
}

/**
 * Input for summarization prompt
 */
interface SummarizationInput {
  title: string
  url: string
  source: ContentSource
  content: string // up to 8000 chars
  replies?: string[]
  transcript?: string
  classification: ClassificationResult
}

/**
 * Get content-type specific summarization instructions
 */
function getContentTypeInstructions(
  contentType: ContentType,
  source: ContentSource
): string {
  const baseInstructions: Record<ContentType, string> = {
    thread: `This is a THREAD - summarize the narrative arc:
- Capture the main argument/story progression
- Note key points from each part of the thread
- Highlight any conclusions or calls-to-action`,

    article: `This is an ARTICLE - create a comprehensive summary:
- Lead with the main thesis or news angle
- Cover key arguments, evidence, and examples
- Include notable quotes or data points
- End with conclusions or implications`,

    video: `This is a VIDEO - focus on the spoken content:
- Summarize main topics discussed
- Note key timestamps or sections if apparent
- Capture actionable advice or insights
- Include any demonstrations or examples mentioned`,

    discussion: `This is a DISCUSSION - capture multiple perspectives:
- Summarize the original post/question
- Note the main viewpoints from replies
- Highlight consensus or key disagreements
- Include actionable advice from the community`,

    announcement: `This is an ANNOUNCEMENT - focus on the news:
- Lead with the main news/announcement
- Include key details (dates, features, changes)
- Note implications or next steps
- Capture community/market reaction if available`,

    other: `Summarize this content comprehensively:
- Identify and explain the main purpose
- Cover key information and features
- Note any requirements or prerequisites
- Include practical use cases`,
  }

  const sourceModifiers: Record<ContentSource, string> = {
    twitter: `\n- Keep the informal, conversational tone
- Note any quoted tweets or referenced content`,

    reddit: `\n- Include relevant context from the subreddit
- Capture useful replies with significant upvotes`,

    youtube: `\n- Use transcript for accuracy
- Note video quality/production value if relevant`,

    linkedin: `\n- Maintain professional tone
- Note author's expertise/credentials if mentioned`,

    web: `\n- Note the publication/site context
- Include any author credentials`,
  }

  return baseInstructions[contentType] + (sourceModifiers[source] || '')
}

/**
 * Builds the summarization prompt for Pass 2 (Pro model).
 * Uses classification results to provide context-aware summarization.
 *
 * @param content - Extracted content with full text (up to 8000 chars)
 * @param classification - Results from Pass 1 classification
 * @returns Prompt string for summarization
 */
export function buildSummarizationPrompt(
  content: ExtractedContent,
  classification: ClassificationResult
): string {
  // Truncate content to 8000 chars for summarization
  const truncatedContent = content.content.slice(0, 8000)

  // Build replies section if available
  const repliesSection = content.replies?.length
    ? `\n\nTop Replies/Comments:\n${content.replies
        .slice(0, 5)
        .map((r, i) => `${i + 1}. ${r}`)
        .join('\n')}`
    : ''

  // Build transcript section if available (especially for YouTube)
  const transcriptSection = content.transcript
    ? `\n\nTranscript:\n${content.transcript.slice(0, 5000)}${content.transcript.length > 5000 ? '...(truncated)' : ''}`
    : ''

  const contentTypeInstructions = getContentTypeInstructions(
    classification.contentType,
    content.source
  )

  const input: SummarizationInput = {
    title: content.title,
    url: content.url,
    source: content.source,
    content: truncatedContent,
    replies: content.replies,
    transcript: content.transcript,
    classification,
  }

  return `Summarize this bookmarked content for quick reference when revisiting.

Context from classification:
- Category: ${classification.category}
- Tags: ${classification.tags.join(', ')}
- Content Type: ${classification.contentType}

Title: ${input.title}
Author: ${content.author ?? 'Unknown'}
URL: ${input.url}
Source: ${input.source}

Main Content:
${input.content}${content.content.length > 8000 ? '...(truncated)' : ''}
${repliesSection}${transcriptSection}

${contentTypeInstructions}

Create TWO outputs:

1. BLURB (2-3 sentences, 50-200 characters):
- Hook the reader - make them want to revisit this
- Capture the single most important insight or value
- Be specific, not generic

2. SUMMARY (3-5 paragraphs, 200-1500 characters):
- Provide enough detail for quick reference without re-reading original
- Structure for scannability (key points, takeaways)
- Include specific data, quotes, or examples that are worth remembering
- End with actionable insights or why this matters

Guidelines:
- Write for future-you who saved this and wants to remember why
- Be objective and accurate
- Preserve technical terminology
- For opinions, note they are opinions
- For discussions, represent multiple viewpoints fairly

Respond in JSON only:
{"blurb":"...","summary":"..."}`
}

/**
 * Prepares content for summarization by ensuring appropriate truncation
 */
export function prepareForSummarization(
  content: ExtractedContent
): ExtractedContent {
  return {
    ...content,
    content: content.content.slice(0, 8000),
    transcript: content.transcript?.slice(0, 5000),
    replies: content.replies?.slice(0, 5),
  }
}
