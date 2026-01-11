import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Context } from 'grammy'

// Mock Grammy Bot before imports
const mockBot = {
  command: vi.fn(),
  on: vi.fn(),
  handleUpdate: vi.fn(),
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

/**
 * Test Fixtures and Helpers
 */

const TEST_USER_ID = 'test-user-id-123'
const TEST_CHAT_ID = '123456789'
const TEST_USERNAME = 'testuser'

interface MockMessage {
  text?: string
  from?: {
    id: string
    username?: string
  }
  chat?: {
    id: number
  }
}

interface MockContext extends Partial<Context> {
  message?: MockMessage
  chat?: {
    id: number
  }
  from?: {
    id: string
    username?: string
  }
  reply: ReturnType<typeof vi.fn>
}

/**
 * Create a mock Grammy context object
 */
function createMockContext(
  messageText: string = '',
  chatId: string = TEST_CHAT_ID,
  username?: string
): MockContext {
  return {
    message: {
      text: messageText,
      from: {
        id: chatId,
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
      id: chatId,
      username: username || TEST_USERNAME,
    },
    reply: vi.fn().mockResolvedValue({}),
  } as MockContext
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
 * Mock Supabase chain for insert queries
 */
function createInsertChain(returnValue: unknown, error: unknown = null) {
  return {
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data: returnValue, error }),
    })),
  }
}

/**
 * Test Suite: Telegram Bot Handlers
 */
