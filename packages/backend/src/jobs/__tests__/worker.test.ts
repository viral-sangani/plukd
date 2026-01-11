import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Job } from 'bullmq'

// Use vi.hoisted to define mocks before vi.mock hoisting
const { mockWorkerInstance, mockQueue, mockRedisInstance, MockWorkerFn, shouldWorkerThrow, lastProcessor } = vi.hoisted(() => {
  const mockWorkerInstance = {
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  }
  const mockQueue = {
    add: vi.fn(),
    getJob: vi.fn(),
    getJobs: vi.fn(),
    removeJobs: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
  }
  const mockRedisInstance = {
    on: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    quit: vi.fn(),
  }

  // Create a mock function that tracks constructor calls
  const MockWorkerFn = vi.fn()

  // Flag to control whether Worker constructor should throw
  const shouldWorkerThrow = { value: false, error: new Error('Worker creation failed') }

  // Store the last processor function so tests can access it
  const lastProcessor: { fn: unknown } = { fn: null }

  return {
    mockWorkerInstance,
    mockQueue,
    mockRedisInstance,
    MockWorkerFn,
    shouldWorkerThrow,
    lastProcessor,
  }
})

vi.mock('bullmq', () => {
  // Create a class that wraps the mock function but returns the mock instance
  function MockWorker(queueName: string, processor: unknown, options?: unknown) {
    if (shouldWorkerThrow.value) {
      shouldWorkerThrow.value = false // Reset for next use
      throw shouldWorkerThrow.error
    }
    MockWorkerFn(queueName, processor, options)
    // Store the processor so tests can access it even after vi.clearAllMocks()
    lastProcessor.fn = processor
    return mockWorkerInstance
  }

  function MockQueue() {
    return mockQueue
  }

  return {
    Worker: MockWorker,
    Queue: MockQueue,
    Job: vi.fn(),
  }
})

// Track Redis constructor calls
const { MockRedisFn } = vi.hoisted(() => {
  return {
    MockRedisFn: vi.fn(),
  }
})

vi.mock('ioredis', () => ({
  Redis: class Redis {
    on = mockRedisInstance.on
    connect = mockRedisInstance.connect
    disconnect = mockRedisInstance.disconnect
    quit = mockRedisInstance.quit

    constructor(...args: unknown[]) {
      MockRedisFn(...args)
    }
  },
}))

vi.mock('../../config/redis', () => ({
  redis: mockRedisInstance,
  waitForRedis: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../config/env', () => ({
  env: {
    REDIS_URL: 'redis://localhost:6379',
  },
}))

vi.mock('../processors/bookmark-processing', () => ({
  processBookmarkJob: vi.fn().mockResolvedValue(undefined),
}))

