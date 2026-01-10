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
 * Content truncation limits for classification
 */
const CLASSIFICATION_LIMIT_DEFAULT = 2000
const CLASSIFICATION_LIMIT_LIST = 4000

/**
 * Result of list indicator detection
 */
export interface ListIndicators {
  isLikelyList: boolean
  estimatedItemCount: number
  confidence: 'high' | 'medium' | 'low'
  patterns: string[]
}

/**
 * Detects list-like patterns in content to improve classification accuracy.
 * Scans full content before truncation to catch list indicators that might be cut off.
 *
 * @param content - Full content text (including transcript if available)
 * @returns Detection result with estimated item count and confidence
 */
export function detectListIndicators(content: string): ListIndicators {
  const fullContent = content.toLowerCase()
  const patterns: string[] = []

  // Pattern 1: Numbered items (1. item, 2) item, #1 item)
  const numberedMatches = fullContent.match(/(?:^|\n)\s*(?:\d+[\.\):]|\#\d+)\s+[a-z]/gm) || []
  if (numberedMatches.length >= 3) patterns.push('numbered-items')

  // Pattern 2: Bullet points (-, *, •)
  const bulletMatches = fullContent.match(/(?:^|\n)\s*[-•*]\s+[a-z]/gm) || []
  if (bulletMatches.length >= 3) patterns.push('bullet-points')

  // Pattern 3: Ordinal words (first, second, third, etc.)
  const ordinalPattern = /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|next|another|finally|lastly)\b/gi
  const ordinalMatches = fullContent.match(ordinalPattern) || []
  if (ordinalMatches.length >= 3) patterns.push('ordinal-words')

  // Pattern 4: List phrases ("top 10", "best 5", "7 tools", etc.)
  const listPhrasePattern = /\b(top\s+\d+|\d+\s+best|best\s+\d+|\d+\s+ways|\d+\s+tips|\d+\s+things|\d+\s+tools|\d+\s+apps|\d+\s+books|\d+\s+movies|\d+\s+shows|my\s+favorite\s+\d+|must[\s-]have|must[\s-]watch|must[\s-]read)\b/gi
  const listPhraseMatches = fullContent.match(listPhrasePattern) || []
  if (listPhraseMatches.length > 0) patterns.push('list-phrases')

  // Pattern 5: Recommendation verbs clustered together
  const recommendPattern = /\b(recommend|suggesting|check\s+out|try\s+this|use\s+this|watch\s+this|read\s+this|here(?:'s|s)\s+my|here\s+are)\b/gi
  const recommendMatches = fullContent.match(recommendPattern) || []
  if (recommendMatches.length >= 2) patterns.push('recommendation-verbs')

  // Pattern 6: Extract explicit count from title/content (e.g., "7 best AI tools")
  const explicitCountMatch = fullContent.match(/\b(\d+)\s+(?:best|top|favorite|must|essential|amazing|incredible|awesome)\b/i)
  const explicitCount = explicitCountMatch ? parseInt(explicitCountMatch[1], 10) : 0

  // Estimate item count from patterns
  const estimatedFromPatterns = Math.max(
    numberedMatches.length,
    bulletMatches.length,
    Math.floor(ordinalMatches.length * 1.5) // Ordinals often don't cover all items
  )

  // Use explicit count if mentioned, otherwise use pattern-based estimate
  const estimatedItemCount = explicitCount > 0 ? explicitCount : estimatedFromPatterns

  // Determine if likely a list and confidence level
  const patternCount = patterns.length
  let isLikelyList = false
  let confidence: 'high' | 'medium' | 'low' = 'low'

  if (patterns.includes('list-phrases') || explicitCount >= 3) {
    // Explicit list phrases or counts are strong indicators
    isLikelyList = true
    confidence = 'high'
  } else if (patternCount >= 2 || estimatedFromPatterns >= 5) {
    // Multiple pattern types or many items found
    isLikelyList = true
    confidence = 'medium'
  } else if (patternCount === 1 && estimatedFromPatterns >= 3) {
    // Single pattern type but enough items
    isLikelyList = true
    confidence = 'low'
  }

  return {
    isLikelyList,
    estimatedItemCount,
    confidence,
    patterns,
  }
}

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
 * Uses adaptive truncation - more content for likely list content.
 *
 * @param content - Extracted content
 * @param hasImages - Whether the content includes images for multimodal analysis
 * @param listIndicators - Optional pre-computed list indicators for adaptive truncation
 * @returns Prompt string for classification
 */
export function buildClassificationPrompt(
  content: ExtractedContent,
  hasImages?: boolean,
  listIndicators?: ListIndicators
): string {
  const categoryList = CATEGORIES.join(', ')
  const tagList = TAGS.join(', ')
  const sourceHints = getSourceHints(content.source)

  // Combine content with transcript for list detection if not already computed
  const fullText = content.content + (content.transcript ? `\n\n${content.transcript}` : '')
  const indicators = listIndicators ?? detectListIndicators(fullText)

  // Use adaptive truncation - more content for likely list content
  const truncationLimit = indicators.isLikelyList
    ? CLASSIFICATION_LIMIT_LIST
    : CLASSIFICATION_LIMIT_DEFAULT
  const truncatedContent = content.content.slice(0, truncationLimit)

  // Add list detection hint if detected
  const listDetectionHint = indicators.isLikelyList
    ? `\nLIST DETECTION: Content appears to contain a list with ~${indicators.estimatedItemCount} items (${indicators.confidence} confidence). Consider using "list" content type.`
    : ''

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
${imageHints}${listDetectionHint}

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
 * Prepares content for classification by truncating to appropriate length.
 * Uses adaptive truncation based on list indicators.
 *
 * @param content - Full extracted content
 * @param listIndicators - Optional pre-computed list indicators
 * @returns Content with appropriately truncated text
 */
export function prepareForClassification(
  content: ExtractedContent,
  listIndicators?: ListIndicators
): ExtractedContent {
  const fullText = content.content + (content.transcript ? `\n\n${content.transcript}` : '')
  const indicators = listIndicators ?? detectListIndicators(fullText)

  const truncationLimit = indicators.isLikelyList
    ? CLASSIFICATION_LIMIT_LIST
    : CLASSIFICATION_LIMIT_DEFAULT

  return {
    ...content,
    content: content.content.slice(0, truncationLimit),
  }
}
