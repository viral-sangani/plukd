import type { ExtractedContent } from '@/types'
import { CATEGORIES, TAGS } from '@/lib/constants'
import type { ClassificationResult } from './schemas'
import { CONTENT_TYPES } from './schemas'

/**
 * Helper to format content sections for prompts.
 */
function formatContentSections(content: ExtractedContent): {
  repliesSection: string
  transcriptSection: string
  truncatedContent: string
} {
  const repliesSection = content.replies?.length
    ? `\nTop Replies/Comments:\n${content.replies
        .slice(0, 5)
        .map((r, i) => `${i + 1}. ${r}`)
        .join('\n')}`
    : ''

  const transcriptSection = content.transcript
    ? `\nTranscript:\n${content.transcript.slice(0, 5000)}${content.transcript.length > 5000 ? '...(truncated)' : ''}`
    : ''

  const truncatedContent = `${content.content.slice(0, 8000)}${content.content.length > 8000 ? '...(truncated)' : ''}`

  return { repliesSection, transcriptSection, truncatedContent }
}

/**
 * Classification prompt examples to guide consistent AI output.
 */
const CLASSIFICATION_EXAMPLES = `
Examples:

1. A Twitter thread explaining how to use React Server Components:
   - Category: frontend
   - Tags: tutorial, thread, guide
   - Content Type: thread

2. A Reddit discussion about the latest Bitcoin ETF approval:
   - Category: crypto
   - Tags: news, discussion
   - Content Type: discussion

3. A YouTube video deep-diving into startup fundraising strategies:
   - Category: fundraising
   - Tags: video, analysis, guide
   - Content Type: video

4. A blog article announcing a new AI model release:
   - Category: ai
   - Tags: news, announcement
   - Content Type: announcement

5. A LinkedIn post sharing lessons from a founder's journey:
   - Category: startups
   - Tags: opinion, showcase
   - Content Type: article
`

/**
 * Builds the prompt for Pass 1: Classification.
 * Uses Gemini Flash for efficient categorization.
 *
 * @param content - The extracted content from a URL
 * @returns Prompt string for classification
 */
export function buildClassificationPrompt(content: ExtractedContent): string {
  const categoryList = CATEGORIES.join(', ')
  const tagList = TAGS.join(', ')
  const contentTypeList = CONTENT_TYPES.join(', ')

  const { repliesSection, transcriptSection, truncatedContent } =
    formatContentSections(content)

  return `You are a content classification assistant for Plukd, a bookmarking app.

Your task is to classify the following content extracted from a ${content.source} link.

Title: ${content.title}
Author: ${content.author ?? 'Unknown'}
URL: ${content.url}

Main Content:
${truncatedContent}
${repliesSection}${transcriptSection}

Classify this content by providing:

1. CATEGORY: Choose exactly ONE category that best describes this content from:
   ${categoryList}

2. TAGS: Choose 2-5 tags that describe the content type and format from:
   ${tagList}

3. CONTENT TYPE: Choose the structural format of this content from:
   ${contentTypeList}
   - "thread" for Twitter/X threads, tweetstorms, or multi-part social posts
   - "article" for blog posts, news articles, long-form written content
   - "video" for YouTube videos, video content with transcripts
   - "discussion" for Reddit posts, forum threads, comment-driven content
   - "announcement" for product launches, releases, official announcements
   - "other" for content that doesn't fit the above categories

${CLASSIFICATION_EXAMPLES}

Guidelines:
- Be precise and consistent with categorization
- Consider the primary topic and audience of the content
- Tags should reflect both the topic AND the format/style of the content
- Content type should match the structural format, not the topic`
}

/**
 * Summarization prompt examples to guide consistent AI output.
 */
