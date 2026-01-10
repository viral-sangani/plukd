/**
 * AI Reply Generator Service
 * Generates AI-powered replies for social media content using Google Gemini
 */

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { getToneConfig, type ToneType } from './tone-manager'

/**
 * Media item in a tweet/post
 */
export interface MediaItem {
  url: string
  type: 'image' | 'video'
}

/**
 * Tweet in a thread or reply chain
 */
export interface Tweet {
  text: string
  author: string
  media?: MediaItem[]
}

/**
 * Context for the tweet/post being replied to
 */
export interface TweetContext {
  text: string
  author: string
  type: 'tweet' | 'reply' | 'thread'
  media?: MediaItem[]
  thread?: Tweet[] // Parent tweets in the conversation
  replies?: Tweet[] // Existing replies from others
}

/**
 * Options for reply generation
 */
export interface ReplyOptions {
  tone?: ToneType
  includeEmoji?: boolean
  additionalInstructions?: string
}

/**
 * Labeled media for AI context
 */
export interface LabeledMedia {
  label: string
  url: string
  type: 'image' | 'video'
}

/**
 * Result of prompt building
 */
export interface PromptResult {
  prompt: string
  labeledMedia: LabeledMedia[]
}

/**
 * Builds a strong system prompt with engagement best practices and tone-specific examples.
 * This sets the meta-level instructions for the AI model.
 *
 * @param tone - The tone type for the reply
 * @returns The system prompt string
 */
export function buildSystemPrompt(tone: ToneType): string {
  const toneConfig = getToneConfig(tone)

  let systemPrompt = `You are an expert social media user who writes authentic, engaging replies that start real conversations.

CORE PRINCIPLES:
- Be SPECIFIC to the post content - reference actual points made
- Start conversations, not just react with "Great post!" or generic praise
- Show genuine curiosity or add unique perspective
- Keep it conversational and natural, never robotic or AI-like
- Match the energy and context of the conversation

ENGAGEMENT TACTICS:
- Ask specific questions that show real interest
- Share relatable experiences or perspectives
- Use mild, thoughtful opinions (not bland agreement)
- Leave room for discussion and follow-up
- When appropriate, end with a question or hook for engagement

AVOID:
- Generic reactions ("This is so true!", "Amazing!", "Love this!")
- Robotic phrases ("As an AI", "I think", "In my opinion")
- Overly long paragraphs or rambling
- Hashtag spam
- Promotional language
- Repeating exactly what the post already said

TONE GUIDANCE: ${toneConfig.description}`

  // Add few-shot examples for this tone
  if (toneConfig.examples && toneConfig.examples.length > 0) {
    systemPrompt += `\n\nEXAMPLES OF THIS TONE:\n${toneConfig.examples.join('\n\n')}`
  }

  systemPrompt += `\n\nNow, write a reply following these principles and the ${tone} tone.`

  return systemPrompt
}

/**
 * Builds the AI prompt and collects labeled media from the entire thread.
 * Returns both the text prompt (with image labels) and an array of labeled media.
 *
 * @param context - The tweet/post context
 * @param options - Reply generation options
 * @returns Prompt result with text and labeled media
 */
