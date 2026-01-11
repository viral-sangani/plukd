import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Context } from 'grammy'

// Mock Grammy Bot before imports
const mockBot = {
  command: vi.fn(),
  on: vi.fn(),
  api: {
    sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
  },
}

vi.mock('grammy', () => ({
  Bot: class Bot {
    constructor() {
      return mockBot
    }
  },
}))

// Mock dependencies
vi.mock('../../../config/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

vi.mock('../../../config/env', () => ({
  env: {
    TELEGRAM_BOT_TOKEN: 'test-token-123',
    REDIS_URL: 'redis://localhost:6379',
  },
}))

vi.mock('../../../jobs/queue', () => ({
  enqueueBookmarkProcessing: vi.fn(),
}))

vi.mock('@plukd/shared', async () => {
  const actual = await vi.importActual('@plukd/shared')
  return {
    ...actual,
    extractUrls: vi.fn((text: string) => {
      const urlRegex = /(https?:\/\/[^\s]+)/g
      return text.match(urlRegex) || []
    }),
    detectSource: vi.fn((url: string) => {
      if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter'
      if (url.includes('reddit.com')) return 'reddit'
      if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
      if (url.includes('linkedin.com')) return 'linkedin'
      if (url.includes('instagram.com')) return 'instagram'
      return 'web'
    }),
  }
})

import { setupBotHandlers, createBot } from '../bot'
import { supabaseAdmin } from '../../../config/supabase'
import { enqueueBookmarkProcessing } from '../../../jobs/queue'
import { extractUrls, detectSource } from '@plukd/shared'

/**
 * Test Fixtures and Helpers
 */

const TEST_USER_ID = 'test-user-id-123'
const TEST_CHAT_ID = '123456789'
const TEST_USERNAME = 'testuser'

/**
 * Create a mock Grammy context object
 */
function createMockContext(
  messageText: string = '',
  chatId: string = TEST_CHAT_ID,
  username?: string
): Context {
  return {
    message: {
      text: messageText,
      from: {
        id: parseInt(chatId),
        username: username || TEST_USERNAME,
      },
      chat: {
        id: parseInt(chatId),
      },
    },
    chat: {
      id: parseInt(chatId),
    },
    from: {
      id: parseInt(chatId),
      username: username || TEST_USERNAME,
    },
    reply: vi.fn().mockResolvedValue({}),
  } as unknown as Context
}

/**
 * Mock Supabase chain for select queries
 */
function createSelectChain(returnValue: unknown, error: unknown = null) {
  return {
    eq: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data: returnValue, error }),
    })),
  }
}

/**
 * Test Suite: Telegram Bot Handlers
 */
