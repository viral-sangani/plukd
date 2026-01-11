import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import type { Job } from 'bullmq'

// Use vi.hoisted to define mocks before vi.mock hoisting
const { mockQueue, lastQueueConfig } = vi.hoisted(() => {
  return {
    mockQueue: {
      add: vi.fn(),
      getJob: vi.fn(),
      getJobs: vi.fn(),
      removeJobs: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    },
    // Store the last queue config for tests
    lastQueueConfig: { value: null as unknown },
  }
})

// Mock Redis before importing queue
vi.mock('../../config/redis', () => ({
  redis: {
    on: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    quit: vi.fn(),
  },
  waitForRedis: vi.fn().mockResolvedValue(undefined),
}))

// Mock BullMQ - use the hoisted mockQueue
vi.mock('bullmq', () => {
  // Use a class to make it a proper constructor
  class MockQueue {
    constructor(queueName: string, config?: unknown) {
      lastQueueConfig.value = config
      return mockQueue as unknown as MockQueue
    }
  }

  return {
    Queue: MockQueue,
    Worker: class Worker {
      on = vi.fn()
      close = vi.fn()
    },
  }
})

vi.mock('ioredis', () => ({
  Redis: class Redis {
    on = vi.fn()
    connect = vi.fn()
    disconnect = vi.fn()
    quit = vi.fn()
  },
}))

import {
  enqueueBookmarkProcessing,
  getBookmarkJobStatus,
  bookmarkQueue,
  QUEUE_NAMES,
  type BookmarkProcessingJob,
} from '../queue'

/**
 * Test Fixtures
 */
const TEST_BOOKMARK_ID = 'bookmark-123'
const TEST_USER_ID = 'user-456'
const TEST_URL = 'https://example.com/article'
const TEST_JOB_ID = `bookmark-${TEST_BOOKMARK_ID}`

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

/**
 * Test Suite: Job Queue System
 */
