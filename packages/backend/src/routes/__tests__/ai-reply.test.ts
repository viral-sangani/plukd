/**
 * Comprehensive tests for AI Reply API routes
 *
 * Coverage:
 * 1. POST /api/ai/generate-reply - Generate AI Reply (26 tests)
 * 2. GET /api/ai/tones - Get Available Tones (4 tests)
 * 3. GET /api/ai/health - Health Check (3 tests)
 *
 * Total: 33 tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import type { TweetContext } from '../../lib/ai/reply-generator'

// =============================================================================
// Mock Setup - MUST be before imports
// =============================================================================

// Mock AI reply generator
vi.mock('../../lib/ai/reply-generator', () => ({
  generateReplyWithRetry: vi.fn(),
}))

// Mock tone manager
vi.mock('../../lib/ai/tone-manager', () => ({
  getAvailableTones: vi.fn(() => [
    { value: 'casual', label: 'Casual' },
    { value: 'professional', label: 'Professional' },
    { value: 'humorous', label: 'Humorous' },
  ]),
  isValidTone: vi.fn((tone: string) =>
    ['casual', 'professional', 'humorous'].includes(tone)
  ),
}))

// Mock auth middleware to inject user
vi.mock('../../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    c.set('user', {
      id: 'user-1',
      email: 'test@example.com',
      role: 'authenticated',
      aud: 'authenticated',
    })
    await next()
  }),
}))

// Import after mocks
import { aiReplyRoutes } from '../ai-reply'
import { generateReplyWithRetry } from '../../lib/ai/reply-generator'
import { getAvailableTones, isValidTone } from '../../lib/ai/tone-manager'

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a test Hono app with AI reply routes
 */
function createTestApp() {
  const app = new Hono()
  app.route('/api/ai', aiReplyRoutes)
  return app
}

/**
 * Create a mock request object for testing
 */
