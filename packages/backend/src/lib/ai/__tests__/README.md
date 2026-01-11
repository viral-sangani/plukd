# AI Processing Pipeline Tests

This directory contains comprehensive tests for the multi-pass AI processing pipeline used to classify and summarize bookmarked content.

## Test Coverage

### process.test.ts
**43 test cases** covering the three-pass AI processing system:

#### Coverage Metrics
- **Line Coverage**: 93.51%
- **Function Coverage**: 100%
- **Branch Coverage**: 87.85%

#### Test Suites

1. **classifyContent** (19 tests)
   - Text-only and multimodal (with images) classification
   - All 46 categories tested (ai, blockchain, startups, design, etc.)
   - All 20 tags tested (tutorial, guide, video, news, etc.)
   - All 7 content types tested (article, thread, video, discussion, announcement, list, other)
   - Edge cases: very short content, very long content, special characters
   - Error handling: API failures, invalid inputs
   - Image validation: trusted domains only, max 4 images limit
   - List indicators for adaptive truncation

2. **summarizeContent** (12 tests)
   - Blurb (2-3 sentences) and detailed summary generation
   - Classification context usage in prompts
   - Multimodal support with images
   - Edge cases: empty content, minimal content
   - Error handling: API failures
   - Blurb length constraints (2-3 sentences)
   - Summary quality (longer than blurb)
   - Key takeaways generation (3-5 items)
   - Resource extraction for list content
   - List indicators for enhanced extraction

3. **extractListItems** (6 tests)
   - List item extraction with titles and descriptions
   - Minimal results when no items found
   - Full content usage for maximum accuracy
   - Partial extraction confidence handling
   - Error handling: API failures
   - All confidence levels tested (complete, partial, uncertain)

4. **processContent** (6 tests)
   - Complete orchestration of classification + summarization
   - List content triggers dedicated extraction (Pass 3)
   - Comparison logic: uses extraction with more items
   - Fallback to summarization when extraction finds fewer items
   - Error propagation from classification failures
   - Graceful handling of list extraction failures (non-fatal)

5. **processContentWithRetry** (3 tests)
   - Success on first attempt (no retries)
   - Retry on failure with exponential backoff
   - Retry exhaustion throws error after max attempts
   - Default max retries: 3
   - Exponential backoff delays: 1s, 2s, 4s

## Testing Strategy

### Mocking Approach
- **Vercel AI SDK** (`generateObject`): Mocked to return controlled responses
- **Google Gemini Models**: Mocked via `@ai-sdk/google`
- **External Services**: No real API calls made during tests

### Test Data Helpers
- `createMockContent()`: Creates mock ExtractedContent objects
- `createMockClassification()`: Creates mock classification results
- `createMockSummarization()`: Creates mock summarization results
- `createListIndicators()`: Creates mock list detection indicators

### Test Organization
- **Arrange-Act-Assert** pattern throughout
- **beforeEach**: Clears all mocks for test isolation
- **afterEach**: Restores all mocks
- **describe** blocks organize tests by function

## Key Test Scenarios

### Happy Paths
✅ Text-only content classification and summarization
✅ Multimodal content with images
✅ List content with dedicated extraction
✅ All categories, tags, and content types
✅ Complete end-to-end pipeline

### Edge Cases
✅ Very short content (1 word)
✅ Very long content (10,000 characters)
✅ Empty content
✅ Special characters and emojis
✅ Invalid image URLs
✅ More than 4 images (limit enforcement)

### Error Handling
✅ API quota exceeded errors
✅ Service unavailable errors
✅ Network errors
✅ Classification failures propagate
✅ Summarization failures propagate
✅ List extraction failures are non-fatal

### Business Logic
✅ List extraction only runs for list contentType
✅ Dedicated extraction used when it finds more items
✅ Summarization extraction used when dedicated finds fewer items
✅ Retry logic with exponential backoff
✅ Image filtering to trusted domains only
✅ Image limit enforcement (max 4)

## Running Tests

```bash
# Run all AI process tests
bun test src/lib/ai/__tests__/process.test.ts

# Run with coverage
bun test --coverage src/lib/ai/__tests__/process.test.ts

# Watch mode
bun test --watch src/lib/ai/__tests__/process.test.ts
```

## Future Improvements

### Additional Test Cases
- [ ] Test all 35 categories individually (currently sampling 4)
- [ ] Test all 20 tags in various combinations
- [ ] Test all 7 resource layout hints
- [ ] Test all 4 takeaway types individually
- [ ] Test multimodal with different image counts (1, 2, 3, 4)
- [ ] Test image validation for all trusted domains
- [ ] Test exponential backoff timing precisely

### Integration Tests
- [ ] End-to-end tests with real (but mocked) AI responses
- [ ] Tests with actual extracted content from fixtures
- [ ] Tests with various real-world content patterns

### Performance Tests
- [ ] Test with large content (>50k characters)
- [ ] Test with many images (>10)
- [ ] Test retry delays with timing assertions

## Notes

- All tests use Vitest (not Jest) as per project standards
- Tests never hit real blockchain or external APIs
- Mock responses are deterministic (no flaky tests)
- All tests can run independently
- Tests use meaningful assertions (not just `toBeDefined()`)
- Financial calculations would use Decimal.js (not applicable here)
