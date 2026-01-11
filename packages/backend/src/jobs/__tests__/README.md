# Job Queue System Tests

## Overview

This directory contains comprehensive tests for the BullMQ-based job queue system used for processing bookmarks asynchronously.

## Test Files

### `queue.test.ts`

Tests for the job queue implementation (`/Users/viral/Projects/Personal/plukd/packages/backend/src/jobs/queue.ts`).

**Test Coverage:**
- **Queue Configuration** (6 tests)
  - Correct queue name ("bookmark-processing")
  - Retry with 3 attempts
  - Exponential backoff (1s, 2s, 4s)
  - Completed job cleanup (1000 jobs or 24 hours)
  - Failed job retention (5000 jobs or 7 days)
  - Redis connection usage

- **enqueueBookmarkProcessing** (10 tests)
  - Adds job with correct data
  - Uses bookmark ID as job ID
  - Removes existing job before adding new one (idempotency)
  - Handles duplicate bookmarks
  - Handles Redis connection errors
  - Validates all required job data fields
  - Handles long URLs
  - Handles concurrent enqueues
  - Handles queue add failures
  - Handles job removal failures

- **getBookmarkJobStatus** (7 tests)
  - Returns null for non-existent jobs
  - Returns pending status for waiting jobs
  - Returns processing status with progress
  - Returns completed status
  - Returns failed status with error message
  - Handles multiple status checks consistently
  - Constructs correct job ID

- **Retry Logic** (3 tests)
  - Retries failed jobs up to 3 times
  - Uses exponential backoff delay
  - Calculates correct backoff delays

- **Job Cleanup Policies** (4 tests)
  - Removes completed jobs after 1000 jobs
  - Removes completed jobs after 24 hours
  - Keeps failed jobs for 5000 jobs
  - Keeps failed jobs for 7 days

- **Queue Instance** (3 tests)
  - Exports bookmarkQueue instance
  - Has add method
  - Has getJob/getJobs methods

- **Job Data Validation** (3 tests)
  - Accepts valid bookmark job data
  - Handles special characters in URLs
  - Handles Unicode characters in URLs

- **Edge Cases** (3 tests)
  - Handles very long bookmark IDs
  - Handles empty job queue
  - Handles job state transitions

- **Error Recovery** (3 tests)
  - Handles getJob throwing error
  - Handles getState throwing error
  - Handles network interruption during enqueue

- **Concurrency** (2 tests)
  - Handles concurrent status checks
  - Handles race condition on job removal

**Total Tests:** 44+

### `worker.test.ts`

Tests for the worker implementation (`/Users/viral/Projects/Personal/plukd/packages/backend/src/jobs/worker.ts`).

**Test Coverage:**
- **Worker Initialization** (8 tests)
  - Waits for Redis connection before starting
  - Creates worker with correct queue name
  - Creates dedicated Redis connection for worker
  - Configures worker with concurrency of 5
  - Returns worker instance
  - Sets up event handlers (completed, failed, error, ready, active, stalled)
  - Does not create multiple workers if already started
  - Handles Redis connection delay

- **Job Processing** (4 tests)
  - Calls processor function for jobs
  - Processes bookmark job with correct data
  - Handles processor errors
  - Handles processor timeout

- **Worker Events** (8 tests)
  - Registers all event handlers (completed, failed, error, ready, active, stalled)
  - Handles completed event
  - Handles failed event with error
  - Handles error event
  - Handles stalled event

- **Worker Shutdown** (5 tests)
  - Closes worker gracefully
  - Handles stop when worker not started
  - Clears worker instance after stop
  - Allows restart after stop
  - Handles close errors gracefully

- **Worker Instance Management** (3 tests)
  - Returns null when no worker started
  - Returns worker instance after start
  - Returns null after stop

- **Redis Connection Configuration** (3 tests)
  - Configures Redis with maxRetriesPerRequest: null
  - Configures Redis with enableReadyCheck: false
  - Uses Redis URL from environment

- **Concurrent Job Processing** (3 tests)
  - Configures concurrency limit
  - Processes multiple jobs concurrently
  - Handles concurrent job failures independently

- **Error Handling** (3 tests)
  - Handles Redis connection failure during start
  - Handles worker creation error
  - Propagates job processing errors

- **Worker Lifecycle** (3 tests)
  - Handles complete start-process-stop cycle
  - Warns if starting already started worker
  - Handles rapid start-stop cycles

- **Job Logging** (4 tests)
  - Logs when processing job starts
  - Logs when job completes
  - Logs when job fails
  - Logs when worker is ready

**Total Tests:** 44+

## Mocking Strategy

### BullMQ Queue Mock

```typescript
vi.mock('bullmq', () => {
  const mockQueue = {
    add: vi.fn(),
    getJob: vi.fn(),
    getJobs: vi.fn(),
    removeJobs: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
  }

  return {
    Queue: class Queue {
      add = mockQueue.add
      getJob = mockQueue.getJob
      getJobs = mockQueue.getJobs
      removeJobs = mockQueue.removeJobs
      close = mockQueue.close
      on = mockQueue.on
    },
    Worker: class Worker {
      on = vi.fn()
      close = vi.fn()
    },
  }
})
```

