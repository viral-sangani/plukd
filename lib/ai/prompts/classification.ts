import type { ExtractedContent, ContentSource } from '@/types'
import { CATEGORIES, TAGS } from '@/lib/constants'

/**
 * Content type for classification - helps AI understand what kind of content this is
 */
export type ContentType =
  | 'thread'
  | 'article'
  | 'video'
  | 'discussion'
  | 'announcement'
  | 'other'

/**
 * Result from Pass 1 classification (Flash model)
 */
export interface ClassificationResult {
  category: (typeof CATEGORIES)[number]
  tags: (typeof TAGS)[number][]
  contentType: ContentType
}

/**
 * Input for classification prompt
 */
interface ClassificationInput {
  title: string
  url: string
  source: ContentSource
  content: string // truncated to 2000 chars
}

/**
 * Get content-type hints based on the source platform
 */
function getSourceHints(source: ContentSource): string {
  switch (source) {
    case 'twitter':
      return `- Twitter/X content: likely a thread if multiple connected posts, announcement if from official account, discussion if replies-heavy`
    case 'reddit':
      return `- Reddit content: discussion if post has significant comments, announcement if from moderator/official, article if long-form text post`
    case 'youtube':
      return `- YouTube content: always video type, check if tutorial/guide vs entertainment vs news`
    case 'linkedin':
      return `- LinkedIn content: often announcements (job/company news), discussions (industry debates), or articles (thought leadership)`
    case 'web':
      return `- Web content: article if blog/news site, discussion if forum, announcement if press release, other if tool/resource page`
    default:
      return ''
  }
}

/**
 * Builds the classification prompt for Pass 1 (Flash model).
 * Designed to be concise for quick categorization.
 *
 * @param content - Extracted content with truncated text (2000 chars max)
 * @returns Prompt string for classification
 */
export function buildClassificationPrompt(content: ExtractedContent): string {
  const categoryList = CATEGORIES.join(', ')
  const tagList = TAGS.join(', ')
  const sourceHints = getSourceHints(content.source)

  // Truncate content to 2000 chars for classification
  const truncatedContent = content.content.slice(0, 2000)

  const input: ClassificationInput = {
    title: content.title,
    url: content.url,
    source: content.source,
    content: truncatedContent,
  }

  return `Classify this ${input.source} content for a bookmarking app.

Title: ${input.title}
URL: ${input.url}
Source: ${input.source}

Content (preview):
${input.content}${content.content.length > 2000 ? '...' : ''}

Classify into:

1. CATEGORY (pick ONE):
${categoryList}

2. TAGS (pick 2-5):
${tagList}

3. CONTENT_TYPE (pick ONE):
thread, article, video, discussion, announcement, other

Hints:
${sourceHints}
- thread: connected posts/tweets forming a narrative
- article: long-form written content (blog, news, essay)
- video: video content (always for YouTube)
- discussion: comment-heavy, multiple perspectives
- announcement: official news, releases, launches
- other: tools, resources, reference material

Respond in JSON only:
{"category":"...","tags":["..."],"contentType":"..."}`
}

/**
 * Prepares content for classification by truncating to appropriate length
 */
export function prepareForClassification(
  content: ExtractedContent
): ExtractedContent {
  return {
    ...content,
    content: content.content.slice(0, 2000),
  }
}
