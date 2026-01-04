import type { ExtractedContent, ContentSource, ContentType } from '@plukd/shared'
import { CATEGORIES, TAGS } from '@plukd/shared'

// Re-export ContentType from shared for backward compatibility
export type { ContentType } from '@plukd/shared'

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
 * Trusted domains for image URLs.
 * Only images from these domains will be included in multimodal prompts.
 */
const TRUSTED_IMAGE_DOMAINS = [
  'pbs.twimg.com',
  'abs.twimg.com',
  'video.twimg.com',
  'i.redd.it',
  'i.imgur.com',
  'imgur.com',
  'preview.redd.it',
  'external-preview.redd.it',
  'instagram.com',
  'cdninstagram.com',
  'scontent.cdninstagram.com',
  'scontent-',
  'i.ytimg.com',
  'img.youtube.com',
  'media.licdn.com',
  'static.licdn.com',
]

/**
 * Maximum number of images to include in multimodal prompts.
 * Limits token usage and processing time.
 */
const MAX_IMAGES = 4

/**
 * Check if a URL is from a trusted image domain.
 */
function isTrustedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return TRUSTED_IMAGE_DOMAINS.some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.includes(domain)
    )
  } catch {
    return false
  }
}

/**
 * Filter and limit image URLs to trusted domains.
 * Returns up to MAX_IMAGES URLs from trusted sources.
 */
export function getValidImageUrls(mediaUrls?: string[]): string[] {
  if (!mediaUrls || mediaUrls.length === 0) {
    return []
  }

  return mediaUrls.filter(isTrustedImageUrl).slice(0, MAX_IMAGES)
}

/**
 * Get content-type hints based on the source platform
 */
function getSourceHints(source: ContentSource): string {
  switch (source) {
    case 'twitter':
      return `- Twitter/X content: likely a thread if multiple connected posts, announcement if from official account, discussion if replies-heavy. Check for LIST if sharing multiple recommendations (tools, resources, books)`
    case 'reddit':
      return `- Reddit content: discussion if post has significant comments, announcement if from moderator/official, article if long-form text post. Use LIST if post shares multiple resources/tools/recommendations`
    case 'youtube':
      return `- YouTube content: always video type UNLESS title/description indicates a curated list (e.g., "10 Best...", "Top 5...", "Must-Watch...", "My Favorite...") - then use LIST`
    case 'linkedin':
      return `- LinkedIn content: often announcements (job/company news), discussions (industry debates), or articles (thought leadership). Use LIST if sharing multiple tools/resources/recommendations`
    case 'instagram':
      return `- Instagram content: Reels are often video content. IMPORTANT: If content shares multiple recommendations (movies, books, products, shows, tools, apps) use LIST type. This is common for "top 10" style content`
    case 'web':
      return `- Web content: article if blog/news site, discussion if forum, announcement if press release, other if tool/resource page. Use LIST if the primary purpose is sharing multiple curated items`
    default:
      return ''
  }
}

/**
 * Get image analysis instructions for classification
 */
function getImageAnalysisHints(): string {
  return `
IMAGE ANALYSIS:
- This content includes images. Analyze them for:
  - Text content (screenshots, infographics, guides)
  - Code snippets or technical diagrams
  - Data visualizations or charts
- Consider image content when determining category and tags
- If image contains a list/guide, consider "list" content type`
}

/**
 * Builds the classification prompt for Pass 1 (Flash model).
 * Designed to be concise for quick categorization.
 *
 * @param content - Extracted content with truncated text (2000 chars max)
 * @param hasImages - Whether the content includes images for multimodal analysis
 * @returns Prompt string for classification
 */
export function buildClassificationPrompt(
  content: ExtractedContent,
  hasImages?: boolean
): string {
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

  const imageHints = hasImages ? getImageAnalysisHints() : ''

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
thread, article, video, discussion, announcement, list, other

Hints:
${sourceHints}
${imageHints}

CONTENT TYPE DEFINITIONS:
- thread: connected posts/tweets forming a narrative
- article: long-form written content (blog, news, essay)
- video: video content (YouTube, Reels without list recommendations)
- discussion: comment-heavy, multiple perspectives
- announcement: official news, releases, launches
- list: CURATED COLLECTIONS of multiple recommendations, resources, tools, books, movies, shows, apps. The PRIMARY purpose is sharing multiple specific items. Use this for: "10 Best AI Tools", "Books Every Founder Should Read", "My Top 5 Movies", "Must-Have Apps", "Resources for Learning X"
- other: single tools, resources, reference material (not collections)

IMPORTANT: If the content's main purpose is to share MULTIPLE recommendations or resources, use "list" type. This enables proper extraction of all items.

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
