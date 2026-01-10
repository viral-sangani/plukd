/**
 * AI Reply Routes
 * Handles AI-powered reply generation for social media content
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import {
  generateReplyWithRetry,
  type TweetContext,
  type ReplyOptions,
} from '../lib/ai/reply-generator'
import { getAvailableTones, isValidTone, type ToneType } from '../lib/ai/tone-manager'

export const aiReplyRoutes = new Hono()

// All routes require authentication
aiReplyRoutes.use('*', authMiddleware)

// Schema for media item
const mediaItemSchema = z.object({
  url: z.string().url(),
  type: z.enum(['image', 'video']),
})

// Schema for tweet in thread
const tweetSchema = z.object({
  text: z.string().min(1),
  author: z.string().min(1),
  media: z.array(mediaItemSchema).optional(),
})

// Schema for tweet context
const tweetContextSchema = z.object({
  text: z.string().min(1, 'Tweet text is required'),
  author: z.string().min(1, 'Author is required'),
  type: z.enum(['tweet', 'reply', 'thread']).default('tweet'),
  media: z.array(mediaItemSchema).optional(),
  thread: z.array(tweetSchema).optional(),
  replies: z.array(tweetSchema).optional(),
})

// Schema for reply generation request
const generateReplySchema = z.object({
  context: tweetContextSchema.nullable().optional(),
  tone: z.string().default('casual').refine(isValidTone, {
    message: 'Invalid tone. Must be one of: casual, professional, humorous',
  }),
  includeEmoji: z.boolean().default(true),
  additionalInstructions: z.string().optional(),
})

/**
 * POST /api/ai/generate-reply
 * Generate an AI-powered reply to a tweet/post
 *
 * Request body:
 * - context: TweetContext | null - The tweet/post context (optional for standalone posts)
 * - tone: ToneType - The tone for the reply (default: 'casual')
 * - includeEmoji: boolean - Whether to include emojis (default: true)
 * - additionalInstructions: string - Additional instructions for the AI (optional)
 *
 * Response:
 * - reply: string - The generated reply text
 * - tone: string - The tone used
 * - timestamp: string - ISO timestamp of generation
 */
aiReplyRoutes.post('/generate-reply', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()

    // Validate request body
    const validatedData = generateReplySchema.parse(body)

    // Extract validated data
    const { context, tone, includeEmoji, additionalInstructions } = validatedData

    // Build options
    const options: ReplyOptions = {
      tone: tone as ToneType,
      includeEmoji,
      additionalInstructions,
    }

    // Log generation attempt
    console.log(
      `[ai-reply] Generating reply for user ${user.id} with tone: ${tone}, emoji: ${includeEmoji}`
    )

    // Generate reply with retry logic
    const reply = await generateReplyWithRetry(
      (context as TweetContext) || null,
      options,
      3 // max retries
    )

    return c.json({
      reply,
      tone,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: 'Invalid request data',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        400
      )
    }

    // Handle AI generation errors
    console.error('[ai-reply] Error generating reply:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate reply'

    return c.json(
      {
        error: errorMessage,
      },
      500
    )
  }
})

/**
 * GET /api/ai/tones
 * Get available tones for reply generation
 *
 * Response:
 * - tones: Array<{ value: string, label: string }> - Available tones
 */
aiReplyRoutes.get('/tones', async (c) => {
  try {
    const tones = getAvailableTones()

    return c.json({
      tones,
    })
  } catch (error) {
    console.error('[ai-reply] Error fetching tones:', error)
    return c.json(
      {
        error: 'Failed to fetch tones',
      },
      500
    )
  }
})

/**
 * GET /api/ai/health
 * Health check endpoint for AI reply service
 */
aiReplyRoutes.get('/health', async (c) => {
  return c.json({
    status: 'ok',
    service: 'ai-reply',
    timestamp: new Date().toISOString(),
  })
})