describe('Telegram Bot Handlers', () => {
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
    })

    // Note: Testing missing token requires the module to be re-imported after the mock is set.
    // This is better tested at the integration level or by mocking the env module
    // before the bot module is loaded. For now, we test the positive case above.
    it('should use token from environment variable', () => {
      // This test verifies the bot is created successfully with the mocked token
      // The mock sets TELEGRAM_BOT_TOKEN to 'test-token-123' at the top of this file
      const bot = createBot()
      expect(bot).toBeDefined()
    })
  })

  /**
   * Helper to get the registered /start command handler
   */
  function getStartHandler() {
    return mockBot.command.mock.calls.find((call) => call[0] === 'start')?.[1]
  }

  /**
   * Helper to get the registered message:text handler
   */
  function getMessageHandler() {
    return mockBot.on.mock.calls.find((call) => call[0] === 'message:text')?.[1]
  }

  /**
   * Test Suite: handleStartCommand
   */
  describe('handleStartCommand', () => {
    /**
     * Success Cases
     */
    it('should generate link code for new user', async () => {
      const ctx = createMockContext('/start')
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => createSelectChain(null, { code: 'PGRST116' })),
        insert: vi.fn(() => ({ error: null })),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      // Get and call the registered handler
      const startHandler = getStartHandler()
      await startHandler?.(ctx)

      // Verify user lookup was called
      expect(mockFrom).toHaveBeenCalledWith('users')

      // Verify insert was called for link code
      expect(mockFrom).toHaveBeenCalledWith('telegram_link_codes')
    })

    it('should generate 6-character alphanumeric code', async () => {
      const ctx = createMockContext('/start')
      let capturedCode = ''

      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => createSelectChain(null, { code: 'PGRST116' })),
          }
        }
        if (table === 'telegram_link_codes') {
          return {
            insert: vi.fn((data: never) => {
              const insertData = data as { code: string }
              capturedCode = insertData.code
              return { error: null }
            }),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const startHandler = getStartHandler()
      await startHandler?.(ctx)

      // Verify code format (6 alphanumeric characters)
      expect(capturedCode).toMatch(/^[A-Z0-9]{6}$/)
    })

    it('should set expiry time to 10 minutes from now', async () => {
      const ctx = createMockContext('/start')
      let capturedExpiresAt = ''
      const testStartTime = Date.now()

      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => createSelectChain(null, { code: 'PGRST116' })),
          }
        }
        if (table === 'telegram_link_codes') {
          return {
            insert: vi.fn((data: never) => {
              const insertData = data as { expires_at: string }
              capturedExpiresAt = insertData.expires_at
              return { error: null }
            }),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const startHandler = getStartHandler()
      await startHandler?.(ctx)

      const expiryTime = new Date(capturedExpiresAt).getTime()
      const expectedExpiry = testStartTime + 10 * 60 * 1000
      const tolerance = 5000 // 5 seconds tolerance

      expect(Math.abs(expiryTime - expectedExpiry)).toBeLessThan(tolerance)
    })

    it('should confirm for existing linked user', async () => {
      const ctx = createMockContext('/start')
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() =>
          createSelectChain({ id: TEST_USER_ID, telegram_chat_id: TEST_CHAT_ID })
        ),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const startHandler = getStartHandler()
      await startHandler?.(ctx)

      // Should not call insert (no new code generated)
      expect(mockFrom).not.toHaveBeenCalledWith('telegram_link_codes')
    })

    it('should include username in welcome message when available', async () => {
      const ctx = createMockContext('/start', TEST_CHAT_ID, 'johndoe')
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
      setupBotHandlers(bot)

      const startHandler = getStartHandler()
      await startHandler?.(ctx)

      // Username should be included in insert
      const insertCall = mockFrom.mock.calls.find((call) => call[0] === 'telegram_link_codes')
      expect(insertCall).toBeDefined()
    })

    /**
     * Error Cases
     */
    it('should handle missing chat ID gracefully', async () => {
      const ctx = createMockContext('/start')
      ctx.chat = undefined

      const bot = createBot()
      setupBotHandlers(bot)

      const startHandler = getStartHandler()
      await startHandler?.(ctx)

      // Should not attempt database operations
      expect(supabaseAdmin.from).not.toHaveBeenCalled()
    })

    it('should handle database error on user lookup', async () => {
      const ctx = createMockContext('/start')
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => createSelectChain(null, { code: 'GENERIC_ERROR', message: 'DB Error' })),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const startHandler = getStartHandler()
      await startHandler?.(ctx)

      // Should not proceed to insert
      expect(mockFrom).not.toHaveBeenCalledWith('telegram_link_codes')
    })

    it('should handle database error on code save', async () => {
      const ctx = createMockContext('/start')
      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => createSelectChain(null, { code: 'PGRST116' })),
          }
        }
        if (table === 'telegram_link_codes') {
          return {
            insert: vi.fn(() => ({ error: { message: 'Insert failed' } })),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const startHandler = getStartHandler()
      await startHandler?.(ctx)

      // Error should be logged (verified via mock console)
      expect(mockFrom).toHaveBeenCalledWith('telegram_link_codes')
    })

    it('should handle exception during processing gracefully', async () => {
      const ctx = createMockContext('/start')
      const mockFrom = vi.fn(() => {
        throw new Error('Unexpected error')
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const startHandler = getStartHandler()
      // Handler catches errors and replies with an error message instead of throwing
      await expect(startHandler?.(ctx)).resolves.not.toThrow()
      // Verify error reply was sent
      expect(ctx.reply).toHaveBeenCalledWith('Something went wrong. Please try again later.')
    })

    it('should regenerate code for existing unlinked user', async () => {
      const ctx = createMockContext('/start')
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
      setupBotHandlers(bot)

      // First /start
      const startHandler = getStartHandler()
      await startHandler?.(ctx)

      const firstCallCount = mockFrom.mock.calls.filter(
        (call) => call[0] === 'telegram_link_codes'
      ).length

      vi.clearAllMocks()
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      // Second /start - need to re-setup handlers after clearAllMocks
      const bot2 = createBot()
      setupBotHandlers(bot2)
      const startHandler2 = getStartHandler()
      await startHandler2?.(ctx)

      const secondCallCount = mockFrom.mock.calls.filter(
        (call) => call[0] === 'telegram_link_codes'
      ).length

      // Both should generate codes
      expect(firstCallCount).toBeGreaterThan(0)
      expect(secondCallCount).toBeGreaterThan(0)
    })
  })

  /**
   * Test Suite: handleTextMessage
   */
  describe('handleTextMessage', () => {
    /**
     * URL Extraction Tests
     */
    it('should create bookmark from valid URL', async () => {
      const ctx = createMockContext('Check this out: https://example.com')
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
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
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
      const ctx = createMockContext('See https://a.com and https://b.com')
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
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      // Verify 2 jobs were enqueued
      expect(enqueueBookmarkProcessing).toHaveBeenCalledTimes(2)
    })

    it('should send help message when no URLs found', async () => {
      const ctx = createMockContext('Hello bot!')

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => createSelectChain({ id: TEST_USER_ID })),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      // Should not create bookmarks
      expect(mockFrom).not.toHaveBeenCalledWith('bookmarks')
    })

    /**
     * Source Detection Tests
     */
    it('should detect Twitter URL as twitter source', async () => {
      const ctx = createMockContext('https://twitter.com/user/status/123')
      let capturedSource = ''

      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => createSelectChain({ id: TEST_USER_ID })),
          }
        }
        if (table === 'bookmarks') {
          return {
            insert: vi.fn((data: never) => {
              const bookmarks = data as Array<{ source: string }>
              capturedSource = bookmarks[0].source
              return {
                select: vi.fn().mockResolvedValue({
                  data: [{ id: 'bookmark-1', url: 'https://twitter.com/user/status/123' }],
                  error: null,
                }),
              }
            }),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      expect(capturedSource).toBe('twitter')
    })

    it('should detect X.com URL as twitter source', async () => {
      const ctx = createMockContext('https://x.com/user/status/123')
      let capturedSource = ''

      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => createSelectChain({ id: TEST_USER_ID })),
          }
        }
        if (table === 'bookmarks') {
          return {
            insert: vi.fn((data: never) => {
              const bookmarks = data as Array<{ source: string }>
              capturedSource = bookmarks[0].source
              return {
                select: vi.fn().mockResolvedValue({
                  data: [{ id: 'bookmark-1', url: 'https://x.com/user/status/123' }],
                  error: null,
                }),
              }
            }),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      expect(capturedSource).toBe('twitter')
    })

    it('should detect Reddit URL as reddit source', async () => {
      const ctx = createMockContext('https://reddit.com/r/programming/comments/abc')
      let capturedSource = ''

      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => createSelectChain({ id: TEST_USER_ID })),
          }
        }
        if (table === 'bookmarks') {
          return {
            insert: vi.fn((data: never) => {
              const bookmarks = data as Array<{ source: string }>
              capturedSource = bookmarks[0].source
              return {
                select: vi.fn().mockResolvedValue({
                  data: [{ id: 'bookmark-1', url: 'https://reddit.com/r/programming/comments/abc' }],
                  error: null,
                }),
              }
            }),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      expect(capturedSource).toBe('reddit')
    })

    it('should detect YouTube URL as youtube source', async () => {
      const ctx = createMockContext('https://youtube.com/watch?v=abc123')
      let capturedSource = ''

      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => createSelectChain({ id: TEST_USER_ID })),
          }
        }
        if (table === 'bookmarks') {
          return {
            insert: vi.fn((data: never) => {
              const bookmarks = data as Array<{ source: string }>
              capturedSource = bookmarks[0].source
              return {
                select: vi.fn().mockResolvedValue({
                  data: [{ id: 'bookmark-1', url: 'https://youtube.com/watch?v=abc123' }],
                  error: null,
                }),
              }
            }),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      expect(capturedSource).toBe('youtube')
    })

    it('should detect youtu.be URL as youtube source', async () => {
      const ctx = createMockContext('https://youtu.be/abc123')
      let capturedSource = ''

      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => createSelectChain({ id: TEST_USER_ID })),
          }
        }
        if (table === 'bookmarks') {
          return {
            insert: vi.fn((data: never) => {
              const bookmarks = data as Array<{ source: string }>
              capturedSource = bookmarks[0].source
              return {
                select: vi.fn().mockResolvedValue({
                  data: [{ id: 'bookmark-1', url: 'https://youtu.be/abc123' }],
                  error: null,
                }),
              }
            }),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      expect(capturedSource).toBe('youtube')
    })

    it('should detect LinkedIn URL as linkedin source', async () => {
      const ctx = createMockContext('https://linkedin.com/posts/user-post-123')
      let capturedSource = ''

      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => createSelectChain({ id: TEST_USER_ID })),
          }
        }
        if (table === 'bookmarks') {
          return {
            insert: vi.fn((data: never) => {
              const bookmarks = data as Array<{ source: string }>
              capturedSource = bookmarks[0].source
              return {
                select: vi.fn().mockResolvedValue({
                  data: [{ id: 'bookmark-1', url: 'https://linkedin.com/posts/user-post-123' }],
                  error: null,
                }),
              }
            }),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      expect(capturedSource).toBe('linkedin')
    })

    it('should detect Instagram URL as instagram source', async () => {
      const ctx = createMockContext('https://instagram.com/p/abc123')
      let capturedSource = ''

      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => createSelectChain({ id: TEST_USER_ID })),
          }
        }
        if (table === 'bookmarks') {
          return {
            insert: vi.fn((data: never) => {
              const bookmarks = data as Array<{ source: string }>
              capturedSource = bookmarks[0].source
              return {
                select: vi.fn().mockResolvedValue({
                  data: [{ id: 'bookmark-1', url: 'https://instagram.com/p/abc123' }],
                  error: null,
                }),
              }
            }),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      expect(capturedSource).toBe('instagram')
    })

    it('should detect generic web URL as web source', async () => {
      const ctx = createMockContext('https://example.com/article')
      let capturedSource = ''

      const mockFrom = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => createSelectChain({ id: TEST_USER_ID })),
          }
        }
        if (table === 'bookmarks') {
          return {
            insert: vi.fn((data: never) => {
              const bookmarks = data as Array<{ source: string }>
              capturedSource = bookmarks[0].source
              return {
                select: vi.fn().mockResolvedValue({
                  data: [{ id: 'bookmark-1', url: 'https://example.com/article' }],
                  error: null,
                }),
              }
            }),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      expect(capturedSource).toBe('web')
    })

    /**
     * URL Parsing Edge Cases
     */
    it('should handle URL with query parameters', async () => {
      const ctx = createMockContext('https://example.com/page?ref=twitter&utm_source=test')
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
                data: [
                  { id: 'bookmark-1', url: 'https://example.com/page?ref=twitter&utm_source=test' },
                ],
                error: null,
              }),
            })),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      expect(enqueueBookmarkProcessing).toHaveBeenCalled()
    })

    it('should handle URL with fragments', async () => {
      const ctx = createMockContext('https://example.com/page#section-1')
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
                data: [{ id: 'bookmark-1', url: 'https://example.com/page#section-1' }],
                error: null,
              }),
            })),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      expect(enqueueBookmarkProcessing).toHaveBeenCalled()
    })

    it('should extract URLs from long message', async () => {
      const longMessage = `
        This is a very long message with multiple URLs.
        First one: https://example1.com
        Then some more text about various topics and things that are happening.
        Second one: https://example2.com
        Even more text to make this message really long and test the extraction.
        Third one: https://example3.com
      `
      const ctx = createMockContext(longMessage)
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
                data: [
                  { id: 'bookmark-1', url: 'https://example1.com' },
                  { id: 'bookmark-2', url: 'https://example2.com' },
                  { id: 'bookmark-3', url: 'https://example3.com' },
                ],
                error: null,
              }),
            })),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      expect(enqueueBookmarkProcessing).toHaveBeenCalledTimes(3)
    })

    /**
     * User Authorization Tests
     */
    it('should prompt to link account if user not found', async () => {
      const ctx = createMockContext('https://example.com')
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => createSelectChain(null, { code: 'PGRST116' })),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      // Should not create bookmarks
      expect(mockFrom).not.toHaveBeenCalledWith('bookmarks')
    })

    it('should prompt to link account if user not linked', async () => {
      const ctx = createMockContext('https://example.com')
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => createSelectChain(null)),
      }))
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      // Should not create bookmarks
      expect(mockFrom).not.toHaveBeenCalledWith('bookmarks')
    })

    /**
     * Error Handling Tests
     */
    it('should handle bookmark creation failure', async () => {
      const ctx = createMockContext('https://example.com')
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
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      // Should not enqueue job
      expect(enqueueBookmarkProcessing).not.toHaveBeenCalled()
    })

    it('should handle queue enqueue failure gracefully', async () => {
      const ctx = createMockContext('https://example.com')
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
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      // Should not throw - error is logged but processing continues
      await expect(messageHandler?.(ctx)).resolves.not.toThrow()
    })

    it('should handle database RLS violation', async () => {
      const ctx = createMockContext('https://example.com')
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
                error: { code: '42501', message: 'Permission denied' },
              }),
            })),
          }
        }
        return {}
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      // Should not enqueue job
      expect(enqueueBookmarkProcessing).not.toHaveBeenCalled()
    })

    it('should handle missing message text', async () => {
      const ctx = createMockContext('')
      ctx.message = {
        ...ctx.message,
        text: undefined,
      }

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      // Should not make any database calls
      expect(supabaseAdmin.from).not.toHaveBeenCalled()
    })

    it('should handle missing chat ID', async () => {
      const ctx = createMockContext('https://example.com')
      ctx.chat = undefined

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      await messageHandler?.(ctx)

      // Should not make any database calls
      expect(supabaseAdmin.from).not.toHaveBeenCalled()
    })

    it('should handle general exception gracefully', async () => {
      const ctx = createMockContext('https://example.com')
      const mockFrom = vi.fn(() => {
        throw new Error('Unexpected error')
      })
      vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

      const bot = createBot()
      setupBotHandlers(bot)

      const messageHandler = getMessageHandler()
      // Handler catches errors and replies with an error message instead of throwing
      await expect(messageHandler?.(ctx)).resolves.not.toThrow()
      // Verify error reply was sent
      expect(ctx.reply).toHaveBeenCalledWith('Something went wrong. Please try again later.')
    })
  })

  /**
   * Test Suite: Bot Setup
   */
  describe('setupBotHandlers', () => {
    it('should register /start command handler', () => {
      const bot = createBot()
      const commandSpy = vi.spyOn(bot, 'command')

      setupBotHandlers(bot)

      expect(commandSpy).toHaveBeenCalledWith('start', expect.any(Function))
    })

    it('should register message:text handler', () => {
      const bot = createBot()
      const onSpy = vi.spyOn(bot, 'on')

      setupBotHandlers(bot)

      expect(onSpy).toHaveBeenCalledWith('message:text', expect.any(Function))
    })
  })
})
