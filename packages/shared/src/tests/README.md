# Shared Package Test Suite

This directory contains comprehensive test utilities and test suites for the `@plukd/shared` package.

## Test Coverage

- **Statements**: 100%
- **Branches**: 97.14%
- **Functions**: 100%
- **Lines**: 100%

Total test count: **295 tests** across all suites.

## Structure

```
src/tests/
├── __setup__.ts           # Global Vitest configuration and mocks
├── fixtures/              # Test data factories and samples
│   ├── bookmarks.ts      # Bookmark test data with all variations
│   ├── users.ts          # User test data
│   ├── metadata.ts       # Metadata samples for all platforms
│   └── urls.ts           # URL samples for all platforms
└── mocks/                 # Mock implementations
    └── dates.ts          # Date fixtures for time-dependent tests
```

## Test Fixtures

### Bookmarks (`fixtures/bookmarks.ts`)

Factory function for creating test bookmarks:

```typescript
import { createTestBookmark } from '../tests/fixtures/bookmarks'

const bookmark = createTestBookmark({
  source: 'twitter',
  title: 'Custom Title',
})
```

Predefined samples:
- `twitterBookmark`, `redditBookmark`, `youtubeBookmark`
- `linkedinBookmark`, `instagramBookmark`, `webBookmark`
- `minimalBookmark`, `maximalBookmark`
- `pendingBookmark`, `processingBookmark`, `failedBookmark`
- `archivedBookmark`
- `categorizedBookmarks` - Object with all categories

### Users (`fixtures/users.ts`)

Factory function for creating test users:

```typescript
import { createTestUser } from '../tests/fixtures/users'

const user = createTestUser({
  telegram_chat_id: '123456789',
})
```

Predefined samples:
- `basicUser`
- `linkedTelegramUser`
- `userWithoutName`, `userWithoutAvatar`
- `minimalUser`, `maximalUser`

### Metadata (`fixtures/metadata.ts`)

Platform-specific metadata samples:

```typescript
import { twitterMetadata, youtubeMetadata } from '../tests/fixtures/metadata'
```

Samples for all platforms:
- OpenGraph: `basicOGMetadata`, `minimalOGMetadata`, `maximalOGMetadata`
- Twitter: `twitterMetadata`, `minimalTwitterMetadata`
- Reddit: `redditMetadata`, `minimalRedditMetadata`
- YouTube: `youtubeMetadata`, `minimalYouTubeMetadata`
- LinkedIn: `linkedinMetadata`, `minimalLinkedInMetadata`
- Instagram: `instagramMetadata`, `instagramReelMetadata`
- Web: `webMetadata`, `minimalWebMetadata`

Combined raw metadata:
- `twitterRawMetadata`, `redditRawMetadata`, etc.

### URLs (`fixtures/urls.ts`)

Comprehensive URL samples for all platforms:

```typescript
import { twitterUrls, youtubeUrls } from '../tests/fixtures/urls'

// Use specific URL variations
const url = twitterUrls.xDomain // https://x.com/user/status/123
```

Available collections:
- `twitterUrls` - Twitter/X URLs (standard, xDomain, withQuery, etc.)
- `redditUrls` - Reddit URLs (standard, www, oldReddit, etc.)
- `youtubeUrls` - YouTube URLs (standard, short, withTimestamp, etc.)
- `linkedinUrls` - LinkedIn URLs (post, article, profile, etc.)
- `instagramUrls` - Instagram URLs (post, reel, profile, etc.)
- `webUrls` - Generic web URLs
- `edgeCaseUrls` - Edge cases (very long, special chars, etc.)
- `invalidUrls` - Invalid URL formats
- `textWithUrls` - Text samples containing URLs

### Dates (`mocks/dates.ts`)

Date fixtures for time-dependent tests:

```typescript
import {
  REFERENCE_DATE,
  twoMinutesAgo,
  oneHourAgo,
  createDateAgo
} from '../tests/mocks/dates'

// Use predefined dates
expect(formatRelativeTime(twoMinutesAgo)).toBe('2m ago')

// Create custom dates
const customDate = createDateAgo(5, 'hours')
```