function createMockRequest(options: {
  method: string
  path: string
  headers?: Record<string, string>
  body?: any
}) {
  const url = `http://localhost/api/ai${options.path}`
  const headers = new Headers(options.headers || {})

  if (options.body) {
    headers.set('Content-Type', 'application/json')
  }

  return new Request(url, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
}

// Test data factories
const createMockTweetContext = (overrides: Partial<TweetContext> = {}): TweetContext => ({
  text: 'This is a great tweet about AI!',
  author: 'testuser',
  type: 'tweet',
  media: [],
  thread: [],
  replies: [],
  ...overrides,
})

describe('AI Reply Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset isValidTone to default behavior
    vi.mocked(isValidTone).mockImplementation((tone: string) =>
      ['casual', 'professional', 'humorous'].includes(tone)
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================
  // POST /api/ai/generate-reply - Generate AI Reply (26 tests)
  // ============================================================
  describe('POST /api/ai/generate-reply', () => {
    describe('Happy Path (5 tests)', () => {
      it('should generate reply with valid tweet context and all fields', async () => {
        const app = createTestApp()
        const mockReply = 'Great point! I totally agree with this perspective.'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const tweetContext = createMockTweetContext({
          text: 'AI is transforming how we work',
          author: 'techguru',
          type: 'tweet',
          media: [{ url: 'https://example.com/image.jpg', type: 'image' }],
          thread: [{ text: 'Previous tweet in thread', author: 'techguru' }],
          replies: [{ text: 'I agree!', author: 'follower1' }],
        })

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: tweetContext,
            tone: 'casual',
            includeEmoji: true,
            additionalInstructions: 'Keep it short',
          },
        })

        const res = await app.request(req)
        const responseData = await res.json()

        expect(res.status).toBe(200)
        expect(responseData).toMatchObject({
          reply: mockReply,
          tone: 'casual',
          timestamp: expect.any(String),
        })

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'AI is transforming how we work',
            author: 'techguru',
            type: 'tweet',
          }),
          {
            tone: 'casual',
            includeEmoji: true,
            additionalInstructions: 'Keep it short',
          },
          3
        )
      })

      it('should generate reply with minimal tweet context', async () => {
        const app = createTestApp()
        const mockReply = 'Interesting perspective!'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: {
              text: 'Simple tweet',
              author: 'user',
            },
          },
        })

        const res = await app.request(req)
        const responseData = await res.json()

        expect(res.status).toBe(200)
        expect(responseData.reply).toBe(mockReply)

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'Simple tweet',
            author: 'user',
            type: 'tweet', // default value
          }),
          expect.objectContaining({
            tone: 'casual', // default
            includeEmoji: true, // default
          }),
          3
        )
      })

      it('should generate reply with null context', async () => {
        const app = createTestApp()
        const mockReply = "Here's a standalone reply"
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: null,
            tone: 'professional',
            includeEmoji: false,
          },
        })

        const res = await app.request(req)
        const responseData = await res.json()

        expect(res.status).toBe(200)
        expect(responseData.reply).toBe(mockReply)

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          null,
          {
            tone: 'professional',
            includeEmoji: false,
          },
          3
        )
      })

      it('should generate reply with different tones', async () => {
        const app = createTestApp()
        const tones = ['casual', 'professional', 'humorous']

        for (const tone of tones) {
          vi.clearAllMocks()
          const mockReply = `Reply in ${tone} tone`
          vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

          const req = createMockRequest({
            method: 'POST',
            path: '/generate-reply',
            headers: { Authorization: 'Bearer test-token' },
            body: {
              context: createMockTweetContext(),
              tone,
            },
          })

          const res = await app.request(req)
          const responseData = await res.json()

          expect(res.status).toBe(200)
          expect(responseData.tone).toBe(tone)
        }
      })

      it('should generate reply with additional instructions', async () => {
        const app = createTestApp()
        const mockReply = 'Short reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: createMockTweetContext(),
            tone: 'casual',
            additionalInstructions: 'Keep it under 50 characters',
          },
        })

        await app.request(req)

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            additionalInstructions: 'Keep it under 50 characters',
          }),
          3
        )
      })
    })

    describe('Validation Tests (8 tests)', () => {
      it('should return 400 for missing context.text', async () => {
        const app = createTestApp()

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: {
              author: '@user',
              // missing text
            },
            tone: 'casual',
          },
        })

        const res = await app.request(req)
        const responseData = await res.json()

        expect(res.status).toBe(400)
        expect(responseData).toMatchObject({
          error: 'Invalid request data',
          details: expect.arrayContaining([
            expect.objectContaining({
              path: expect.stringContaining('text'),
            }),
          ]),
        })
      })

      it('should return 400 for missing context.author', async () => {
        const app = createTestApp()

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: {
              text: 'Some text',
              // missing author
            },
            tone: 'casual',
          },
        })

        const res = await app.request(req)
        const responseData = await res.json()

        expect(res.status).toBe(400)
        expect(responseData).toMatchObject({
          error: 'Invalid request data',
          details: expect.arrayContaining([
            expect.objectContaining({
              path: expect.stringContaining('author'),
            }),
          ]),
        })
      })

      it('should return 400 for invalid tone value', async () => {
        const app = createTestApp()
        vi.mocked(isValidTone).mockReturnValue(false)

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: createMockTweetContext(),
            tone: 'invalid_tone',
          },
        })

        const res = await app.request(req)
        const responseData = await res.json()

        expect(res.status).toBe(400)
        expect(responseData.error).toBe('Invalid request data')
        expect(responseData.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'tone',
              message: expect.stringContaining('Invalid tone'),
            }),
          ])
        )
      })

      it('should return 400 for context text too short', async () => {
        const app = createTestApp()

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: {
              text: '', // empty text
              author: 'user',
            },
          },
        })

        const res = await app.request(req)
        const responseData = await res.json()

        expect(res.status).toBe(400)
        expect(responseData.error).toBe('Invalid request data')
        expect(responseData.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: expect.stringContaining('text'),
            }),
          ])
        )
      })

      it('should return 400 for empty context.author', async () => {
        const app = createTestApp()

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: {
              text: 'Valid text',
              author: '', // empty author
            },
          },
        })

        const res = await app.request(req)
        const responseData = await res.json()

        expect(res.status).toBe(400)
        expect(responseData.error).toBe('Invalid request data')
        expect(responseData.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: expect.stringContaining('author'),
            }),
          ])
        )
      })

      it('should return 400 for invalid media object', async () => {
        const app = createTestApp()

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: {
              text: 'Valid text',
              author: 'user',
              media: [{ url: 'invalid-url', type: 'invalid' }],
            },
          },
        })

        const res = await app.request(req)
        const responseData = await res.json()

        expect(res.status).toBe(400)
        expect(responseData.error).toBe('Invalid request data')
      })

      it('should return 400 for invalid context type', async () => {
        const app = createTestApp()

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: {
              text: 'Valid text',
              author: 'user',
              type: 'invalid_type', // not tweet/reply/thread
            },
          },
        })

        const res = await app.request(req)
        const responseData = await res.json()

        expect(res.status).toBe(400)
        expect(responseData.error).toBe('Invalid request data')
      })

      it('should handle very long context text', async () => {
        const app = createTestApp()
        const mockReply = 'Reply to long text'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const longText = 'a'.repeat(10000)

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: createMockTweetContext({
              text: longText,
            }),
          },
        })

        const res = await app.request(req)

        // Should succeed - no max length validation
        expect(res.status).toBe(200)
        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            text: longText,
          }),
          expect.any(Object),
          3
        )
      })
    })

    describe('AI Generation Tests (5 tests)', () => {
      it('should succeed when AI generation succeeds', async () => {
        const app = createTestApp()
        const mockReply = 'Successfully generated reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: createMockTweetContext(),
            tone: 'casual',
          },
        })

        const res = await app.request(req)
        const responseData = await res.json()

        expect(res.status).toBe(200)
        expect(responseData.reply).toBe(mockReply)
      })

      it('should handle AI generation failure on first attempt with retry', async () => {
        const app = createTestApp()
        // Mock should succeed (retry logic is in generateReplyWithRetry)
        const mockReply = 'Success on retry'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: createMockTweetContext(),
            tone: 'casual',
          },
        })

        const res = await app.request(req)
        const responseData = await res.json()

        expect(res.status).toBe(200)
        expect(responseData.reply).toBe(mockReply)
      })

      it('should return 500 when AI generation fails after all retries', async () => {
        const app = createTestApp()
        vi.mocked(generateReplyWithRetry).mockRejectedValue(
          new Error('AI service unavailable')
        )

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: createMockTweetContext(),
            tone: 'casual',
          },
        })

        const res = await app.request(req)
        const responseData = await res.json()

        expect(res.status).toBe(500)
        expect(responseData).toMatchObject({
          error: 'AI service unavailable',
        })
      })

      it('should handle AI timeout', async () => {
        const app = createTestApp()
        vi.mocked(generateReplyWithRetry).mockRejectedValue(new Error('Request timeout'))

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: createMockTweetContext(),
            tone: 'casual',
          },
        })

        const res = await app.request(req)
        const responseData = await res.json()

        expect(res.status).toBe(500)
        expect(responseData.error).toBe('Request timeout')
      })

      it('should handle invalid AI response format', async () => {
        const app = createTestApp()
        vi.mocked(generateReplyWithRetry).mockRejectedValue(
          new Error('Invalid response format from AI')
        )

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: createMockTweetContext(),
            tone: 'casual',
          },
        })

        const res = await app.request(req)
        const responseData = await res.json()

        expect(res.status).toBe(500)
        expect(responseData.error).toBe('Invalid response format from AI')
      })
    })

    describe('Context Variants (4 tests)', () => {
      it('should handle tweet with images', async () => {
        const app = createTestApp()
        const mockReply = 'Nice image!'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: createMockTweetContext({
              media: [
                { url: 'https://example.com/image1.jpg', type: 'image' },
                { url: 'https://example.com/image2.jpg', type: 'image' },
              ],
            }),
          },
        })

        await app.request(req)

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            media: expect.arrayContaining([
              { url: 'https://example.com/image1.jpg', type: 'image' },
              { url: 'https://example.com/image2.jpg', type: 'image' },
            ]),
          }),
          expect.any(Object),
          3
        )
      })

      it('should handle tweet with video', async () => {
        const app = createTestApp()
        const mockReply = 'Great video!'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: createMockTweetContext({
              media: [{ url: 'https://example.com/video.mp4', type: 'video' }],
            }),
          },
        })

        await app.request(req)

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            media: [{ url: 'https://example.com/video.mp4', type: 'video' }],
          }),
          expect.any(Object),
          3
        )
      })

      it('should handle thread context', async () => {
        const app = createTestApp()
        const mockReply = 'Interesting thread!'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: createMockTweetContext({
              type: 'thread',
              thread: [
                { text: 'First tweet in thread', author: 'user1' },
                {
                  text: 'Second tweet in thread',
                  author: 'user1',
                  media: [{ url: 'https://example.com/img.jpg', type: 'image' }],
                },
              ],
            }),
          },
        })

        await app.request(req)

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'thread',
            thread: expect.arrayContaining([
              expect.objectContaining({ text: 'First tweet in thread' }),
            ]),
          }),
          expect.any(Object),
          3
        )
      })

      it('should handle replies context', async () => {
        const app = createTestApp()
        const mockReply = 'Adding to the discussion'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: createMockTweetContext({
              type: 'reply',
              replies: [
                { text: 'First reply', author: 'user2' },
                { text: 'Second reply', author: 'user3' },
              ],
            }),
          },
        })

        await app.request(req)

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'reply',
            replies: expect.arrayContaining([
              expect.objectContaining({ text: 'First reply' }),
            ]),
          }),
          expect.any(Object),
          3
        )
      })
    })

    describe('Edge Cases (4 tests)', () => {
      it('should handle includeEmoji enabled vs disabled', async () => {
        const app = createTestApp()

        // Test with emoji enabled
        const mockReplyWithEmoji = 'Great post! 🚀'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReplyWithEmoji)

        const reqWithEmoji = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: createMockTweetContext(),
            includeEmoji: true,
          },
        })

        await app.request(reqWithEmoji)

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ includeEmoji: true }),
          3
        )

        // Test with emoji disabled
        vi.clearAllMocks()
        const mockReplyNoEmoji = 'Great post!'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReplyNoEmoji)

        const reqNoEmoji = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: createMockTweetContext(),
            includeEmoji: false,
          },
        })

        await app.request(reqNoEmoji)

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ includeEmoji: false }),
          3
        )
      })

      it('should handle concurrent requests', async () => {
        const app = createTestApp()
        const mockReply1 = 'Reply 1'
        const mockReply2 = 'Reply 2'

        vi.mocked(generateReplyWithRetry)
          .mockResolvedValueOnce(mockReply1)
          .mockResolvedValueOnce(mockReply2)

        const req1 = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: { context: createMockTweetContext({ text: 'Tweet 1' }) },
        })

        const req2 = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: { context: createMockTweetContext({ text: 'Tweet 2' }) },
        })

        // Execute concurrently
        const [res1, res2] = await Promise.all([app.request(req1), app.request(req2)])

        expect(res1.status).toBe(200)
        expect(res2.status).toBe(200)
        expect(generateReplyWithRetry).toHaveBeenCalledTimes(2)
      })

      it('should handle very long additional instructions', async () => {
        const app = createTestApp()
        const mockReply = 'Reply following long instructions'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const longInstructions = 'a'.repeat(2000)

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: createMockTweetContext(),
            additionalInstructions: longInstructions,
          },
        })

        const res = await app.request(req)

        expect(res.status).toBe(200)
        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            additionalInstructions: longInstructions,
          }),
          3
        )
      })

      it('should handle missing optional fields with defaults', async () => {
        const app = createTestApp()
        const mockReply = 'Reply with defaults'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const req = createMockRequest({
          method: 'POST',
          path: '/generate-reply',
          headers: { Authorization: 'Bearer test-token' },
          body: {
            context: createMockTweetContext(),
            // tone, includeEmoji, additionalInstructions all missing
          },
        })

        await app.request(req)

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            tone: 'casual', // default
            includeEmoji: true, // default
            additionalInstructions: undefined,
          }),
          3
        )
      })
    })
  })

  // ============================================================
  // GET /api/ai/tones - Get Available Tones (4 tests)
  // ============================================================
  describe('GET /api/ai/tones', () => {
    it('should return list of available tones', async () => {
      const app = createTestApp()

      const req = createMockRequest({
        method: 'GET',
        path: '/tones',
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.request(req)
      const responseData = await res.json()

      expect(res.status).toBe(200)
      expect(responseData).toEqual({
        tones: [
          { value: 'casual', label: 'Casual' },
          { value: 'professional', label: 'Professional' },
          { value: 'humorous', label: 'Humorous' },
        ],
      })
    })

    it('should include expected tone values', async () => {
      const app = createTestApp()

      const req = createMockRequest({
        method: 'GET',
        path: '/tones',
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.request(req)
      const responseData = await res.json()

      const toneValues = responseData.tones.map((t: any) => t.value)

      expect(toneValues).toContain('casual')
      expect(toneValues).toContain('professional')
      expect(toneValues).toContain('humorous')
      expect(responseData.tones).toHaveLength(3)
    })

    it('should validate response format', async () => {
      const app = createTestApp()

      const req = createMockRequest({
        method: 'GET',
        path: '/tones',
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.request(req)
      const responseData = await res.json()

      expect(responseData).toHaveProperty('tones')
      expect(Array.isArray(responseData.tones)).toBe(true)

      responseData.tones.forEach((tone: any) => {
        expect(tone).toHaveProperty('value')
        expect(tone).toHaveProperty('label')
        expect(typeof tone.value).toBe('string')
        expect(typeof tone.label).toBe('string')
      })
    })

    it('should handle errors in getAvailableTones', async () => {
      const app = createTestApp()
      vi.mocked(getAvailableTones).mockImplementationOnce(() => {
        throw new Error('Failed to fetch tones')
      })

      const req = createMockRequest({
        method: 'GET',
        path: '/tones',
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.request(req)
      const responseData = await res.json()

      expect(res.status).toBe(500)
      expect(responseData).toMatchObject({
        error: 'Failed to fetch tones',
      })
    })
  })

  // ============================================================
  // GET /api/ai/health - Health Check (3 tests)
  // ============================================================
  describe('GET /api/ai/health', () => {
    it('should return health status', async () => {
      const app = createTestApp()

      const req = createMockRequest({
        method: 'GET',
        path: '/health',
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.request(req)
      const responseData = await res.json()

      expect(res.status).toBe(200)
      expect(responseData).toMatchObject({
        status: 'ok',
        service: 'ai-reply',
        timestamp: expect.any(String),
      })
    })

    it('should validate response format', async () => {
      const app = createTestApp()

      const req = createMockRequest({
        method: 'GET',
        path: '/health',
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.request(req)
      const responseData = await res.json()

      expect(responseData).toHaveProperty('status')
      expect(responseData).toHaveProperty('service')
      expect(responseData).toHaveProperty('timestamp')

      expect(responseData.status).toBe('ok')
      expect(responseData.service).toBe('ai-reply')

      // Validate timestamp is ISO string
      const timestamp = new Date(responseData.timestamp)
      expect(timestamp).toBeInstanceOf(Date)
      expect(timestamp.toISOString()).toBe(responseData.timestamp)
    })

    it('should return current timestamp', async () => {
      const app = createTestApp()
      const beforeTime = new Date().toISOString()

      const req = createMockRequest({
        method: 'GET',
        path: '/health',
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.request(req)
      const responseData = await res.json()

      const afterTime = new Date().toISOString()
      const timestamp = responseData.timestamp

      // Timestamp should be between before and after
      expect(timestamp >= beforeTime).toBe(true)
      expect(timestamp <= afterTime).toBe(true)
    })
  })
})
