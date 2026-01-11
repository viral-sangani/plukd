# Bookmark Processing Pipeline Tests

Comprehensive test suite for the bookmark processing pipeline (`bookmark-processing.ts`).

## Test Coverage

**Total Tests: 64** ✅ All Passing

### Test Categories

#### 1. Happy Path Tests (8 tests)
- ✅ Complete end-to-end success flow
- ✅ Progress tracking (10%, 20%, 40%, 50%, 80%, 90%, 100%)
- ✅ Status transitions (pending → processing → completed)
- ✅ All content sources (Twitter, Reddit, YouTube, LinkedIn, Instagram, Web)
- ✅ Multimodal content with images
- ✅ List content type with extracted resources

#### 2. Extraction Fallback Tests (10 tests)
- ✅ Primary extraction success
- ✅ Fallback to OG metadata for web URLs
- ✅ No OG fallback for non-web sources (Twitter, Reddit, etc.)
- ✅ Fallback content when all extraction fails
- ✅ OG metadata enhancement only for web sources
- ✅ Error handling for OG extraction failures
- ✅ Extraction throwing errors vs returning null
- ✅ Empty and partial OG metadata handling

#### 3. AI Processing Error Recovery Tests (12 tests)
- ✅ Save extracted content when AI fails
- ✅ Mark as failed when AI fails without extraction
- ✅ AI retry exhaustion handling
- ✅ Error context stored in processing_error field
- ✅ Non-Error object handling (string errors)
- ✅ Classification vs summarization failures
- ✅ Graceful degradation with incomplete AI data
- ✅ Preserved metadata when AI fails
- ✅ Timeout handling
- ✅ Different error message types

#### 4. Embedding Generation Tests (8 tests)
- ✅ Successful embedding generation and save
- ✅ Non-blocking failure (job continues)
- ✅ Database save failure handling
- ✅ Null and empty keyTakeaways handling
- ✅ Warning logs on failure
- ✅ Timeout handling
- ✅ Invalid embedding format handling

#### 5. Database Error Tests (6 tests)
- ✅ Final update failure
- ✅ RLS policy violations
- ✅ Bookmark not found errors
- ✅ Partial state prevention
- ✅ Database timeout handling
- ✅ Concurrent update conflicts

#### 6. Status and Progress Tests (8 tests)
- ✅ Status set to 'processing' at start
- ✅ Status set to 'completed' on success
- ✅ Status set to 'failed' on errors
- ✅ Progress tracking 0-100
- ✅ Progress continues even when embedding fails
- ✅ Progress never exceeds 100
- ✅ Progress in ascending order
- ✅ Processing_error cleared on success

#### 7. Edge Cases Tests (12 tests)
- ✅ Very long URLs (>1000 characters)
- ✅ Very short content
- ✅ Empty content string
- ✅ Missing user_id
- ✅ Invalid bookmark ID format (non-UUID)
- ✅ URLs with special characters
- ✅ URLs with fragments
- ✅ Extraction with no title
- ✅ Content with only whitespace
- ✅ Minimal extraction (only required fields)

## Test Architecture

### Mocking Strategy

All external dependencies are mocked using Vitest:

- **Supabase**: Database operations and RPC calls
- **Extractors**: `extractContent()` and `extractOGMetadata()`
- **AI Processing**: `processContentWithRetry()` from AI module
- **Embeddings**: `generateBookmarkEmbedding()` and `formatEmbeddingForPostgres()`
- **Shared Utilities**: `detectSource()` and `generateFallbackTitle()`

### Test Fixtures

Helper functions create realistic mock data:
- `createMockJob()` - BullMQ job with bookmark data
- `createMockExtractedContent()` - Extracted content from various sources
- `createMockAIResult()` - AI classification and summarization results
- `createMockOGMetadata()` - Open Graph metadata
- `createMockEmbedding()` - 768-dimensional embedding vector

## Running Tests

```bash
# Run tests
npm test -- src/jobs/processors/__tests__/bookmark-processing.test.ts

# Run with watch mode
npm run test:watch -- src/jobs/processors/__tests__/bookmark-processing.test.ts

# Run with coverage
npm run test:coverage -- src/jobs/processors/__tests__/bookmark-processing.test.ts
```

## Test Principles

1. **Comprehensive Coverage**: Tests cover all success paths, error paths, and edge cases
2. **Isolation**: Each test is independent with proper setup and teardown
3. **Realistic Scenarios**: Test data mirrors real-world usage patterns
4. **Error Resilience**: Extensive testing of error recovery and graceful degradation
5. **Non-Blocking**: Validates that embedding failures don't block job completion
6. **Progress Tracking**: Ensures accurate progress reporting throughout pipeline

## Key Behaviors Tested

### Extraction Fallback Chain
1. Try platform-specific extractor (Twitter/Gopher, Parallel AI)
2. For web URLs: Try OG metadata extraction
3. Fall back to generated title and minimal content

### AI Error Recovery
- If extraction succeeded: Save extracted content, mark as failed
- If extraction failed: Mark as failed, throw error
- Always preserve as much data as possible

### Embedding Generation
- Non-blocking: Failures logged but don't fail the job
- Generated from: title + blurb + summary + key takeaways
- Saved via RPC function to PostgreSQL with pgvector

### Progress Milestones
- 10%: Status updated to 'processing'
- 20%: Starting extraction
- 40%: Extraction complete
- 50%: Starting AI processing
- 80%: AI processing complete
- 90%: Database updated
- 100%: Job complete (including embedding)

## Maintenance Notes

- Tests use Vitest (not Jest) per backend package configuration
- Mocks are defined at module level to work with Vitest's hoisting
- All database assertions check for 'bookmarks' table access
- Progress values are verified in ascending order
- Error tests validate both throwing and non-throwing scenarios