### Redis Mock

```typescript
vi.mock('ioredis', () => ({
  Redis: class Redis {
    on = vi.fn()
    connect = vi.fn()
    disconnect = vi.fn()
    quit = vi.fn()
  },
}))

vi.mock('../../config/redis', () => ({
  redis: {
    on: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    quit: vi.fn(),
  },
  waitForRedis: vi.fn().mockResolvedValue(undefined),
}))
```

### Bookmark Processor Mock

```typescript
vi.mock('../processors/bookmark-processing', () => ({
  processBookmarkJob: vi.fn().mockResolvedValue(undefined),
}))
```

## Running Tests

```bash
# Run all job queue tests
pnpm test -- src/jobs/__tests__

# Run only queue tests
pnpm test -- src/jobs/__tests__/queue.test.ts

# Run only worker tests
pnpm test -- src/jobs/__tests__/worker.test.ts

# Run with coverage
pnpm test:coverage -- src/jobs/__tests__
```

## Key Testing Patterns

### 1. Testing Queue Configuration

```typescript
it('should configure retry with 3 attempts', () => {
  const { Queue } = require('bullmq')
  const queueConfig = Queue.mock.calls[0]?.[1]

  expect(queueConfig?.defaultJobOptions?.attempts).toBe(3)
})
```

### 2. Testing Job Enqueue

```typescript
it('should add job to queue with correct data', async () => {
  mockQueue.getJob.mockResolvedValue(null)
  mockQueue.add.mockResolvedValue({ id: TEST_JOB_ID })

  await enqueueBookmarkProcessing(TEST_BOOKMARK_ID, TEST_URL, TEST_USER_ID)

  expect(mockQueue.add).toHaveBeenCalledWith(
    'bookmark',
    {
      bookmarkId: TEST_BOOKMARK_ID,
      url: TEST_URL,
      userId: TEST_USER_ID,
    },
    { jobId: TEST_JOB_ID }
  )
})
```

### 3. Testing Job Status

```typescript
it('should return pending status for waiting job', async () => {
  const job = createMockJob(TEST_JOB_ID, mockData, 'waiting')
  mockQueue.getJob.mockResolvedValue(job)

  const status = await getBookmarkJobStatus(TEST_BOOKMARK_ID)

  expect(status).toEqual({
    id: TEST_JOB_ID,
    state: 'waiting',
    progress: 0,
    failedReason: undefined,
    attemptsMade: 0,
  })
})
```

### 4. Testing Worker Initialization

```typescript
it('should wait for Redis connection before starting', async () => {
  await startWorker()

  expect(waitForRedis).toHaveBeenCalled()
})
```

### 5. Testing Job Processing

```typescript
it('should call processor function for jobs', async () => {
  await startWorker()

  const processorFn = vi.mocked(Worker).mock.calls[0]?.[1]
  const mockJob = createMockJob('job-123')

  await processorFn?.(mockJob as Job)

  expect(processBookmarkJob).toHaveBeenCalledWith(mockJob)
})
```

## Test Fixtures

### Mock Job Helper

```typescript
function createMockJob(
  id: string,
  data: BookmarkProcessingJob,
  state: string = 'waiting',
  options?: {
    progress?: number
    failedReason?: string
    attemptsMade?: number
  }
): Partial<Job<BookmarkProcessingJob>> {
  return {
    id,
    data,
    progress: options?.progress || 0,
    failedReason: options?.failedReason,
    attemptsMade: options?.attemptsMade || 0,
    getState: vi.fn().mockResolvedValue(state),
    remove: vi.fn().mockResolvedValue(undefined),
  }
}
```

### Standard Test Values

```typescript
const TEST_BOOKMARK_ID = 'bookmark-123'
const TEST_USER_ID = 'user-456'
const TEST_URL = 'https://example.com/article'
const TEST_JOB_ID = `bookmark-${TEST_BOOKMARK_ID}`
```

## Queue Configuration Details

### Retry Strategy

- **Attempts:** 3
- **Backoff Type:** Exponential
- **Base Delay:** 1000ms
- **Delay Calculation:** `delay * (2 ^ attemptNumber)`
  - 1st retry: 1000ms
  - 2nd retry: 2000ms
  - 3rd retry: 4000ms

### Cleanup Policies

**Completed Jobs:**
- Removed after 1000 completed jobs in queue
- OR after 24 hours (86,400 seconds)

**Failed Jobs:**
- Kept for up to 5000 failed jobs in queue
- OR for 7 days (604,800 seconds)

### Worker Configuration

- **Queue Name:** `bookmark-processing`
- **Concurrency:** 5 concurrent jobs
- **Redis Connection:** Dedicated connection with:
  - `maxRetriesPerRequest: null` (required for BullMQ)
  - `enableReadyCheck: false`

## Coverage Goals

- **Statements:** 90%+
- **Branches:** 85%+
- **Functions:** 95%+
- **Lines:** 90%+

## Notes

- All Redis and BullMQ operations are mocked
- No real queue connections are made
- Tests are isolated and can run independently
- Each test clears mocks in `beforeEach`
- Worker shutdown is called in `afterEach` to prevent leaks
- All error paths and edge cases are tested
- Concurrency scenarios are tested