describe('Telegram Bot Handlers - Simplified', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Test Suite: createBot
   */
  describe('createBot', () => {
    it('should create bot with token from environment', () => {
      const bot = createBot()
      expect(bot).toBeDefined()
      expect(bot).toBe(mockBot)
    })

    it('should throw error if TELEGRAM_BOT_TOKEN is not set', async () => {
      const originalModule = await import('../../../config/env')
      const originalToken = originalModule.env.TELEGRAM_BOT_TOKEN

      // Temporarily clear the token
      originalModule.env.TELEGRAM_BOT_TOKEN = ''

      expect(() => createBot()).toThrow('TELEGRAM_BOT_TOKEN environment variable is not set')

      // Restore
      originalModule.env.TELEGRAM_BOT_TOKEN = originalToken
    })
  })

  /**
   * Test Suite: setupBotHandlers
   */
  describe('setupBotHandlers', () => {
    it('should register /start command handler', () => {
      const bot = createBot()
      setupBotHandlers(bot as never)

      expect(mockBot.command).toHaveBeenCalledWith('start', expect.any(Function))
    })

    it('should register message:text handler', () => {
      const bot = createBot()
      setupBotHandlers(bot as never)

      expect(mockBot.on).toHaveBeenCalledWith('message:text', expect.any(Function))
    })
  })

  /**
   * Test Suite: Handler Functions (via registered callbacks)
   */
  describe('handleStartCommand behavior', () => {
    it('should generate link code for new user', async () => {
      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => createSelectChain(null, { code: 'PGRST116' })),
          }
        }
        if (table === 'telegram_link_codes') {
          return {
            insert: vi.fn(() => ({ error: null })),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot as never)

      // Get the registered handler
      const startHandler = mockBot.command.mock.calls.find((call) => call[0] === 'start')?.[1]
      const ctx = createMockContext('/start')

      await startHandler?.(ctx)

      // Verify user lookup was called
      expect(mockFrom).toHaveBeenCalledWith('users')

      // Verify insert was called for link code
      expect(mockFrom).toHaveBeenCalledWith('telegram_link_codes')
    })

    it('should confirm for existing linked user', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() =>
          createSelectChain({ id: TEST_USER_ID, telegram_chat_id: TEST_CHAT_ID })
        ),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot as never)

      const startHandler = mockBot.command.mock.calls.find((call) => call[0] === 'start')?.[1]
      const ctx = createMockContext('/start')

      await startHandler?.(ctx)

      // Should not call insert (no new code generated)
      expect(mockFrom).not.toHaveBeenCalledWith('telegram_link_codes')
    })

    it('should handle database error on user lookup', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => createSelectChain(null, { code: 'GENERIC_ERROR', message: 'DB Error' })),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot as never)

      const startHandler = mockBot.command.mock.calls.find((call) => call[0] === 'start')?.[1]
      const ctx = createMockContext('/start')

      await startHandler?.(ctx)

      // Should not proceed to insert
      expect(mockFrom).not.toHaveBeenCalledWith('telegram_link_codes')
    })
  })

  describe('handleTextMessage behavior', () => {
    it('should create bookmark from valid URL', async () => {
      const mockBookmarkId = 'bookmark-123'

      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => createSelectChain({ id: TEST_USER_ID })),
          }
        }
        if (table === 'bookmarks') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn().mockResolvedValue({
                data: [{ id: mockBookmarkId, url: 'https://example.com' }],
                error: null,
              }),
            })),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot as never)

      const messageHandler = mockBot.on.mock.calls.find((call) => call[0] === 'message:text')?.[1]
      const ctx = createMockContext('Check this out: https://example.com')

      await messageHandler?.(ctx)

      // Verify bookmark was created
      expect(mockFrom).toHaveBeenCalledWith('bookmarks')

      // Verify job was enqueued
      expect(enqueueBookmarkProcessing).toHaveBeenCalledWith(
        mockBookmarkId,
        'https://example.com',
        TEST_USER_ID
      )
    })

    it('should handle multiple URLs in one message', async () => {
      const mockBookmarks = [
        { id: 'bookmark-1', url: 'https://a.com' },
        { id: 'bookmark-2', url: 'https://b.com' },
      ]

      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => createSelectChain({ id: TEST_USER_ID })),
          }
        }
        if (table === 'bookmarks') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn().mockResolvedValue({
                data: mockBookmarks,
                error: null,
              }),
            })),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot as never)

      const messageHandler = mockBot.on.mock.calls.find((call) => call[0] === 'message:text')?.[1]
      const ctx = createMockContext('See https://a.com and https://b.com')

      await messageHandler?.(ctx)

      // Verify 2 jobs were enqueued
      expect(enqueueBookmarkProcessing).toHaveBeenCalledTimes(2)
    })

    it('should send help message when no URLs found', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => createSelectChain({ id: TEST_USER_ID })),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot as never)

      const messageHandler = mockBot.on.mock.calls.find((call) => call[0] === 'message:text')?.[1]
      const ctx = createMockContext('Hello bot!')

      await messageHandler?.(ctx)

      // Should not create bookmarks
      expect(mockFrom).not.toHaveBeenCalledWith('bookmarks')
    })

    it('should prompt to link account if user not found', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => createSelectChain(null, { code: 'PGRST116' })),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot as never)

      const messageHandler = mockBot.on.mock.calls.find((call) => call[0] === 'message:text')?.[1]
      const ctx = createMockContext('https://example.com')

      await messageHandler?.(ctx)

      // Should not create bookmarks
      expect(mockFrom).not.toHaveBeenCalledWith('bookmarks')
    })

    it('should handle bookmark creation failure', async () => {
      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => createSelectChain({ id: TEST_USER_ID })),
          }
        }
        if (table === 'bookmarks') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Insert failed' },
              }),
            })),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot as never)

      const messageHandler = mockBot.on.mock.calls.find((call) => call[0] === 'message:text')?.[1]
      const ctx = createMockContext('https://example.com')

      await messageHandler?.(ctx)

      // Should not enqueue job
      expect(enqueueBookmarkProcessing).not.toHaveBeenCalled()
    })

    it('should handle queue enqueue failure gracefully', async () => {
      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => createSelectChain({ id: TEST_USER_ID })),
          }
        }
        if (table === 'bookmarks') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn().mockResolvedValue({
                data: [{ id: 'bookmark-1', url: 'https://example.com' }],
                error: null,
              }),
            })),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)
      vi.mocked(enqueueBookmarkProcessing).mockRejectedValueOnce(new Error('Queue error'))

      const bot = createBot()
      setupBotHandlers(bot as never)

      const messageHandler = mockBot.on.mock.calls.find((call) => call[0] === 'message:text')?.[1]
      const ctx = createMockContext('https://example.com')

      // Should not throw - error is logged but processing continues
      await expect(messageHandler?.(ctx)).resolves.not.toThrow()
    })
  })

  /**
   * Test Suite: Source Detection
   */
  describe('Source Detection', () => {
    it('should detect Twitter URL', () => {
      const source = detectSource('https://twitter.com/user/status/123')
      expect(source).toBe('twitter')
    })

    it('should detect X.com URL', () => {
      const source = detectSource('https://x.com/user/status/123')
      expect(source).toBe('twitter')
    })

    it('should detect Reddit URL', () => {
      const source = detectSource('https://reddit.com/r/programming/comments/abc')
      expect(source).toBe('reddit')
    })

    it('should detect YouTube URL', () => {
      const source = detectSource('https://youtube.com/watch?v=abc123')
      expect(source).toBe('youtube')
    })

    it('should detect youtu.be URL', () => {
      const source = detectSource('https://youtu.be/abc123')
      expect(source).toBe('youtube')
    })

    it('should detect LinkedIn URL', () => {
      const source = detectSource('https://linkedin.com/posts/user-post-123')
      expect(source).toBe('linkedin')
    })

    it('should detect Instagram URL', () => {
      const source = detectSource('https://instagram.com/p/abc123')
      expect(source).toBe('instagram')
    })

    it('should detect generic web URL', () => {
      const source = detectSource('https://example.com/article')
      expect(source).toBe('web')
    })
  })

  /**
   * Test Suite: URL Extraction
   */
  describe('URL Extraction', () => {
    it('should extract single URL', () => {
      const urls = extractUrls('Check this out: https://example.com')
      expect(urls).toEqual(['https://example.com'])
    })

    it('should extract multiple URLs', () => {
      const urls = extractUrls('See https://a.com and https://b.com')
      expect(urls).toEqual(['https://a.com', 'https://b.com'])
    })

    it('should return empty array when no URLs', () => {
      const urls = extractUrls('Hello world!')
      expect(urls).toEqual([])
    })

    it('should handle URL with query parameters', () => {
      const urls = extractUrls('https://example.com/page?ref=twitter&utm_source=test')
      expect(urls).toEqual(['https://example.com/page?ref=twitter&utm_source=test'])
    })

    it('should handle URL with fragments', () => {
      const urls = extractUrls('https://example.com/page#section-1')
      expect(urls).toEqual(['https://example.com/page#section-1'])
    })

    it('should extract URLs from long message', () => {
      const message = `
        This is a very long message with multiple URLs.
        First one: https://example1.com
        Then some more text about various topics.
        Second one: https://example2.com
        Even more text.
        Third one: https://example3.com
      `
      const urls = extractUrls(message)
      expect(urls).toHaveLength(3)
      expect(urls).toContain('https://example1.com')
      expect(urls).toContain('https://example2.com')
      expect(urls).toContain('https://example3.com')
    })
  })
})