describe('Job Queue System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Test Suite: Queue Configuration
   */
  describe('Queue Configuration', () => {
    it('should use correct queue name', () => {
      expect(QUEUE_NAMES.BOOKMARK_PROCESSING).toBe('bookmark-processing')
    })

    it('should configure retry with 3 attempts', () => {
      const queueConfig = lastQueueConfig.value as { defaultJobOptions?: { attempts?: number } }

      expect(queueConfig?.defaultJobOptions?.attempts).toBe(3)
    })

    it('should configure exponential backoff', () => {
      const queueConfig = lastQueueConfig.value as { defaultJobOptions?: { backoff?: { type?: string; delay?: number } } }

      expect(queueConfig?.defaultJobOptions?.backoff?.type).toBe('exponential')
      expect(queueConfig?.defaultJobOptions?.backoff?.delay).toBe(1000)
    })

    it('should configure completed job cleanup', () => {
      const queueConfig = lastQueueConfig.value as { defaultJobOptions?: { removeOnComplete?: { count?: number; age?: number } } }

      expect(queueConfig?.defaultJobOptions?.removeOnComplete?.count).toBe(1000)
      expect(queueConfig?.defaultJobOptions?.removeOnComplete?.age).toBe(24 * 3600)
    })

    it('should configure failed job retention', () => {
      const queueConfig = lastQueueConfig.value as { defaultJobOptions?: { removeOnFail?: { count?: number; age?: number } } }

      expect(queueConfig?.defaultJobOptions?.removeOnFail?.count).toBe(5000)
      expect(queueConfig?.defaultJobOptions?.removeOnFail?.age).toBe(7 * 24 * 3600)
    })

    it('should use Redis connection from config', () => {
      const queueConfig = lastQueueConfig.value as { connection?: unknown }

      expect(queueConfig?.connection).toBeDefined()
    })
  })

  /**
   * Test Suite: enqueueBookmarkProcessing
   */
  describe('enqueueBookmarkProcessing', () => {
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

    it('should use bookmark ID as job ID', async () => {
      mockQueue.getJob.mockResolvedValue(null)
      mockQueue.add.mockResolvedValue({ id: TEST_JOB_ID })

      await enqueueBookmarkProcessing(TEST_BOOKMARK_ID, TEST_URL, TEST_USER_ID)

      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ jobId: `bookmark-${TEST_BOOKMARK_ID}` })
      )
    })

    it('should remove existing job before adding new one', async () => {
      const existingJob = createMockJob(
        TEST_JOB_ID,
        { bookmarkId: TEST_BOOKMARK_ID, url: TEST_URL, userId: TEST_USER_ID },
        'waiting'
      )
      mockQueue.getJob.mockResolvedValue(existingJob)
      mockQueue.add.mockResolvedValue({ id: TEST_JOB_ID })

      await enqueueBookmarkProcessing(TEST_BOOKMARK_ID, TEST_URL, TEST_USER_ID)

      expect(existingJob.remove).toHaveBeenCalled()
      expect(mockQueue.add).toHaveBeenCalled()
    })

    it('should handle duplicate bookmark idempotently', async () => {
      const existingJob = createMockJob(
        TEST_JOB_ID,
        { bookmarkId: TEST_BOOKMARK_ID, url: TEST_URL, userId: TEST_USER_ID },
        'completed'
      )
      mockQueue.getJob.mockResolvedValue(existingJob)
      mockQueue.add.mockResolvedValue({ id: TEST_JOB_ID })

      await enqueueBookmarkProcessing(TEST_BOOKMARK_ID, TEST_URL, TEST_USER_ID)

      expect(existingJob.remove).toHaveBeenCalled()
      expect(mockQueue.add).toHaveBeenCalledTimes(1)
    })

    it('should handle Redis connection error', async () => {
      mockQueue.getJob.mockRejectedValue(new Error('Redis connection failed'))

      await expect(
        enqueueBookmarkProcessing(TEST_BOOKMARK_ID, TEST_URL, TEST_USER_ID)
      ).rejects.toThrow('Redis connection failed')
    })

    it('should include all required job data fields', async () => {
      mockQueue.getJob.mockResolvedValue(null)
      mockQueue.add.mockResolvedValue({ id: TEST_JOB_ID })

      await enqueueBookmarkProcessing(TEST_BOOKMARK_ID, TEST_URL, TEST_USER_ID)

      const addCall = mockQueue.add.mock.calls[0]
      const jobData = addCall[1] as BookmarkProcessingJob

      expect(jobData).toHaveProperty('bookmarkId', TEST_BOOKMARK_ID)
      expect(jobData).toHaveProperty('url', TEST_URL)
      expect(jobData).toHaveProperty('userId', TEST_USER_ID)
    })

    it('should handle job with long URL', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000) + '?param=' + 'b'.repeat(1000)
      mockQueue.getJob.mockResolvedValue(null)
      mockQueue.add.mockResolvedValue({ id: TEST_JOB_ID })

      await enqueueBookmarkProcessing(TEST_BOOKMARK_ID, longUrl, TEST_USER_ID)

      expect(mockQueue.add).toHaveBeenCalledWith(
        'bookmark',
        expect.objectContaining({
          url: longUrl,
        }),
        expect.any(Object)
      )
    })

    it('should handle concurrent enqueues for different bookmarks', async () => {
      mockQueue.getJob.mockResolvedValue(null)
      mockQueue.add.mockResolvedValue({ id: 'some-job-id' })

      const promises = [
        enqueueBookmarkProcessing('bookmark-1', 'https://example1.com', TEST_USER_ID),
        enqueueBookmarkProcessing('bookmark-2', 'https://example2.com', TEST_USER_ID),
        enqueueBookmarkProcessing('bookmark-3', 'https://example3.com', TEST_USER_ID),
      ]

      await Promise.all(promises)

      expect(mockQueue.add).toHaveBeenCalledTimes(3)
    })

    it('should handle queue add failure', async () => {
      mockQueue.getJob.mockResolvedValue(null)
      mockQueue.add.mockRejectedValue(new Error('Queue is full'))

      await expect(
        enqueueBookmarkProcessing(TEST_BOOKMARK_ID, TEST_URL, TEST_USER_ID)
      ).rejects.toThrow('Queue is full')
    })

    it('should handle job removal failure gracefully', async () => {
      const existingJob = createMockJob(
        TEST_JOB_ID,
        { bookmarkId: TEST_BOOKMARK_ID, url: TEST_URL, userId: TEST_USER_ID },
        'active'
      )
      existingJob.remove = vi.fn().mockRejectedValue(new Error('Cannot remove active job'))
      mockQueue.getJob.mockResolvedValue(existingJob)

      await expect(
        enqueueBookmarkProcessing(TEST_BOOKMARK_ID, TEST_URL, TEST_USER_ID)
      ).rejects.toThrow()
    })
  })

  /**
   * Test Suite: getBookmarkJobStatus
   */
  describe('getBookmarkJobStatus', () => {
    it('should return null for non-existent job', async () => {
      mockQueue.getJob.mockResolvedValue(null)

      const status = await getBookmarkJobStatus(TEST_BOOKMARK_ID)

      expect(status).toBeNull()
    })

    it('should return pending status for waiting job', async () => {
      const job = createMockJob(
        TEST_JOB_ID,
        { bookmarkId: TEST_BOOKMARK_ID, url: TEST_URL, userId: TEST_USER_ID },
        'waiting'
      )
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

    it('should return processing status with progress', async () => {
      const job = createMockJob(
        TEST_JOB_ID,
        { bookmarkId: TEST_BOOKMARK_ID, url: TEST_URL, userId: TEST_USER_ID },
        'active',
        { progress: 50 }
      )
      mockQueue.getJob.mockResolvedValue(job)

      const status = await getBookmarkJobStatus(TEST_BOOKMARK_ID)

      expect(status?.state).toBe('active')
      expect(status?.progress).toBe(50)
    })

    it('should return completed status', async () => {
      const job = createMockJob(
        TEST_JOB_ID,
        { bookmarkId: TEST_BOOKMARK_ID, url: TEST_URL, userId: TEST_USER_ID },
        'completed',
        { progress: 100 }
      )
      mockQueue.getJob.mockResolvedValue(job)

      const status = await getBookmarkJobStatus(TEST_BOOKMARK_ID)

      expect(status?.state).toBe('completed')
    })

    it('should return failed status with error message', async () => {
      const job = createMockJob(
        TEST_JOB_ID,
        { bookmarkId: TEST_BOOKMARK_ID, url: TEST_URL, userId: TEST_USER_ID },
        'failed',
        {
          failedReason: 'Content extraction failed',
          attemptsMade: 3,
        }
      )
      mockQueue.getJob.mockResolvedValue(job)

      const status = await getBookmarkJobStatus(TEST_BOOKMARK_ID)

      expect(status?.state).toBe('failed')
      expect(status?.failedReason).toBe('Content extraction failed')
      expect(status?.attemptsMade).toBe(3)
    })

    it('should handle multiple status checks consistently', async () => {
      const job = createMockJob(
        TEST_JOB_ID,
        { bookmarkId: TEST_BOOKMARK_ID, url: TEST_URL, userId: TEST_USER_ID },
        'active',
        { progress: 75 }
      )
      mockQueue.getJob.mockResolvedValue(job)

      const status1 = await getBookmarkJobStatus(TEST_BOOKMARK_ID)
      const status2 = await getBookmarkJobStatus(TEST_BOOKMARK_ID)

      expect(status1).toEqual(status2)
    })

    it('should construct correct job ID from bookmark ID', async () => {
      mockQueue.getJob.mockResolvedValue(null)

      await getBookmarkJobStatus(TEST_BOOKMARK_ID)

      expect(mockQueue.getJob).toHaveBeenCalledWith(`bookmark-${TEST_BOOKMARK_ID}`)
    })
  })

  /**
   * Test Suite: Retry Logic
   */
  describe('Retry Logic', () => {
    it('should retry failed jobs up to 3 times', () => {
      const queueConfig = lastQueueConfig.value as { defaultJobOptions?: { attempts?: number } }

      expect(queueConfig?.defaultJobOptions?.attempts).toBe(3)
    })

    it('should use exponential backoff delay', () => {
      const queueConfig = lastQueueConfig.value as { defaultJobOptions?: { backoff?: { type?: string; delay?: number } } }

      // First retry: 1000ms
      // Second retry: 2000ms
      // Third retry: 4000ms
      expect(queueConfig?.defaultJobOptions?.backoff?.type).toBe('exponential')
      expect(queueConfig?.defaultJobOptions?.backoff?.delay).toBe(1000)
    })

    it('should calculate correct backoff delays', () => {
      const queueConfig = lastQueueConfig.value as { defaultJobOptions?: { backoff?: { type?: string; delay?: number } } }
      const baseDelay = queueConfig?.defaultJobOptions?.backoff?.delay ?? 0

      // Exponential backoff formula: delay * (2 ^ attemptNumber)
      const attempt1Delay = baseDelay * Math.pow(2, 0) // 1000ms
      const attempt2Delay = baseDelay * Math.pow(2, 1) // 2000ms
      const attempt3Delay = baseDelay * Math.pow(2, 2) // 4000ms

      expect(attempt1Delay).toBe(1000)
      expect(attempt2Delay).toBe(2000)
      expect(attempt3Delay).toBe(4000)
    })
  })

  /**
   * Test Suite: Job Cleanup Policies
   */
  describe('Job Cleanup Policies', () => {
    it('should remove completed jobs after 1000 jobs', () => {
      const queueConfig = lastQueueConfig.value as { defaultJobOptions?: { removeOnComplete?: { count?: number; age?: number } } }

      expect(queueConfig?.defaultJobOptions?.removeOnComplete?.count).toBe(1000)
    })

    it('should remove completed jobs after 24 hours', () => {
      const queueConfig = lastQueueConfig.value as { defaultJobOptions?: { removeOnComplete?: { count?: number; age?: number } } }

      const expectedSeconds = 24 * 3600
      expect(queueConfig?.defaultJobOptions?.removeOnComplete?.age).toBe(expectedSeconds)
    })

    it('should keep failed jobs for 5000 jobs', () => {
      const queueConfig = lastQueueConfig.value as { defaultJobOptions?: { removeOnFail?: { count?: number; age?: number } } }

      expect(queueConfig?.defaultJobOptions?.removeOnFail?.count).toBe(5000)
    })

    it('should keep failed jobs for 7 days', () => {
      const queueConfig = lastQueueConfig.value as { defaultJobOptions?: { removeOnFail?: { count?: number; age?: number } } }

      const expectedSeconds = 7 * 24 * 3600
      expect(queueConfig?.defaultJobOptions?.removeOnFail?.age).toBe(expectedSeconds)
    })
  })

  /**
   * Test Suite: Queue Instance
   */
  describe('Queue Instance', () => {
    it('should export bookmarkQueue instance', () => {
      expect(bookmarkQueue).toBeDefined()
    })

    it('should have add method', () => {
      expect(bookmarkQueue.add).toBeDefined()
      expect(typeof bookmarkQueue.add).toBe('function')
    })

    it('should have getJob method', () => {
      expect(bookmarkQueue.getJob).toBeDefined()
      expect(typeof bookmarkQueue.getJob).toBe('function')
    })

    it('should have getJobs method', () => {
      expect(bookmarkQueue.getJobs).toBeDefined()
      expect(typeof bookmarkQueue.getJobs).toBe('function')
    })
  })

  /**
   * Test Suite: Job Data Validation
   */
  describe('Job Data Validation', () => {
    it('should accept valid bookmark job data', async () => {
      mockQueue.getJob.mockResolvedValue(null)
      mockQueue.add.mockResolvedValue({ id: TEST_JOB_ID })

      const validData: BookmarkProcessingJob = {
        bookmarkId: TEST_BOOKMARK_ID,
        url: TEST_URL,
        userId: TEST_USER_ID,
      }

      await expect(
        enqueueBookmarkProcessing(validData.bookmarkId, validData.url, validData.userId)
      ).resolves.not.toThrow()
    })

    it('should handle special characters in URL', async () => {
      const specialUrl = 'https://example.com/path?q=test&x=1#section'
      mockQueue.getJob.mockResolvedValue(null)
      mockQueue.add.mockResolvedValue({ id: TEST_JOB_ID })

      await enqueueBookmarkProcessing(TEST_BOOKMARK_ID, specialUrl, TEST_USER_ID)

      expect(mockQueue.add).toHaveBeenCalledWith(
        'bookmark',
        expect.objectContaining({ url: specialUrl }),
        expect.any(Object)
      )
    })

    it('should handle Unicode characters in URL', async () => {
      const unicodeUrl = 'https://example.com/日本語/page'
      mockQueue.getJob.mockResolvedValue(null)
      mockQueue.add.mockResolvedValue({ id: TEST_JOB_ID })

      await enqueueBookmarkProcessing(TEST_BOOKMARK_ID, unicodeUrl, TEST_USER_ID)

      expect(mockQueue.add).toHaveBeenCalledWith(
        'bookmark',
        expect.objectContaining({ url: unicodeUrl }),
        expect.any(Object)
      )
    })
  })

  /**
   * Test Suite: Edge Cases
   */
  describe('Edge Cases', () => {
    it('should handle very long bookmark IDs', async () => {
      const longId = 'bookmark-' + 'x'.repeat(500)
      mockQueue.getJob.mockResolvedValue(null)
      mockQueue.add.mockResolvedValue({ id: `bookmark-${longId}` })

      await enqueueBookmarkProcessing(longId, TEST_URL, TEST_USER_ID)

      expect(mockQueue.add).toHaveBeenCalledWith(
        'bookmark',
        expect.objectContaining({ bookmarkId: longId }),
        expect.any(Object)
      )
    })

    it('should handle empty job queue', async () => {
      mockQueue.getJobs.mockResolvedValue([])

      const jobs = await bookmarkQueue.getJobs()

      expect(jobs).toEqual([])
    })

    it('should handle job state transitions', async () => {
      const job = createMockJob(
        TEST_JOB_ID,
        { bookmarkId: TEST_BOOKMARK_ID, url: TEST_URL, userId: TEST_USER_ID },
        'waiting'
      )
      mockQueue.getJob.mockResolvedValue(job)

      const status1 = await getBookmarkJobStatus(TEST_BOOKMARK_ID)
      expect(status1?.state).toBe('waiting')

      // Simulate state change
      job.getState = vi.fn().mockResolvedValue('active')
      const status2 = await getBookmarkJobStatus(TEST_BOOKMARK_ID)
      expect(status2?.state).toBe('active')

      // Simulate completion
      job.getState = vi.fn().mockResolvedValue('completed')
      const status3 = await getBookmarkJobStatus(TEST_BOOKMARK_ID)
      expect(status3?.state).toBe('completed')
    })
  })

  /**
   * Test Suite: Error Recovery
   */
  describe('Error Recovery', () => {
    it('should handle getJob throwing error', async () => {
      mockQueue.getJob.mockRejectedValue(new Error('Redis timeout'))

      await expect(getBookmarkJobStatus(TEST_BOOKMARK_ID)).rejects.toThrow('Redis timeout')
    })

    it('should handle getState throwing error', async () => {
      const job = createMockJob(
        TEST_JOB_ID,
        { bookmarkId: TEST_BOOKMARK_ID, url: TEST_URL, userId: TEST_USER_ID },
        'active'
      )
      job.getState = vi.fn().mockRejectedValue(new Error('State unavailable'))
      mockQueue.getJob.mockResolvedValue(job)

      await expect(getBookmarkJobStatus(TEST_BOOKMARK_ID)).rejects.toThrow('State unavailable')
    })

    it('should handle network interruption during enqueue', async () => {
      mockQueue.getJob.mockResolvedValue(null)
      mockQueue.add.mockRejectedValue(new Error('Network error'))

      await expect(
        enqueueBookmarkProcessing(TEST_BOOKMARK_ID, TEST_URL, TEST_USER_ID)
      ).rejects.toThrow('Network error')
    })
  })

  /**
   * Test Suite: Concurrency
   */
  describe('Concurrency', () => {
    it('should handle concurrent status checks', async () => {
      const job = createMockJob(
        TEST_JOB_ID,
        { bookmarkId: TEST_BOOKMARK_ID, url: TEST_URL, userId: TEST_USER_ID },
        'active'
      )
      mockQueue.getJob.mockResolvedValue(job)

      const promises = Array.from({ length: 10 }, () => getBookmarkJobStatus(TEST_BOOKMARK_ID))

      const results = await Promise.all(promises)

      results.forEach((result) => {
        expect(result?.state).toBe('active')
      })
    })

    it('should handle race condition on job removal', async () => {
      const existingJob = createMockJob(
        TEST_JOB_ID,
        { bookmarkId: TEST_BOOKMARK_ID, url: TEST_URL, userId: TEST_USER_ID },
        'waiting'
      )
      mockQueue.getJob.mockResolvedValue(existingJob)
      mockQueue.add.mockResolvedValue({ id: TEST_JOB_ID })

      // Enqueue twice simultaneously
      const promises = [
        enqueueBookmarkProcessing(TEST_BOOKMARK_ID, TEST_URL, TEST_USER_ID),
        enqueueBookmarkProcessing(TEST_BOOKMARK_ID, TEST_URL, TEST_USER_ID),
      ]

      await Promise.all(promises)

      // Both should succeed (idempotency)
      expect(mockQueue.add).toHaveBeenCalledTimes(2)
    })
  })
})