Predefined date fixtures:
- Time ranges: `justNow`, `twoMinutesAgo`, `oneHourAgo`, `oneDayAgo`, etc.
- Future dates: `oneMinuteInFuture`, `oneHourInFuture`, etc.
- Edge cases: `epoch`, `leapYearDate`, `endOfYear`, etc.

Helper functions:
- `createDateAgo(value, unit)` - Create a date N units ago
- `createDateInFuture(value, unit)` - Create a date N units in the future

## Test Suites

### Utility Functions (`src/utils/__tests__/index.test.ts`)

Comprehensive tests for all 10 utility functions:

1. **detectSource** (17 tests) - URL source detection
2. **extractUrls** (9 tests) - URL extraction from text
3. **formatRelativeTime** (11 tests) - Relative time formatting
4. **formatDate** (6 tests) - Date formatting
5. **sleep** (3 tests) - Async delay utility
6. **extractYouTubeVideoId** (6 tests) - YouTube video ID extraction
7. **extractTwitterPostId** (5 tests) - Twitter post ID extraction
8. **debounce** (5 tests) - Function debouncing
9. **generateFallbackTitle** (25 tests) - Fallback title generation
10. **isTitleBad** (42 tests) - Title validation

Total: **129 tests** with 100% function coverage

### Validation Schemas (`src/validations/__tests__/bookmark.test.ts`)

Tests for Zod validation schemas:
- **106 tests** covering all bookmark validation rules

### Constants (`src/constants/__tests__/index.test.ts`)

Tests for constant definitions:
- **60 tests** ensuring all constants are properly defined

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage

# Run tests for specific file
pnpm vitest run src/utils/__tests__/index.test.ts
```

## Test Patterns

### Arrange-Act-Assert

All tests follow the AAA pattern:

```typescript
it('should do something', () => {
  // Arrange
  const input = createTestBookmark({ title: 'Test' })

  // Act
  const result = processBookmark(input)

  // Assert
  expect(result.title).toBe('Test')
})
```

### Using Fixtures

```typescript
import { twitterBookmark } from '../tests/fixtures/bookmarks'
import { linkedTelegramUser } from '../tests/fixtures/users'

it('should process Twitter bookmark', () => {
  const result = processBookmark(twitterBookmark)
  expect(result.source).toBe('twitter')
})
```

### Mocking Time

```typescript
import { vi, beforeEach, afterEach } from 'vitest'
import { REFERENCE_DATE } from '../tests/mocks/dates'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(REFERENCE_DATE)
})

afterEach(() => {
  vi.useRealTimers()
})

it('should format relative time', () => {
  const result = formatRelativeTime(twoMinutesAgo)
  expect(result).toBe('2m ago')
})
```

## Coverage Goals

- Minimum 80% coverage for all metrics
- 100% coverage for critical paths (financial calculations, data validation)
- All edge cases tested (null, undefined, empty, malformed inputs)
- Both success and error paths covered

## Best Practices

1. **Use fixtures** - Don't create test data inline
2. **Test edge cases** - null, undefined, empty, boundary values
3. **Mock external dependencies** - Never hit real APIs or databases
4. **Keep tests isolated** - Use beforeEach/afterEach for setup/cleanup
5. **Descriptive test names** - Use "should ..." format
6. **One assertion per test** - Keep tests focused
7. **Use type safety** - Import types from the main package

## Uncovered Branches

The current 97.14% branch coverage has 3 uncovered branches in defensive code paths:

- Line 231: `if (firstPart && ...)` - The `firstPart` check after `.filter(Boolean)`
- Line 253: `if (lastSegment)` - The `lastSegment` check after `.filter(Boolean)`
- Line 329: `onInstagramMatch[1]?.` - Optional chaining fallback

These are defensive programming checks that are virtually impossible to hit given the logic flow, but provide safety in case the code is refactored.
