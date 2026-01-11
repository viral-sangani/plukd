# Telegram Bot Handler Tests

## Overview

This directory contains comprehensive tests for the Telegram bot handlers in `/Users/viral/Projects/Personal/plukd/packages/backend/src/lib/telegram/bot.ts`.

## Test Files

### `bot-simplified.test.ts` (Recommended)

A simplified test suite that focuses on testing the actual handler behavior through the registered callbacks. This approach is more maintainable and easier to understand.

**Test Coverage:**
- **Bot Creation** (2 tests)
  - Creates bot with token from environment
  - Throws error when token is missing

- **Bot Setup** (2 tests)
  - Registers `/start` command handler
  - Registers `message:text` handler

- **Start Command Handler** (3+ tests)
  - Generates link code for new users
  - Confirms for existing linked users
  - Handles database errors gracefully

- **Text Message Handler** (7+ tests)
  - Creates bookmark from valid URLs
  - Handles multiple URLs in one message
  - Sends help message when no URLs found
  - Prompts to link account if user not found
  - Handles bookmark creation failures
  - Handles queue enqueue failures gracefully
  - Detects various URL sources (Twitter, Reddit, YouTube, etc.)

- **Source Detection** (8 tests)
  - Twitter/X.com URLs
  - Reddit URLs
  - YouTube/youtu.be URLs
  - LinkedIn URLs
  - Instagram URLs
  - Generic web URLs

- **URL Extraction** (6 tests)
  - Single URL extraction
  - Multiple URL extraction
  - Empty results when no URLs
  - URLs with query parameters
  - URLs with fragments
  - URLs from long messages

**Total Tests:** 28+

### `bot.test.ts` (Original - Complex)

The original comprehensive test suite with 36 tests. This file attempts to test by invoking Grammy's `handleUpdate` method directly, which is more complex and harder to maintain.

**Note:** This approach has compatibility issues with Grammy's internal handling and may require significant rework. Use `bot-simplified.test.ts` instead.

## Mocking Strategy

### Grammy Bot Mock

```typescript
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
```

### Supabase Mock

```typescript
vi.mock('../../../config/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

// Usage in tests:
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
          data: [{ id: 'bookmark-id', url: 'https://example.com' }],
          error: null,
        }),
      })),
    }
  }
  return {}
})
vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)
```

### Queue Mock

```typescript
vi.mock('../../../jobs/queue', () => ({
  enqueueBookmarkProcessing: vi.fn(),
}))
```

### Shared Utils Mock

```typescript
vi.mock('@plukd/shared', async () => {
  const actual = await vi.importActual('@plukd/shared')
  return {
    ...actual,
    extractUrls: vi.fn((text: string) => {
      const urlRegex = /(https?:\/\/[^\s]+)/g
      return text.match(urlRegex) || []
    }),
    detectSource: vi.fn((url: string) => {
      // Platform detection logic
    }),
  }
})
```

## Running Tests

```bash
# Run all Telegram bot tests
pnpm test -- src/lib/telegram/__tests__

# Run only simplified tests
pnpm test -- src/lib/telegram/__tests__/bot-simplified.test.ts

# Run with coverage
pnpm test:coverage -- src/lib/telegram/__tests__
```

## Key Testing Patterns

### 1. Testing Handler Registration

```typescript
it('should register /start command handler', () => {
  const bot = createBot()
  setupBotHandlers(bot as never)

  expect(mockBot.command).toHaveBeenCalledWith('start', expect.any(Function))
})
```

### 2. Testing Handler Behavior

```typescript
it('should create bookmark from valid URL', async () => {
  // Setup mocks
  const mockFrom = vi.fn(/* ... */)
  vi.mocked(supabaseAdmin.from).mockImplementation(mockFrom as never)

  // Get registered handler
  const bot = createBot()
  setupBotHandlers(bot as never)
  const messageHandler = mockBot.on.mock.calls.find(
    (call) => call[0] === 'message:text'
  )?.[1]

  // Create context and invoke handler
  const ctx = createMockContext('https://example.com')
  await messageHandler?.(ctx)

  // Verify expectations
  expect(mockFrom).toHaveBeenCalledWith('bookmarks')
  expect(enqueueBookmarkProcessing).toHaveBeenCalled()
})
```

### 3. Testing Error Handling

```typescript
it('should handle bookmark creation failure', async () => {
  // Setup error response
  const mockFrom = vi.fn((table: string) => {
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
  })

  // Test should not enqueue job
  expect(enqueueBookmarkProcessing).not.toHaveBeenCalled()
})
```

## Test Data

### Standard Test Values

```typescript
const TEST_USER_ID = 'test-user-id-123'
const TEST_CHAT_ID = '123456789'
const TEST_USERNAME = 'testuser'
```

### Mock Context Helper

```typescript
function createMockContext(
  messageText: string = '',
  chatId: string = TEST_CHAT_ID,
  username?: string
): Context {
  return {
    message: {
      text: messageText,
      from: { id: parseInt(chatId), username: username || TEST_USERNAME },
      chat: { id: parseInt(chatId) },
    },
    chat: { id: parseInt(chatId) },
    from: { id: parseInt(chatId), username: username || TEST_USERNAME },
    reply: vi.fn().mockResolvedValue({}),
  } as unknown as Context
}
```

## Coverage Goals

- **Statements:** 90%+
- **Branches:** 85%+
- **Functions:** 95%+
- **Lines:** 90%+

## Notes

- All external services (Supabase, BullMQ, Telegram) are mocked
- No real network calls are made
- Tests are isolated and can run independently
- Each test clears mocks in `beforeEach`
- All error paths are tested
