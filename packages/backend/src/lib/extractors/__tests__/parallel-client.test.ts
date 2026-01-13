/**
 * Comprehensive tests for Parallel AI Extract API Client
 *
 * Tests the parallel-client which uses the Parallel AI Extract API
 * to fetch content from URLs with retry logic and exponential backoff.
 *
 * Coverage:
 * - Successful extraction
 * - Retry logic with exponential backoff
 * - 5xx server errors trigger retries
 * - 4xx client errors do not trigger retries
 * - Network errors and timeouts trigger retries
 * - API-level errors handling
 * - Helper function tests (isRetryableError, isRetryableStatusCode, calculateBackoffDelay)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  extractWithParallel,
  isRetryableError,
  isRetryableStatusCode,
  calculateBackoffDelay,
  type ParallelExtractResponse,
} from '../parallel-client'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Parallel AI Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Set the API key for tests
    process.env.PARALLEL_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    delete process.env.PARALLEL_API_KEY
  })

  describe('isRetryableError', () => {
    it('should return true for AbortError (timeout)', () => {
      const abortError = new Error('Request aborted')
      abortError.name = 'AbortError'
      expect(isRetryableError(abortError)).toBe(true)
    })

    it('should return true for fetch-related errors', () => {
      const fetchError = new Error('Failed to fetch')
      expect(isRetryableError(fetchError)).toBe(true)
    })

    it('should return true for network errors', () => {
      const networkError = new Error('network error occurred')
      expect(isRetryableError(networkError)).toBe(true)
    })

    it('should return false for non-Error values', () => {
      expect(isRetryableError('string error')).toBe(false)
      expect(isRetryableError(null)).toBe(false)
      expect(isRetryableError(undefined)).toBe(false)
      expect(isRetryableError(123)).toBe(false)
    })

    it('should return false for generic errors', () => {
      const genericError = new Error('Some random error')
      expect(isRetryableError(genericError)).toBe(false)
    })
  })

  describe('isRetryableStatusCode', () => {
    it('should return true for 5xx status codes', () => {
      expect(isRetryableStatusCode(500)).toBe(true)
      expect(isRetryableStatusCode(502)).toBe(true)
      expect(isRetryableStatusCode(503)).toBe(true)
      expect(isRetryableStatusCode(504)).toBe(true)
      expect(isRetryableStatusCode(599)).toBe(true)
    })

    it('should return false for 4xx status codes', () => {
      expect(isRetryableStatusCode(400)).toBe(false)
      expect(isRetryableStatusCode(401)).toBe(false)
      expect(isRetryableStatusCode(403)).toBe(false)
      expect(isRetryableStatusCode(404)).toBe(false)
      expect(isRetryableStatusCode(429)).toBe(false)
    })

    it('should return false for 2xx and 3xx status codes', () => {
      expect(isRetryableStatusCode(200)).toBe(false)
      expect(isRetryableStatusCode(201)).toBe(false)
      expect(isRetryableStatusCode(301)).toBe(false)
      expect(isRetryableStatusCode(302)).toBe(false)
    })
  })

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff correctly', () => {
      // Mock Math.random to return 0 for predictable tests
      vi.spyOn(Math, 'random').mockReturnValue(0)

      // First attempt (0): baseDelay * 2^0 = 1000
      expect(calculateBackoffDelay(0, 1000)).toBe(1000)

      // Second attempt (1): baseDelay * 2^1 = 2000
      expect(calculateBackoffDelay(1, 1000)).toBe(2000)

      // Third attempt (2): baseDelay * 2^2 = 4000
      expect(calculateBackoffDelay(2, 1000)).toBe(4000)
    })

    it('should add jitter to the delay', () => {
      // Mock Math.random to return 0.5
      vi.spyOn(Math, 'random').mockReturnValue(0.5)

      // First attempt with 50% jitter: 1000 + (1000 * 0.5 * 0.25) = 1125
      const delay = calculateBackoffDelay(0, 1000)
      expect(delay).toBe(1125)
    })

    it('should use default base delay when not specified', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      const delay = calculateBackoffDelay(0)
      expect(delay).toBe(1000) // Default BASE_RETRY_DELAY_MS
    })
  })

  describe('extractWithParallel', () => {
    it('should return null when API key is not set', async () => {
      delete process.env.PARALLEL_API_KEY

      const result = await extractWithParallel('https://example.com')

      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should extract content successfully on first attempt', async () => {
      const mockResponse: ParallelExtractResponse = {
        extract_id: 'test-id',
        results: [
          {
            url: 'https://example.com',
            title: 'Test Title',
            full_content: 'Test content from the article',
            excerpts: ['excerpt1', 'excerpt2'],
            publish_date: '2024-01-15',
          },
        ],
        errors: [],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await extractWithParallel('https://example.com')

      expect(result).toEqual({
        url: 'https://example.com',
        title: 'Test Title',
        full_content: 'Test content from the article',
        excerpts: ['excerpt1', 'excerpt2'],
        publish_date: '2024-01-15',
      })
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should retry on 5xx server errors', async () => {
      // First call fails with 503
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service Unavailable'),
      })

      // Second call succeeds
      const mockResponse: ParallelExtractResponse = {
        extract_id: 'test-id',
        results: [
          {
            url: 'https://example.com',
            title: 'Success',
            full_content: 'Content after retry',
            excerpts: null,
          },
        ],
        errors: [],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      // Start the extraction
      const resultPromise = extractWithParallel('https://example.com')

      // Fast-forward through the backoff delay
      await vi.advanceTimersByTimeAsync(2000)

      const result = await resultPromise

      expect(result).toEqual({
        url: 'https://example.com',
        title: 'Success',
        full_content: 'Content after retry',
        excerpts: null,
      })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should not retry on 4xx client errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      })

      const result = await extractWithParallel('https://example.com')

      expect(result).toBeNull()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should not retry on 401 Unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      })

      const result = await extractWithParallel('https://example.com')

      expect(result).toBeNull()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should not retry on 404 Not Found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      })

      const result = await extractWithParallel('https://example.com')

      expect(result).toBeNull()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should retry on timeout errors', async () => {
      // First call times out
      const abortError = new Error('Request aborted')
      abortError.name = 'AbortError'
      mockFetch.mockRejectedValueOnce(abortError)

      // Second call succeeds
      const mockResponse: ParallelExtractResponse = {
        extract_id: 'test-id',
        results: [
          {
            url: 'https://example.com',
            title: 'Success After Timeout',
            full_content: 'Content',
            excerpts: null,
          },
        ],
        errors: [],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const resultPromise = extractWithParallel('https://example.com')
      await vi.advanceTimersByTimeAsync(2000)

      const result = await resultPromise

      expect(result?.title).toBe('Success After Timeout')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should fail after max retries exceeded', async () => {
      // All calls fail with 503
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service Unavailable'),
      })

      const resultPromise = extractWithParallel('https://example.com')

      // Fast-forward through all retry delays
      await vi.advanceTimersByTimeAsync(10000)

      const result = await resultPromise

      expect(result).toBeNull()
      // Initial attempt + 2 retries = 3 calls
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should handle API-level errors in response', async () => {
      const mockResponse: ParallelExtractResponse = {
        extract_id: 'test-id',
        results: [],
        errors: [
          {
            url: 'https://example.com',
            error: 'Unable to extract content from this URL',
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await extractWithParallel('https://example.com')

      expect(result).toBeNull()
      // API-level errors should not trigger retries
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should return null when no results in response', async () => {
      const mockResponse: ParallelExtractResponse = {
        extract_id: 'test-id',
        results: [],
        errors: [],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await extractWithParallel('https://example.com')

      expect(result).toBeNull()
    })

    it('should include correct headers in request', async () => {
      const mockResponse: ParallelExtractResponse = {
        extract_id: 'test-id',
        results: [
          {
            url: 'https://example.com',
            title: 'Test',
            full_content: 'Content',
            excerpts: null,
          },
        ],
        errors: [],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await extractWithParallel('https://example.com')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.parallel.ai/v1beta/extract',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'test-api-key',
            'parallel-beta': 'search-extract-2025-10-10',
          },
        })
      )
    })

    it('should include correct body parameters in request', async () => {
      const mockResponse: ParallelExtractResponse = {
        extract_id: 'test-id',
        results: [
          {
            url: 'https://example.com/article',
            title: 'Test',
            full_content: 'Content',
            excerpts: null,
          },
        ],
        errors: [],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await extractWithParallel('https://example.com/article')

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)

      expect(body.urls).toEqual(['https://example.com/article'])
      expect(body.full_content).toBe(true)
      expect(body.excerpts).toBe(true)
      expect(body.title).toBe(true)
      expect(body.publish_date).toBe(true)
      expect(body.objective).toContain('Extract the main article content')
    })

    it('should handle network errors with retries', async () => {
      // First call fails with network error
      const networkError = new Error('Failed to fetch')
      mockFetch.mockRejectedValueOnce(networkError)

      // Second call succeeds
      const mockResponse: ParallelExtractResponse = {
        extract_id: 'test-id',
        results: [
          {
            url: 'https://example.com',
            title: 'Success',
            full_content: 'Content',
            excerpts: null,
          },
        ],
        errors: [],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const resultPromise = extractWithParallel('https://example.com')
      await vi.advanceTimersByTimeAsync(2000)

      const result = await resultPromise

      expect(result?.title).toBe('Success')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should not retry on non-retryable errors', async () => {
      // A random error that doesn't match retry patterns
      const randomError = new Error('Some random error')
      mockFetch.mockRejectedValueOnce(randomError)

      const result = await extractWithParallel('https://example.com')

      expect(result).toBeNull()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should handle mixed retry scenarios (fail, fail, succeed)', async () => {
      // First call fails with 500
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })

      // Second call also fails with 502
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve('Bad Gateway'),
      })

      // Third call succeeds
      const mockResponse: ParallelExtractResponse = {
        extract_id: 'test-id',
        results: [
          {
            url: 'https://example.com',
            title: 'Finally Success',
            full_content: 'Content after multiple retries',
            excerpts: null,
          },
        ],
        errors: [],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const resultPromise = extractWithParallel('https://example.com')
      await vi.advanceTimersByTimeAsync(5000)

      const result = await resultPromise

      expect(result?.title).toBe('Finally Success')
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should handle errors array with different URL', async () => {
      // Error is for a different URL, should still return the result
      const mockResponse: ParallelExtractResponse = {
        extract_id: 'test-id',
        results: [
          {
            url: 'https://example.com',
            title: 'Success',
            full_content: 'Content',
            excerpts: null,
          },
        ],
        errors: [
          {
            url: 'https://other.com',
            error: 'Failed for other URL',
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await extractWithParallel('https://example.com')

      expect(result?.title).toBe('Success')
    })
  })
})