import { startWorker, stopWorker, getWorker } from '../worker'
import { QUEUE_NAMES } from '../queue'
import { waitForRedis } from '../../config/redis'
import { Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { processBookmarkJob } from '../processors/bookmark-processing'

/**
 * Test Fixtures
 */
const TEST_BOOKMARK_ID = 'bookmark-123'
const TEST_URL = 'https://example.com/article'
const TEST_USER_ID = 'user-456'

function createMockJob(id: string): Partial<Job> {
  return {
    id,
    data: {
      bookmarkId: TEST_BOOKMARK_ID,
      url: TEST_URL,
      userId: TEST_USER_ID,
    },
    updateProgress: vi.fn(),
    log: vi.fn(),
  }
}

/**
 * Test Suite: Worker System
 */
describe('Worker System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset processBookmarkJob mock to its default resolved value
    // This is needed because vi.clearAllMocks() clears the mock's return value
    vi.mocked(processBookmarkJob).mockResolvedValue(undefined)
  })

  afterEach(async () => {
    // Clean up worker instance after each test
    await stopWorker()
    vi.restoreAllMocks()
  })

  /**
   * Test Suite: Worker Initialization
   */
  describe('Worker Initialization', () => {
    it('should wait for Redis connection before starting', async () => {
      await startWorker()

      expect(waitForRedis).toHaveBeenCalled()
    })

    it('should create worker with correct queue name', async () => {
      await startWorker()

      expect(MockWorkerFn).toHaveBeenCalledWith(
        QUEUE_NAMES.BOOKMARK_PROCESSING,
        expect.any(Function),
        expect.any(Object)
      )
    })

    it('should create dedicated Redis connection for worker', async () => {
      await startWorker()

      expect(MockRedisFn).toHaveBeenCalledWith('redis://localhost:6379', {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      })
    })

    it('should configure worker with concurrency of 5', async () => {
      await startWorker()

      const workerConfig = MockWorkerFn.mock.calls[0]?.[2]
      expect(workerConfig?.concurrency).toBe(5)
    })

    it('should return worker instance', async () => {
      const worker = await startWorker()

      expect(worker).toBeDefined()
      expect(worker).toBe(mockWorkerInstance)
    })

    it('should set up event handlers', async () => {
      await startWorker()

      expect(mockWorkerInstance.on).toHaveBeenCalledWith('completed', expect.any(Function))
      expect(mockWorkerInstance.on).toHaveBeenCalledWith('failed', expect.any(Function))
      expect(mockWorkerInstance.on).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockWorkerInstance.on).toHaveBeenCalledWith('ready', expect.any(Function))
      expect(mockWorkerInstance.on).toHaveBeenCalledWith('active', expect.any(Function))
      expect(mockWorkerInstance.on).toHaveBeenCalledWith('stalled', expect.any(Function))
    })

    it('should not create multiple workers if already started', async () => {
      const worker1 = await startWorker()
      const worker2 = await startWorker()

      expect(worker1).toBe(worker2)
      expect(MockWorkerFn).toHaveBeenCalledTimes(1)
    })

    it('should handle Redis connection delay', async () => {
      vi.mocked(waitForRedis).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )

      const workerPromise = startWorker()

      // Worker should wait for Redis
      await expect(workerPromise).resolves.toBeDefined()
    })
  })

  /**
   * Test Suite: Job Processing
   */
  describe('Job Processing', () => {
    it('should call processor function for jobs', async () => {
      await startWorker()

      const processorFn = lastProcessor.fn as ((job: Job) => Promise<void>) | undefined
      const mockJob = createMockJob('job-123')

      await processorFn?.(mockJob as Job)

      expect(processBookmarkJob).toHaveBeenCalledWith(mockJob)
    })

    it('should process bookmark job with correct data', async () => {
      await startWorker()

      const processorFn = lastProcessor.fn as ((job: Job) => Promise<void>) | undefined
      const mockJob = createMockJob('job-123')

      await processorFn?.(mockJob as Job)

      expect(processBookmarkJob).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'job-123',
          data: {
            bookmarkId: TEST_BOOKMARK_ID,
            url: TEST_URL,
            userId: TEST_USER_ID,
          },
        })
      )
    })

    it('should handle processor errors', async () => {
      vi.mocked(processBookmarkJob).mockRejectedValueOnce(new Error('Processing failed'))

      await startWorker()

      const processorFn = lastProcessor.fn as ((job: Job) => Promise<void>) | undefined
      const mockJob = createMockJob('job-123')

      await expect(processorFn?.(mockJob as Job)).rejects.toThrow('Processing failed')
    })

    it('should handle processor timeout', async () => {
      vi.mocked(processBookmarkJob).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000))
      )

      await startWorker()

      const processorFn = lastProcessor.fn as ((job: Job) => Promise<void>) | undefined
      const mockJob = createMockJob('job-123')

      // Start processing but don't wait for completion
      const processingPromise = processorFn?.(mockJob as Job)

      expect(processingPromise).toBeDefined()
    })
  })

  /**
   * Test Suite: Worker Events
   */
  describe('Worker Events', () => {
    it('should register completed event handler', async () => {
      await startWorker()

      expect(mockWorkerInstance.on).toHaveBeenCalledWith('completed', expect.any(Function))
    })

    it('should register failed event handler', async () => {
      await startWorker()

      expect(mockWorkerInstance.on).toHaveBeenCalledWith('failed', expect.any(Function))
    })

    it('should register error event handler', async () => {
      await startWorker()

      expect(mockWorkerInstance.on).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('should register ready event handler', async () => {
      await startWorker()

      expect(mockWorkerInstance.on).toHaveBeenCalledWith('ready', expect.any(Function))
    })

    it('should register active event handler', async () => {
      await startWorker()

      expect(mockWorkerInstance.on).toHaveBeenCalledWith('active', expect.any(Function))
    })

    it('should register stalled event handler', async () => {
      await startWorker()

      expect(mockWorkerInstance.on).toHaveBeenCalledWith('stalled', expect.any(Function))
    })

    it('should handle completed event', async () => {
      await startWorker()

      const completedHandler = mockWorkerInstance.on.mock.calls.find(
        (call) => call[0] === 'completed'
      )?.[1]

      const mockJob = createMockJob('job-123')
      completedHandler?.(mockJob)

      // Handler should execute without errors
      expect(completedHandler).toBeDefined()
    })

    it('should handle failed event with error', async () => {
      await startWorker()

      const failedHandler = mockWorkerInstance.on.mock.calls.find(
        (call) => call[0] === 'failed'
      )?.[1]

      const mockJob = createMockJob('job-123')
      const error = new Error('Job failed')

      failedHandler?.(mockJob, error)

      // Handler should execute without errors
      expect(failedHandler).toBeDefined()
    })

    it('should handle error event', async () => {
      await startWorker()

      const errorHandler = mockWorkerInstance.on.mock.calls.find(
        (call) => call[0] === 'error'
      )?.[1]

      const error = new Error('Worker error')
      errorHandler?.(error)

      // Handler should execute without errors
      expect(errorHandler).toBeDefined()
    })

    it('should handle stalled event', async () => {
      await startWorker()

      const stalledHandler = mockWorkerInstance.on.mock.calls.find(
        (call) => call[0] === 'stalled'
      )?.[1]

      stalledHandler?.('job-123')

      // Handler should execute without errors
      expect(stalledHandler).toBeDefined()
    })
  })

  /**
   * Test Suite: Worker Shutdown
   */
  describe('Worker Shutdown', () => {
    it('should close worker gracefully', async () => {
      await startWorker()

      await stopWorker()

      expect(mockWorkerInstance.close).toHaveBeenCalled()
    })

    it('should handle stop when worker not started', async () => {
      await stopWorker()

      expect(mockWorkerInstance.close).not.toHaveBeenCalled()
    })

    it('should clear worker instance after stop', async () => {
      await startWorker()
      expect(getWorker()).toBeDefined()

      await stopWorker()
      expect(getWorker()).toBeNull()
    })

    it('should allow restart after stop', async () => {
      const worker1 = await startWorker()
      await stopWorker()

      vi.clearAllMocks()

      const worker2 = await startWorker()

      expect(MockWorkerFn).toHaveBeenCalledTimes(1)
      expect(worker2).toBeDefined()
    })

    it('should handle close errors gracefully', async () => {
      mockWorkerInstance.close.mockRejectedValueOnce(new Error('Close failed'))

      await startWorker()

      await expect(stopWorker()).rejects.toThrow('Close failed')
    })
  })

  /**
   * Test Suite: Worker Instance Management
   */
  describe('Worker Instance Management', () => {
    it('should return null when no worker started', () => {
      const worker = getWorker()

      expect(worker).toBeNull()
    })

    it('should return worker instance after start', async () => {
      await startWorker()

      const worker = getWorker()

      expect(worker).toBeDefined()
      expect(worker).toBe(mockWorkerInstance)
    })

    it('should return null after stop', async () => {
      await startWorker()
      await stopWorker()

      const worker = getWorker()

      expect(worker).toBeNull()
    })
  })

  /**
   * Test Suite: Redis Connection Configuration
   */
  describe('Redis Connection Configuration', () => {
    it('should configure Redis with maxRetriesPerRequest null', async () => {
      await startWorker()

      expect(MockRedisFn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          maxRetriesPerRequest: null,
        })
      )
    })

    it('should configure Redis with enableReadyCheck false', async () => {
      await startWorker()

      expect(MockRedisFn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          enableReadyCheck: false,
        })
      )
    })

    it('should use Redis URL from environment', async () => {
      await startWorker()

      expect(MockRedisFn).toHaveBeenCalledWith('redis://localhost:6379', expect.any(Object))
    })
  })

  /**
   * Test Suite: Concurrent Job Processing
   */
  describe('Concurrent Job Processing', () => {
    it('should configure concurrency limit', async () => {
      await startWorker()

      const workerConfig = MockWorkerFn.mock.calls[0]?.[2]
      expect(workerConfig?.concurrency).toBe(5)
    })

    it('should process multiple jobs concurrently', async () => {
      await startWorker()

      const processorFn = lastProcessor.fn as ((job: Job) => Promise<void>) | undefined

      const jobs = [
        createMockJob('job-1'),
        createMockJob('job-2'),
        createMockJob('job-3'),
        createMockJob('job-4'),
        createMockJob('job-5'),
      ]

      const promises = jobs.map((job) => processorFn?.(job as Job))

      await Promise.all(promises)

      expect(processBookmarkJob).toHaveBeenCalledTimes(5)
    })

    it('should handle concurrent job failures independently', async () => {
      vi.mocked(processBookmarkJob)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Job 2 failed'))
        .mockResolvedValueOnce(undefined)

      await startWorker()

      const processorFn = lastProcessor.fn as ((job: Job) => Promise<void>) | undefined

      const job1 = processorFn?.(createMockJob('job-1') as Job)
      const job2 = processorFn?.(createMockJob('job-2') as Job)
      const job3 = processorFn?.(createMockJob('job-3') as Job)

      await expect(job1).resolves.not.toThrow()
      await expect(job2).rejects.toThrow('Job 2 failed')
      await expect(job3).resolves.not.toThrow()
    })
  })

  /**
   * Test Suite: Error Handling
   */
  describe('Error Handling', () => {
    it('should handle Redis connection failure during start', async () => {
      vi.mocked(waitForRedis).mockRejectedValueOnce(new Error('Redis unavailable'))

      await expect(startWorker()).rejects.toThrow('Redis unavailable')
    })

    it('should handle worker creation error', async () => {
      shouldWorkerThrow.value = true

      await expect(startWorker()).rejects.toThrow('Worker creation failed')
    })

    it('should propagate job processing errors', async () => {
      vi.mocked(processBookmarkJob).mockRejectedValueOnce(
        new Error('Content extraction failed')
      )

      await startWorker()

      const processorFn = lastProcessor.fn as ((job: Job) => Promise<void>) | undefined
      const mockJob = createMockJob('job-123')

      await expect(processorFn?.(mockJob as Job)).rejects.toThrow('Content extraction failed')
    })
  })

  /**
   * Test Suite: Worker Lifecycle
   */
  describe('Worker Lifecycle', () => {
    it('should handle complete start-process-stop cycle', async () => {
      // Start
      const worker = await startWorker()
      expect(worker).toBeDefined()

      // Process
      const processorFn = lastProcessor.fn as ((job: Job) => Promise<void>) | undefined
      const mockJob = createMockJob('job-123')
      await processorFn?.(mockJob as Job)
      expect(processBookmarkJob).toHaveBeenCalled()

      // Stop
      await stopWorker()
      expect(getWorker()).toBeNull()
    })

    it('should warn if starting already started worker', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await startWorker()
      await startWorker()

      expect(consoleWarnSpy).toHaveBeenCalledWith('[worker] Already started')

      consoleWarnSpy.mockRestore()
    })

    it('should handle rapid start-stop cycles', async () => {
      await startWorker()
      await stopWorker()
      await startWorker()
      await stopWorker()
      await startWorker()

      expect(getWorker()).toBeDefined()
    })
  })

  /**
   * Test Suite: Job Logging
   */
  describe('Job Logging', () => {
    it('should log when processing job starts', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await startWorker()

      const processorFn = lastProcessor.fn as ((job: Job) => Promise<void>) | undefined
      const mockJob = createMockJob('job-123')

      await processorFn?.(mockJob as Job)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[worker] Processing job job-123: bookmark ${TEST_BOOKMARK_ID}`
      )

      consoleLogSpy.mockRestore()
    })

    it('should log when job completes', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await startWorker()

      const completedHandler = mockWorkerInstance.on.mock.calls.find(
        (call) => call[0] === 'completed'
      )?.[1]

      const mockJob = createMockJob('job-123')
      completedHandler?.(mockJob)

      expect(consoleLogSpy).toHaveBeenCalledWith('[worker] Completed: job-123')

      consoleLogSpy.mockRestore()
    })

    it('should log when job fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await startWorker()

      const failedHandler = mockWorkerInstance.on.mock.calls.find(
        (call) => call[0] === 'failed'
      )?.[1]

      const mockJob = createMockJob('job-123')
      const error = new Error('Processing failed')

      failedHandler?.(mockJob, error)

      expect(consoleErrorSpy).toHaveBeenCalledWith('[worker] Failed: job-123', 'Processing failed')

      consoleErrorSpy.mockRestore()
    })

    it('should log when worker is ready', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await startWorker()

      const readyHandler = mockWorkerInstance.on.mock.calls.find(
        (call) => call[0] === 'ready'
      )?.[1]

      readyHandler?.()

      expect(consoleLogSpy).toHaveBeenCalledWith('[worker] Worker is ready and listening for jobs')

      consoleLogSpy.mockRestore()
    })
  })
})