export function buildAiPrompt(
  context: TweetContext | null,
  options: ReplyOptions
): PromptResult {
  const tone = options.tone || 'casual'
  const includeEmoji = options.includeEmoji !== false // Default to true if not specified

  // Collect all media across the thread with labels
  const labeledMedia: LabeledMedia[] = []
  let imageIndex = 1

  // Helper to add media with labels
  const collectMedia = (media: MediaItem[] | undefined, source: string): string => {
    if (!media || media.length === 0) return ''
    const labels: string[] = []
    for (const m of media) {
      if (m.type === 'image') {
        const label = `IMAGE_${imageIndex++}`
        labeledMedia.push({ label, url: m.url, type: m.type })
        labels.push(label)
      } else if (m.type === 'video') {
        // Add video with label (AI will receive video poster/thumbnail URL)
        const label = `VIDEO_${imageIndex++}`
        labeledMedia.push({ label, url: m.url, type: m.type })
        labels.push(label)
      }
    }
    return labels.length > 0 ? ` [Attached: ${labels.join(', ')}]` : ''
  }

  let prompt = ''

  if (context) {
    // Collect focal tweet media
    const focalMediaLabel = collectMedia(context.media, 'focal')

    prompt += `ORIGINAL POST CONTEXT (this is what you are replying to):
"${context.text}"${focalMediaLabel}
- Author: @${context.author || 'unknown'}
- Type: ${context.type}
`

    // Add Thread History if available (parent tweets)
    if (context.thread && context.thread.length > 0) {
      const threadLines = context.thread.map((t) => {
        const mediaLabel = collectMedia(t.media, 'thread')
        return `- @${t.author}: "${t.text}"${mediaLabel}`
      })
      prompt += `
THREAD HISTORY (The conversation so far, leading up to the post above):
${threadLines.join('\n')}
`
    }

    // Add Existing Replies if available (what others have already said)
    if (context.replies && context.replies.length > 0) {
      const replyLines = context.replies.map((r) => {
        const mediaLabel = collectMedia(r.media, 'replies')
        return `- @${r.author}: "${r.text}"${mediaLabel}`
      })
      prompt += `
EXISTING REPLIES (What others have said - avoid repeating these points):
${replyLines.join('\n')}
`
    }
  } else {
    prompt += `Write a new post.`
  }

  prompt += `
REQUIREMENTS:
1. Length: Short to medium length (vary naturally)
2. Tone: ${tone} (${getToneConfig(tone).description})
3. Human traits:
   - Use contractions (you're, don't, can't)
   - Variable punctuation (sometimes ..., sometimes !!)
   - ${includeEmoji ? 'Use 1-2 relevant emojis' : 'NO emojis'}
   - occasional lowercase start (20% chance) if casual
`

  if (options.additionalInstructions) {
    prompt += `
ADDITIONAL INSTRUCTIONS/TOPIC:
${options.additionalInstructions}
`
  }

  // Add media context note if there are labeled media
  if (labeledMedia.length > 0) {
    const hasImages = labeledMedia.some((m) => m.type === 'image')
    const hasVideos = labeledMedia.some((m) => m.type === 'video')

    let mediaTitle = 'ATTACHED MEDIA:'
    if (hasImages && !hasVideos) mediaTitle = 'ATTACHED IMAGES:'
    if (hasVideos && !hasImages) mediaTitle = 'ATTACHED VIDEOS:'

    prompt += `
${mediaTitle}
The following media is attached to this conversation. Reference them by their labels when relevant.
Labels: ${labeledMedia.map((m) => m.label).join(', ')}
`
  }

  prompt += `
CRITICAL RULES:
- MUST address specific points from the original post - show you actually read it
- Reply/write in the SAME LANGUAGE as the context/topic
- NO hashtags unless specifically asked
- NO "Here is a reply:" prefixes or quotes around output
- Be authentic and conversational, never robotic
- Reference thread history, images, and videos when relevant
- Keep responses concise (aim for 1-3 sentences typically)
`

  return { prompt, labeledMedia }
}

/**
 * Generate an AI reply using Google Gemini
 *
 * @param context - The tweet/post context to reply to
 * @param options - Reply generation options
 * @returns The generated reply text
 * @throws Error if generation fails
 */
export async function generateReply(
  context: TweetContext | null,
  options: ReplyOptions = {}
): Promise<string> {
  const tone = options.tone || 'casual'
  const toneConfig = getToneConfig(tone)

  // Build system prompt and user prompt
  const systemPrompt = buildSystemPrompt(tone)
  const { prompt } = buildAiPrompt(context, options)

  try {
    // Use Gemini Flash for reply generation (fast and cost-effective)
    const { text } = await generateText({
      model: google('gemini-3-flash-preview'),
      system: systemPrompt,
      prompt,
      temperature: toneConfig.temperature,
    })

    // Clean up the response
    const cleanedText = text
      .trim()
      // Remove common AI prefixes
      .replace(/^(Here is a (reply|tweet|response):?\s*)/i, '')
      .replace(/^(Reply:?\s*)/i, '')
      // Remove quotes around the entire response
      .replace(/^["'](.*)["']$/s, '$1')
      .trim()

    return cleanedText
  } catch (error) {
    console.error('[reply-generator] Error generating reply:', error)
    throw new Error(
      `Failed to generate reply: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Generate a reply with retry logic for transient failures
 *
 * @param context - The tweet/post context to reply to
 * @param options - Reply generation options
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns The generated reply text
 * @throws Error if all retry attempts fail
 */
export async function generateReplyWithRetry(
  context: TweetContext | null,
  options: ReplyOptions = {},
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateReply(context, options)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw new Error(
    `Reply generation failed after ${maxRetries} attempts: ${lastError?.message}`
  )
}