const SUMMARIZATION_EXAMPLES = `
Examples of good blurbs:
- "A comprehensive guide to implementing authentication in Next.js using Supabase, covering session management, protected routes, and social auth providers."
- "The founder of Stripe shares lessons from 10 years of building the company, including early mistakes, hiring philosophy, and thoughts on company culture."
- "An in-depth analysis of why the latest GPT model represents a significant leap in reasoning capabilities, with benchmarks and real-world examples."

Examples of good summaries:
- Start with the main thesis or key takeaway
- Include specific examples, data points, or quotes that support the main points
- Cover multiple perspectives if the content is a discussion
- End with actionable insights or implications for the reader
`

/**
 * Builds the prompt for Pass 2: Summarization.
 * Uses Gemini Pro for high-quality, nuanced summaries.
 *
 * @param content - The extracted content from a URL
 * @param classification - Results from Pass 1 classification
 * @returns Prompt string for summarization
 */
export function buildSummarizationPrompt(
  content: ExtractedContent,
  classification: ClassificationResult
): string {
  const { repliesSection, transcriptSection, truncatedContent } =
    formatContentSections(content)

  return `You are a content summarization assistant for Plukd, a bookmarking app.

You are summarizing a ${classification.contentType} in the "${classification.category}" category.
Tags: ${classification.tags.join(', ')}

Content Details:
Title: ${content.title}
Author: ${content.author ?? 'Unknown'}
URL: ${content.url}

Main Content:
${truncatedContent}
${repliesSection}${transcriptSection}

Generate two summaries:

1. BLURB (50-300 characters):
   A concise 2-3 sentence summary that captures the essence of this content.
   This will be shown in a list view, so it should be informative yet brief.
   Focus on the main point, key insight, or primary takeaway.

2. SUMMARY (200-2000 characters):
   A detailed 3-5 paragraph summary that covers:
   - The main points, arguments, or topics discussed
   - Key takeaways and actionable insights
   - Notable quotes, data points, or examples
   - Community reactions or perspectives (if applicable from replies/comments)
   - Implications or recommendations for the reader

${SUMMARIZATION_EXAMPLES}

Guidelines:
- Be objective and informative
- Use clear, professional language
- Preserve the original intent and tone of the content
- For technical content, maintain accuracy of terminology
- For opinion pieces, clearly identify them as such
- For ${classification.contentType}s, adapt the summary style appropriately
- Tailor the depth and focus based on the category: ${classification.category}`
}

/**
 * Legacy function for backward compatibility.
 * @deprecated Use buildClassificationPrompt and buildSummarizationPrompt instead.
 */
export function buildProcessingPrompt(content: ExtractedContent): string {
  const categoryList = CATEGORIES.join(', ')
  const tagList = TAGS.join(', ')

  const { repliesSection, transcriptSection, truncatedContent } =
    formatContentSections(content)

  return `You are a content categorization and summarization assistant for Plukd, a bookmarking app.

Given the following content extracted from a ${content.source} link:

Title: ${content.title}
Author: ${content.author ?? 'Unknown'}
URL: ${content.url}

Main Content:
${truncatedContent}
${repliesSection}${transcriptSection}

Please analyze this content and provide:

1. CATEGORY: Choose exactly ONE category that best describes this content from the following list:
   ${categoryList}

2. TAGS: Choose 1-3 tags that describe the content type and format from the following list:
   ${tagList}

3. BLURB: Write a concise 2-3 sentence summary that captures the essence of this content. This will be shown in a list view, so it should be informative yet brief. Focus on the main point or takeaway.

4. SUMMARY: Write a detailed 3-5 paragraph summary that covers:
   - The main points, arguments, or topics discussed
   - Key takeaways and insights
   - Notable quotes, data points, or examples
   - Community reactions or notable comments (if applicable from replies)
   - Any actionable items or recommendations

Guidelines:
- Be objective and informative
- Use clear, professional language
- Preserve the original intent and tone of the content
- For technical content, maintain accuracy of terminology
- For opinion pieces, clearly identify them as such
- For threads/discussions, summarize the key points from multiple perspectives`
}
