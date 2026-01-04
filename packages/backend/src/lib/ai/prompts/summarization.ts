import type { ExtractedContent, ContentSource, ExtractedResource, ContentType } from '@plukd/shared'
import type { ClassificationResult } from './classification'

/**
 * Result from Pass 2 summarization (Pro model)
 */
export interface SummarizationResult {
  blurb: string // 2-3 sentences, 50-200 chars
  summary: string // bullet points with **bold** emphasis, 300-1200 chars
  extractedResources?: ExtractedResource[] // Only for list content type
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

    list: `CRITICAL: This is LIST content. Your PRIMARY job is EXTRACTION, not summarization.

You MUST:
- Extract EVERY item mentioned (all 10, 15, 25+ items - do NOT skip any)
- For each item: name (required), description (1-2 sentences), category (book/tool/movie/app/etc.), URL if mentioned
- Do NOT summarize the items - extract them ALL
- Do NOT limit yourself to 5-10 items - get every single one mentioned

The blurb should describe what the list is about.
The summary should give a meta-overview of the collection.
The extracted_resources field MUST contain all individual items as structured data.`,

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

    instagram: `\n- Note the creator/account context if relevant
- Focus on the visual content being described
- Extract and list any recommendations (movies, books, products, etc.) by name
- Include the creator's opinions or recommendations`,

    web: `\n- Note the publication/site context
- Include any author credentials`,
  }

  // Additional instructions for list-based content (applies to all sources)
  const listExtractionInstructions = `

IMPORTANT - List Extraction:
If the content contains recommendations or lists (movies, books, products, tools, tips, etc.):
- Extract and list ALL items mentioned by name
- Include brief context for each item if provided (e.g., genre, why recommended)
- Format as a numbered or bulleted list in the summary
- This is critical for content like "Top 10 movies" or "Best tools for X"`

  return baseInstructions[contentType] + (sourceModifiers[source] || '') + listExtractionInstructions
}

/**
 * Check if content extraction effectively failed
 * (content is empty, minimal, or just a placeholder)
 */
function isExtractionFailed(content: ExtractedContent): boolean {
  const contentText = content.content?.trim() || ''

  // Empty or very short content
  if (contentText.length < 50) return true

  // Generic placeholder patterns
  if (contentText.startsWith('Content from ')) return true
  if (contentText === content.url) return true

  return false
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
  // Check if extraction failed - return simple fallback prompt
  if (isExtractionFailed(content)) {
    return `Content extraction failed for this URL. Return a simple fallback response.

URL: ${content.url}
Source: ${content.source}
Title: ${content.title}

Respond in JSON only:
{"blurb":"Could not extract content from this URL.","summary":"• **Content unavailable** - The page content could not be automatically extracted.\\n• **Visit directly** - Please click the link to view the original content."}`
  }

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

2. SUMMARY (concise bullet points, 300-1200 characters total):
- Use 5-10 bullet points as needed
- Each point: ONE key insight in 1-2 short sentences
- **Bold** only the most critical phrase per point
- Be extremely concise - every word must earn its place
- No filler phrases or lengthy explanations

Format example:
• **Key insight** - brief supporting detail
• **Another point** - minimal context
• **Actionable takeaway** - what to do next

Guidelines:
- Write for future-you who saved this and wants to remember why
- Be objective and accurate - preserve technical terminology
- Keep each bullet scannable at a glance
- For opinions/discussions, represent viewpoints fairly

${classification.contentType === 'list' ? `
3. EXTRACTED_RESOURCES (REQUIRED for list content):
- Extract EVERY item mentioned as a structured array
- Each item: {"name": "...", "description": "...", "category": "...", "url": "..."}
- Categories: book, tool, app, movie, show, podcast, course, resource, other
- Include URLs only if explicitly mentioned in content
- Do NOT skip any items - extract ALL of them

Respond in JSON only:
{"blurb":"...","summary":"...","extractedResources":[{"name":"...","description":"...","category":"...","url":"..."}]}` : `
Respond in JSON only:
{"blurb":"...","summary":"..."}`}`
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
